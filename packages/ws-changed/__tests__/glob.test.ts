import { rmSync } from 'fs';

import { expandDirGlob, extOf, makeMatcher, normalizeExts, toRel } from '../src/glob';
import { buildWorkspace } from './support/build-workspace';

describe('expandDirGlob', () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  it('expands a single-star segment to immediate child dirs', () => {
    const root = buildWorkspace({
      packages: [{ dir: 'packages/a' }, { dir: 'packages/b' }]
    });
    roots.push(root);
    expect(expandDirGlob(root, 'packages/*').sort()).toEqual(['packages/a', 'packages/b']);
  });

  it('expands a literal path to itself', () => {
    const root = buildWorkspace({ packages: [{ dir: 'services/api' }] });
    roots.push(root);
    expect(expandDirGlob(root, 'services/api')).toEqual(['services/api']);
  });

  it('expands ** to every descendant directory', () => {
    const root = buildWorkspace({
      packages: [{ dir: 'group/one/a' }, { dir: 'group/two/b' }]
    });
    roots.push(root);
    const dirs = expandDirGlob(root, 'group/**');
    expect(dirs).toEqual(expect.arrayContaining(['group', 'group/one', 'group/one/a', 'group/two', 'group/two/b']));
  });

  it('never descends into node_modules or dist', () => {
    const root = buildWorkspace({
      packages: [{ dir: 'packages/a', files: { 'node_modules/dep/package.json': '{}', 'dist/x.js': '' } }]
    });
    roots.push(root);
    const dirs = expandDirGlob(root, 'packages/a/**');
    expect(dirs.some((d) => d.includes('node_modules'))).toBe(false);
    expect(dirs.some((d) => d.includes('dist'))).toBe(false);
  });

  it('matches a wildcard within a literal segment', () => {
    const root = buildWorkspace({
      packages: [{ dir: 'plugins/plugin-a' }, { dir: 'plugins/plugin-b' }, { dir: 'plugins/other' }]
    });
    roots.push(root);
    expect(expandDirGlob(root, 'plugins/plugin-*').sort()).toEqual([
      'plugins/plugin-a',
      'plugins/plugin-b'
    ]);
  });
});

describe('makeMatcher', () => {
  it('matches nothing for an empty pattern list', () => {
    const match = makeMatcher([]);
    expect(match('anything')).toBe(false);
  });

  it('matches a plain path and its subtree', () => {
    const match = makeMatcher(['dist']);
    expect(match('dist')).toBe(true);
    expect(match('dist/a/b.js')).toBe(true);
    expect(match('src/dist.ts')).toBe(false);
  });

  it('matches ** across segments (standard glob: the subtree, not the bare dir)', () => {
    const match = makeMatcher(['.github/**']);
    expect(match('.github/workflows/ci.yml')).toBe(true);
    expect(match('.github/x')).toBe(true);
    expect(match('notgithub/x')).toBe(false);
  });

  it('matches a single filename anywhere', () => {
    const match = makeMatcher(['pnpm-lock.yaml']);
    expect(match('pnpm-lock.yaml')).toBe(true);
    expect(match('nested/pnpm-lock.yaml')).toBe(true);
  });
});

describe('normalizeExts', () => {
  it('adds the dot, lowercases, splits commas, and tolerates absence', () => {
    expect(normalizeExts('sql')).toEqual(['.sql']);
    expect(normalizeExts('.SQL')).toEqual(['.sql']);
    expect(normalizeExts('ts, tsx')).toEqual(['.ts', '.tsx']);
    expect(normalizeExts(['.ts', 'tsx'])).toEqual(['.ts', '.tsx']);
    expect(normalizeExts()).toEqual([]);
    expect(normalizeExts([''])).toEqual([]);
  });
});

describe('extOf', () => {
  it('returns the lowercased extension', () => {
    expect(extOf('packages/a/deploy/x.SQL')).toBe('.sql');
    expect(extOf('a/b.tar.gz')).toBe('.gz');
  });

  it('returns empty for a dotfile or an extensionless name', () => {
    expect(extOf('.gitignore')).toBe('');
    expect(extOf('packages/a/.npmrc')).toBe('');
    expect(extOf('Makefile')).toBe('');
    expect(extOf('bin/ws-changed')).toBe('');
  });
});

describe('toRel', () => {
  it('returns a posix path relative to root', () => {
    expect(toRel('/repo', '/repo/packages/a/index.ts')).toBe('packages/a/index.ts');
  });
});
