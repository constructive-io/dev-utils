import { parse as parseYaml } from 'yaml';

import type { Inventory, PolicyConfig } from '../src';
import { applyPolicy, MANAGED_MARKER, normalizeConfig, resolvePolicy } from '../src';

const inventory: Inventory = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  maintainers: ['pyramation'],
  scopes: ['@constructive-io'],
  packages: ['yanse']
};

const policyFor = (config: PolicyConfig = {}) =>
  resolvePolicy({ config: normalizeConfig(config), inventory });

describe('applyPolicy', () => {
  it('creates the policy block in an empty file', () => {
    const out = applyPolicy('', policyFor());
    expect(parseYaml(out)).toEqual({
      minimumReleaseAge: 20160,
      minimumReleaseAgeExclude: ['@constructive-io/*', 'yanse'],
      blockExoticSubdeps: false
    });
  });

  it('leaves keys it does not own alone', () => {
    const existing = 'packages:\n  - packages/*\ncatalog:\n  react: ^18.0.0\n';
    const out = applyPolicy(existing, policyFor());
    const parsed = parseYaml(out) as Record<string, unknown>;
    expect(parsed.packages).toEqual(['packages/*']);
    expect(parsed.catalog).toEqual({ react: '^18.0.0' });
  });

  it('preserves comments on keys it does not own', () => {
    const existing = [
      '# Everything below is hand-maintained.',
      'packages:',
      '  # the SDK is generated, keep it last',
      '  - packages/*',
      ''
    ].join('\n');
    const out = applyPolicy(existing, policyFor());
    expect(out).toContain('# Everything below is hand-maintained.');
    expect(out).toContain('# the SDK is generated, keep it last');
  });

  it('stamps the policy block so a reader knows what owns it', () => {
    expect(applyPolicy('', policyFor())).toContain(MANAGED_MARKER);
  });

  it('replaces a hand-edited value rather than appending a second key', () => {
    const out = applyPolicy('minimumReleaseAge: 0\n', policyFor());
    expect(out.match(/minimumReleaseAge:/g)).toHaveLength(1);
    expect(parseYaml(out)).toMatchObject({ minimumReleaseAge: 20160 });
  });

  it('removes a managed key the policy no longer sets', () => {
    const existing = 'allowBuilds:\n  esbuild: true\nminimumReleaseAge: 100\n';
    const out = applyPolicy(existing, policyFor());
    expect(out).not.toContain('allowBuilds');
  });

  it('is idempotent — a second run changes nothing', () => {
    const once = applyPolicy('packages:\n  - packages/*\n', policyFor());
    expect(applyPolicy(once, policyFor())).toBe(once);
  });

  it('writes the reason beside the package it exempts', () => {
    const out = applyPolicy(
      '',
      policyFor({
        exceptions: [{ package: 'left-pad', reason: 'CVE-2026-1', until: '2099-01-01' }],
        allowBuilds: { esbuild: 'native binary' }
      })
    );
    expect(out).toContain('- left-pad # CVE-2026-1 (expires 2099-01-01)');
    expect(out).toContain('esbuild: true # native binary');
  });

  it('comments a build entry whose name contains a dot', () => {
    const out = applyPolicy(
      '',
      policyFor({ allowBuilds: { 'lodash.merge': 'why not' } })
    );
    expect(out).toContain('lodash.merge: true # why not');
  });
});
