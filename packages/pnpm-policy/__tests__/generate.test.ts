import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { check, generate, packageNameFromLockKey, readLockfilePackages } from '../src';

const LOCKFILE = `lockfileVersion: '9.0'
packages:
  yanse@1.0.0:
    resolution: {integrity: sha512-x}
  '@acme/widget@2.0.0':
    resolution: {integrity: sha512-y}
  react@18.2.0:
    resolution: {integrity: sha512-z}
snapshots:
  'react-dom@18.2.0(react@18.2.0)': {}
`;

const INVENTORY = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  maintainers: ['me'],
  scopes: ['@acme'],
  packages: ['yanse', 'never-used']
};

function workspace(config: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pnpm-policy-'));
  writeFileSync(join(dir, 'pnpm-policy.yaml'), config);
  writeFileSync(join(dir, 'pnpm-lock.yaml'), LOCKFILE);
  writeFileSync(
    join(dir, 'pnpm-policy.inventory.json'),
    JSON.stringify(INVENTORY, null, 2)
  );
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  return dir;
}

const CONFIG = `minimumReleaseAge: 14d
blockExoticSubdeps: true
maintainers:
  - me
inventory: ./pnpm-policy.inventory.json
allowBuilds:
  esbuild: native binary
`;

describe('packageNameFromLockKey', () => {
  it('strips versions and peer suffixes', () => {
    expect(packageNameFromLockKey('yanse@1.0.0')).toBe('yanse');
    expect(packageNameFromLockKey('@acme/widget@2.0.0')).toBe('@acme/widget');
    expect(packageNameFromLockKey('react-dom@18.2.0(react@18.2.0)')).toBe('react-dom');
    expect(packageNameFromLockKey('/legacy@1.0.0')).toBe('legacy');
  });
});

describe('readLockfilePackages', () => {
  it('reads both packages and snapshots', () => {
    const dir = workspace(CONFIG);
    const names = readLockfilePackages(join(dir, 'pnpm-lock.yaml'));
    expect([...names].sort()).toEqual(['@acme/widget', 'react', 'react-dom', 'yanse']);
  });
});

describe('generate', () => {
  it('writes the policy and leaves the rest of the file intact', () => {
    const dir = workspace(CONFIG);
    const result = generate({ cwd: dir });

    expect(result.changed).toBe(true);
    const written = readFileSync(result.file, 'utf-8');
    expect(written).toContain('packages:\n  - packages/*');
    expect(written).toContain('minimumReleaseAge: 20160');
    expect(written).toContain('- "@acme/*"');
    expect(written).toContain('- yanse');
    expect(written).toContain('esbuild: true # native binary');
    // `never-used` is first-party but this workspace does not resolve it.
    expect(written).not.toContain('never-used');
    expect(result.report.omittedPackages).toEqual(['never-used']);
  });

  it('emits unused first-party names when intersection is off', () => {
    const dir = workspace(CONFIG);
    const result = generate({ cwd: dir, intersect: false });
    expect(readFileSync(result.file, 'utf-8')).toContain('never-used');
  });

  it('needs no lockfile when scopes alone define the exemptions', () => {
    const dir = workspace('minimumReleaseAge: 14d\nscopes:\n  - "@acme"\n');
    rmSync(join(dir, 'pnpm-lock.yaml'));
    expect(readFileSync(generate({ cwd: dir }).file, 'utf-8')).toContain('"@acme/*"');
  });

  it('reports no change on a second run', () => {
    const dir = workspace(CONFIG);
    generate({ cwd: dir });
    expect(generate({ cwd: dir }).changed).toBe(false);
  });
});

describe('check', () => {
  it('passes on a freshly generated file', () => {
    const dir = workspace(CONFIG);
    generate({ cwd: dir });
    expect(check({ cwd: dir }).ok).toBe(true);
  });

  it('fails when the workspace file was hand-edited', () => {
    const dir = workspace(CONFIG);
    generate({ cwd: dir });
    const file = join(dir, 'pnpm-workspace.yaml');
    writeFileSync(
      file,
      readFileSync(file, 'utf-8').replace('minimumReleaseAge: 20160', 'minimumReleaseAge: 0')
    );

    const result = check({ cwd: dir });
    expect(result.drifted).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('fails when a waiver has expired, even with no drift', () => {
    const dir = workspace(
      `${CONFIG}exceptions:
  - package: left-pad
    reason: urgent security fix
    until: 2020-01-01
`
    );
    generate({ cwd: dir });

    const result = check({ cwd: dir });
    expect(result.drifted).toBe(false);
    expect(result.expired.map((e) => e.package)).toEqual(['left-pad']);
    expect(result.ok).toBe(false);
  });

  it('passes a waiver that has not expired yet', () => {
    const dir = workspace(
      `${CONFIG}exceptions:
  - package: left-pad
    reason: urgent security fix
    until: 2099-01-01
`
    );
    generate({ cwd: dir });
    expect(check({ cwd: dir }).ok).toBe(true);
  });

  it('says how to fix drift rather than leaving the reader guessing', () => {
    const dir = workspace(CONFIG);
    const result = check({ cwd: dir });
    expect(result.drifted).toBe(true);
    expect(result.expected).toContain('pnpm-policy generate');
  });
});

describe('config errors', () => {
  it('names the missing config file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pnpm-policy-'));
    expect(() => generate({ cwd: dir })).toThrow(/No policy config found/);
  });

  it('explains an inventory that cannot be resolved', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pnpm-policy-'));
    writeFileSync(
      join(dir, 'pnpm-policy.yaml'),
      'maintainers: [me]\ninventory: ./nope.json\n'
    );
    expect(() => generate({ cwd: dir })).toThrow(/neither a file nor a resolvable package/);
  });

  it('refuses to silently ignore maintainers with no inventory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pnpm-policy-'));
    writeFileSync(join(dir, 'pnpm-policy.yaml'), 'maintainers: [me]\n');
    expect(() => generate({ cwd: dir })).toThrow(/no inventory is available/);
  });
});
