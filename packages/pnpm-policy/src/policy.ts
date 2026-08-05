/**
 * Turning a policy plus an inventory into pnpm settings.
 *
 * The shape of the answer is dictated by what pnpm can express: one global
 * `minimumReleaseAge`, one list of names exempt from it, one list of packages
 * allowed to run install scripts. Everything here is about deriving those three
 * lists from things you already own rather than typing them out.
 */

import { formatDuration } from './duration';
import type {
  CommentPath,
  Inventory,
  PolicyComments,
  PolicyReport,
  ResolvedConfig,
  ResolvedPolicy
} from './types';

/** Which pnpm key carries the build allowlist. */
export type BuildsKey = 'allowBuilds' | 'onlyBuiltDependencies';

export interface ResolveOptions {
  config: ResolvedConfig;
  inventory?: Inventory;
  /** Package names this workspace resolves. Omit to skip intersection. */
  resolved?: Set<string>;
  /** `allowBuilds` (pnpm 10.16+/11, a map) or `onlyBuiltDependencies` (an array). */
  buildsKey?: BuildsKey;
  /** Clock injection, so `until` expiry is testable. */
  now?: Date;
}

/** The pnpm pattern for an exception: a bare name, or a name plus a version union. */
export function exceptionPattern(pkg: string, versions?: string[]): string {
  return versions?.length ? `${pkg}@${versions.join('||')}` : pkg;
}

function buildExclude(options: ResolveOptions): {
  scopes: string[];
  packages: string[];
  omitted: string[];
  exceptions: string[];
} {
  const { config, inventory, resolved } = options;

  // Scopes are never intersected. Nobody else can publish into a scope you own,
  // so the glob is correct whether or not this workspace uses one today — and
  // it stays correct when a new package lands there tomorrow.
  const scopes = [...new Set([...(inventory?.scopes ?? []), ...config.scopes])].sort();

  const known = inventory?.packages ?? [];
  const intersect = config.intersect && resolved != null;

  const packages: string[] = [];
  const omitted: string[] = [];
  for (const name of known) {
    // A name already covered by a scope glob would be noise in the file.
    if (scopes.some((scope) => name.startsWith(`${scope}/`))) continue;
    if (intersect && !resolved.has(name)) omitted.push(name);
    else packages.push(name);
  }

  const exceptions = config.exceptions.map((exception) =>
    exceptionPattern(exception.package, exception.versions)
  );

  return {
    scopes: scopes.map((scope) => `${scope}/*`),
    packages: packages.sort(),
    omitted: omitted.sort(),
    exceptions
  };
}

function buildComments(
  config: ResolvedConfig,
  report: PolicyReport,
  buildsKey: BuildsKey,
  excludeCount: number
): PolicyComments {
  const before: Array<[CommentPath, string]> = [];
  const inline: Array<[CommentPath, string]> = [];

  before.push([
    ['minimumReleaseAge'],
    [
      `A third-party release must be ${formatDuration(report.minimumReleaseAgeMinutes)} old before it can be installed.`,
      'Most malicious releases are found and yanked well inside that window.'
    ].join('\n')
  ]);

  if (excludeCount > 0) {
    const sources = [
      report.scopes.length ? `${report.scopes.length} scope glob(s)` : '',
      report.firstPartyPackages.length
        ? `${report.firstPartyPackages.length} first-party package(s)`
        : '',
      report.exceptions.length ? `${report.exceptions.length} exception(s)` : ''
    ].filter(Boolean);

    before.push([
      ['minimumReleaseAgeExclude'],
      [
        `Exempt from the wait: ${sources.join(', ')}.`,
        config.maintainers.length
          ? `First-party membership comes from what ${config.maintainers.join(', ')} ${
              config.maintainers.length === 1 ? 'publishes' : 'publish'
            } on npm — waiting on your own release protects nothing.`
          : report.firstPartyPackages.length
            ? 'First-party membership comes from the inventory.'
            : 'First-party membership comes from the scopes claimed in pnpm-policy.yaml.'
      ].join('\n')
    ]);
  }

  // Per-entry reasons, so a waiver can be judged where it is read.
  let index = report.scopes.length + report.firstPartyPackages.length;
  for (const exception of config.exceptions) {
    inline.push([
      ['minimumReleaseAgeExclude', index],
      exception.until ? `${exception.reason} (expires ${exception.until})` : exception.reason
    ]);
    index++;
  }

  if (config.allowBuilds.length) {
    before.push([[buildsKey], 'The only dependencies permitted to run install scripts.']);
    config.allowBuilds.forEach((build, i) => {
      if (!build.reason) return;
      inline.push([[buildsKey, buildsKey === 'allowBuilds' ? build.package : i], build.reason]);
    });
  }

  before.push([
    ['blockExoticSubdeps'],
    config.blockExoticSubdeps
      ? 'Transitive dependencies must come from the registry, not from git or a URL.'
      : 'Off: transitive dependencies may resolve from git or a URL.'
  ]);

  return { before, inline };
}

/** Resolve a config plus an inventory into the pnpm settings that enforce it. */
export function resolvePolicy(options: ResolveOptions): ResolvedPolicy {
  const { config } = options;
  const buildsKey = options.buildsKey ?? 'allowBuilds';
  const now = options.now ?? new Date();

  const { scopes, packages, omitted, exceptions } = buildExclude(options);
  const exclude = [...scopes, ...packages, ...exceptions];

  const expiredExceptions = config.exceptions.filter(
    (exception) => exception.until != null && Date.parse(exception.until) < now.getTime()
  );

  const report: PolicyReport = {
    minimumReleaseAgeMinutes: config.minimumReleaseAgeMinutes,
    scopes,
    firstPartyPackages: packages,
    omittedPackages: omitted,
    exceptions,
    expiredExceptions
  };

  const settings: Record<string, unknown> = {
    minimumReleaseAge: config.minimumReleaseAgeMinutes
  };
  if (exclude.length) {
    settings.minimumReleaseAgeExclude = exclude;
  }
  if (config.allowBuilds.length) {
    settings[buildsKey] =
      buildsKey === 'allowBuilds'
        ? Object.fromEntries(config.allowBuilds.map((build) => [build.package, true]))
        : config.allowBuilds.map((build) => build.package);
  }
  settings.blockExoticSubdeps = config.blockExoticSubdeps;
  Object.assign(settings, config.settings);

  return {
    settings,
    comments: buildComments(config, report, buildsKey, exclude.length),
    report
  };
}

/** The keys a generated policy owns. Anything else in the file is left alone. */
export function managedKeys(buildsKey: BuildsKey, extra: string[] = []): string[] {
  return [
    'minimumReleaseAge',
    'minimumReleaseAgeExclude',
    buildsKey,
    'blockExoticSubdeps',
    ...extra
  ];
}
