import type { Inventory, PolicyConfig } from '../src';
import { normalizeConfig, resolvePolicy } from '../src';

const inventory: Inventory = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  maintainers: ['pyramation'],
  scopes: ['@constructive-io', '@pgsql'],
  packages: ['inquirerer', 'pgsql-parser', 'yanse'],
  sharedScopes: ['@types']
};

const commentAt = (
  comments: Array<[Array<string | number>, string]>,
  path: Array<string | number>
): string | undefined =>
  comments.find(([target]) => target.join('\u0000') === path.join('\u0000'))?.[1];

const resolve = (config: PolicyConfig, resolved?: string[]) =>
  resolvePolicy({
    config: normalizeConfig(config),
    inventory,
    resolved: resolved ? new Set(resolved) : undefined,
    now: new Date('2026-06-01T00:00:00Z')
  });

describe('resolvePolicy', () => {
  it('defaults to a two-day wait', () => {
    expect(resolve({}).settings.minimumReleaseAge).toBe(2880);
  });

  it('converts a human duration to the minutes pnpm expects', () => {
    expect(resolve({ minimumReleaseAge: '3d' }).settings.minimumReleaseAge).toBe(4320);
  });

  it('emits owned scopes as globs and first-party names individually', () => {
    const { settings } = resolve({});
    expect(settings.minimumReleaseAgeExclude).toEqual([
      '@constructive-io/*',
      '@pgsql/*',
      'inquirerer',
      'pgsql-parser',
      'yanse'
    ]);
  });

  it('intersects unscoped names with what the workspace resolves', () => {
    const { settings, report } = resolve({}, ['yanse', 'react']);
    expect(settings.minimumReleaseAgeExclude).toEqual([
      '@constructive-io/*',
      '@pgsql/*',
      'yanse'
    ]);
    // Scopes are never intersected: nobody else can publish into them, so the
    // glob stays correct for packages this workspace has not adopted yet.
    expect(report.scopes).toEqual(['@constructive-io/*', '@pgsql/*']);
    expect(report.omittedPackages).toEqual(['inquirerer', 'pgsql-parser']);
  });

  it('emits every name when intersection is off', () => {
    const { report } = resolve({ intersect: false }, ['yanse']);
    expect(report.firstPartyPackages).toEqual(['inquirerer', 'pgsql-parser', 'yanse']);
    expect(report.omittedPackages).toEqual([]);
  });

  it('adds config scopes the inventory does not know about', () => {
    const { report } = resolve({ scopes: ['launchql'] });
    expect(report.scopes).toContain('@launchql/*');
  });

  it('does not list a package a scope glob already covers', () => {
    const { report } = resolvePolicy({
      config: normalizeConfig({}),
      inventory: { ...inventory, packages: ['@pgsql/types', 'yanse'] }
    });
    expect(report.firstPartyPackages).toEqual(['yanse']);
  });

  it('appends exceptions after the first-party names', () => {
    const { settings } = resolve({
      exceptions: [{ package: 'left-pad', reason: 'urgent security fix' }]
    });
    expect(settings.minimumReleaseAgeExclude).toContain('left-pad');
  });

  it('pins an exception to exact versions', () => {
    const { settings } = resolve({
      exceptions: [
        { package: 'lodash', versions: ['4.17.21', '4.17.22'], reason: 'CVE fix' }
      ]
    });
    expect(settings.minimumReleaseAgeExclude).toContain('lodash@4.17.21||4.17.22');
  });

  it('reports an exception whose until date has passed', () => {
    const { report } = resolve({
      exceptions: [
        { package: 'left-pad', reason: 'security fix', until: '2026-01-01' },
        { package: 'right-pad', reason: 'security fix', until: '2027-01-01' }
      ]
    });
    expect(report.expiredExceptions.map((e) => e.package)).toEqual(['left-pad']);
  });

  it('writes allowBuilds as the map pnpm 10.16+ expects', () => {
    const { settings } = resolve({
      allowBuilds: { esbuild: 'native binary', 'core-js': 'polyfills' }
    });
    expect(settings.allowBuilds).toEqual({ 'core-js': true, esbuild: true });
  });

  it('writes onlyBuiltDependencies as an array when asked', () => {
    const policy = resolvePolicy({
      config: normalizeConfig({ allowBuilds: ['esbuild', 'core-js'] }),
      buildsKey: 'onlyBuiltDependencies'
    });
    expect(policy.settings.onlyBuiltDependencies).toEqual(['core-js', 'esbuild']);
    expect(policy.settings.allowBuilds).toBeUndefined();
  });

  it('passes extra settings through verbatim', () => {
    const { settings } = resolve({ settings: { trustPolicy: 'strict' } });
    expect(settings.trustPolicy).toBe('strict');
  });

  it('explains the wait and where the exemptions came from', () => {
    const { comments } = resolve({ maintainers: ['pyramation'] });
    expect(commentAt(comments.before, ['minimumReleaseAge'])).toContain('2d');
    expect(commentAt(comments.before, ['minimumReleaseAgeExclude'])).toContain('pyramation');
  });

  it('agrees with the number of maintainers it names', () => {
    const one = resolve({ maintainers: ['pyramation'] });
    expect(commentAt(one.comments.before, ['minimumReleaseAgeExclude'])).toContain(
      'pyramation publishes on npm'
    );
    const two = resolve({ maintainers: ['pyramation', 'dan'] });
    expect(commentAt(two.comments.before, ['minimumReleaseAgeExclude'])).toContain(
      'pyramation, dan publish on npm'
    );
  });

  it('carries each exception reason to the line it exempts', () => {
    const { comments, settings } = resolve({
      exceptions: [{ package: 'left-pad', reason: 'CVE-2026-1', until: '2027-01-01' }]
    });
    const exclude = settings.minimumReleaseAgeExclude as string[];
    const index = exclude.indexOf('left-pad');
    expect(commentAt(comments.inline, ['minimumReleaseAgeExclude', index])).toBe(
      'CVE-2026-1 (expires 2027-01-01)'
    );
  });
});

describe('normalizeConfig', () => {
  it('requires a reason on every exception', () => {
    expect(() =>
      normalizeConfig({ exceptions: [{ package: 'left-pad' } as never] })
    ).toThrow(/missing a reason/);
  });

  it('rejects versions pinned to a name pattern, which pnpm cannot match', () => {
    expect(() =>
      normalizeConfig({
        exceptions: [{ package: '@acme/*', versions: ['1.0.0'], reason: 'why' }]
      })
    ).toThrow(/pnpm does not allow/);
  });

  it('rejects an unparseable until date', () => {
    expect(() =>
      normalizeConfig({
        exceptions: [{ package: 'left-pad', reason: 'why', until: 'next tuesday' }]
      })
    ).toThrow(/until date/);
  });

  it('normalizes scopes written with or without @ and /*', () => {
    expect(normalizeConfig({ scopes: ['pgsql', '@launchql/*'] }).scopes).toEqual([
      '@launchql',
      '@pgsql'
    ]);
  });

  it('sorts allowBuilds so the generated file does not churn', () => {
    const config = normalizeConfig({ allowBuilds: ['sharp', 'esbuild'] });
    expect(config.allowBuilds.map((b) => b.package)).toEqual(['esbuild', 'sharp']);
  });
});
