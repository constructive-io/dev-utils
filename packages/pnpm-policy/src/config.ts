/**
 * Loading and normalizing `pnpm-policy.yaml`.
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { parse as parseYaml } from 'yaml';

import { parseDuration } from './duration';
import { PolicyError } from './errors';
import type { AllowedBuild, PolicyConfig, PolicyException, ResolvedConfig } from './types';

/** Filenames searched for, in order, when no explicit path is given. */
export const CONFIG_FILENAMES = ['pnpm-policy.yaml', 'pnpm-policy.yml', 'pnpm-policy.json'];

/**
 * Two days: a compromised release is normally reported and yanked within hours,
 * so this catches the attack without holding legitimate upgrades for a fortnight.
 */
export const DEFAULT_MINIMUM_RELEASE_AGE = '2d';

/** Find the config file for a directory, or undefined if there is none. */
export function findConfig(dir: string): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Read and parse a config file. YAML and JSON are both accepted. */
export function readConfig(file: string): PolicyConfig {
  const raw = readFileSync(file, 'utf-8');
  const parsed = parseYaml(raw) as PolicyConfig | null;
  if (parsed == null) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PolicyError(`${file} must contain a mapping`);
  }
  return parsed;
}

function normalizeAllowBuilds(input: PolicyConfig['allowBuilds']): AllowedBuild[] {
  if (!input) return [];

  const builds: AllowedBuild[] = Array.isArray(input)
    ? input.map((entry) =>
      typeof entry === 'string' ? { package: entry } : { ...entry }
    )
    : Object.entries(input).map(([pkg, reason]) => ({
      package: pkg,
      reason: typeof reason === 'string' ? reason : undefined
    }));

  for (const build of builds) {
    if (!build.package) {
      throw new PolicyError('An allowBuilds entry is missing a package name');
    }
  }

  // Sorted so the generated file does not churn on config reordering.
  return builds.sort((a, b) => a.package.localeCompare(b.package));
}

function normalizeExceptions(input: PolicyException[] | undefined): PolicyException[] {
  const exceptions = input ?? [];
  for (const exception of exceptions) {
    if (!exception.package) {
      throw new PolicyError('An exception is missing a package name');
    }
    // A waiver nobody can evaluate later is a waiver nobody will ever remove.
    if (!exception.reason) {
      throw new PolicyError(`Exception for "${exception.package}" is missing a reason`);
    }
    if (exception.versions?.length && exception.package.includes('*')) {
      // pnpm's own matcher rejects this pairing; failing here names the file.
      throw new PolicyError(
        `Exception for "${exception.package}" pins versions on a name pattern, which pnpm does not allow`
      );
    }
    if (exception.until && Number.isNaN(Date.parse(exception.until))) {
      throw new PolicyError(
        `Exception for "${exception.package}" has an unparseable until date: "${exception.until}"`
      );
    }
  }
  return exceptions;
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  return (scopes ?? [])
    .map((scope) => {
      const trimmed = scope.trim().replace(/\/\*$/, '');
      return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    })
    .sort();
}

/**
 * Accept one inventory reference or several. Several are merged at load time, so
 * a workspace can combine separately-published inventories rather than keeping a
 * flattened copy of them checked in.
 */
function normalizeInventory(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter((entry) => entry.length > 0);
}

/** Apply defaults and convert a config into the shape the resolver consumes. */
export function normalizeConfig(config: PolicyConfig): ResolvedConfig {
  return {
    minimumReleaseAgeMinutes: parseDuration(
      config.minimumReleaseAge ?? DEFAULT_MINIMUM_RELEASE_AGE
    ),
    blockExoticSubdeps: config.blockExoticSubdeps ?? false,
    maintainers: config.maintainers ?? [],
    scopes: normalizeScopes(config.scopes),
    inventory: normalizeInventory(config.inventory),
    intersect: config.intersect ?? true,
    allowBuilds: normalizeAllowBuilds(config.allowBuilds),
    exceptions: normalizeExceptions(config.exceptions),
    settings: config.settings ?? {}
  };
}

/** Load, parse and normalize the config for a directory or explicit file path. */
export function loadConfig(pathOrDir: string): { file: string; config: ResolvedConfig } {
  const target = resolve(pathOrDir);
  const isFile = existsSync(target) && statSync(target).isFile();
  const file = isFile ? target : findConfig(target);

  if (!file) {
    throw new PolicyError(
      `No policy config found in ${target}. Create one with: pnpm-policy init`
    );
  }
  return { file, config: normalizeConfig(readConfig(file)) };
}

/** Resolve a config-relative path (such as `inventory`) against the config's own directory. */
export function resolveFromConfig(configFile: string, target: string): string {
  return isAbsolute(target) ? target : join(dirname(configFile), target);
}
