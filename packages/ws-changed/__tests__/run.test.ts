import { execFileSync } from 'child_process';
import { rmSync, writeFileSync } from 'fs';
import { join } from 'path';

import { wsChanged } from '../src/run';
import { buildWorkspace } from './support/build-workspace';

function git(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/** Turn a built workspace into a committed git repo on `main`. */
function initRepo(root: string): void {
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@example.com'], root);
  git(['config', 'user.name', 'Test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'base'], root);
}

describe('wsChanged', () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  it('resolves workspace + affected from explicit changed paths', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/app', pkg: { name: 'app', dependencies: { core: 'workspace:*' } } },
        { dir: 'packages/core', pkg: { name: 'core' } }
      ]
    });
    roots.push(root);
    const { result } = wsChanged({
      cwd: root,
      overrides: { root },
      changed: ['packages/core/index.ts']
    });
    expect(result.packages).toEqual(['app', 'core']);
  });

  it('reads changed files from git against a base', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/app', pkg: { name: 'app', dependencies: { core: 'workspace:*' } } },
        { dir: 'packages/core', pkg: { name: 'core', files: {} } }
      ]
    });
    roots.push(root);
    initRepo(root);
    // Edit core in the working tree; app depends on it and must be pulled in.
    writeFileSync(join(root, 'packages/core/index.ts'), 'export const x = 1;\n');

    const { result } = wsChanged({ cwd: root, overrides: { root }, base: false });
    expect(result.changed).toEqual(['core']);
    expect(result.packages).toEqual(['app', 'core']);
  });

  it('applies the config file filter to the changed set', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/app', pkg: { name: 'app', dependencies: { core: 'workspace:*' } } },
        { dir: 'packages/core', pkg: { name: 'core' } }
      ]
    });
    roots.push(root);
    const { result } = wsChanged({
      cwd: root,
      overrides: { root, files: { ext: '.sql' } },
      changed: ['packages/core/deploy/x.sql', 'packages/app/src/x.ts']
    });
    expect(result.changed).toEqual(['core']);
    expect(result.ignored).toEqual(['packages/app/src/x.ts']);
    expect(result.extensionsByPackage).toEqual({ core: ['.sql'] });
  });

  it('flags a global-trigger change from config', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [{ dir: 'packages/a', pkg: { name: 'a' } }]
    });
    roots.push(root);
    const { result } = wsChanged({
      cwd: root,
      overrides: { root, global: ['pnpm-lock.yaml'] },
      changed: ['pnpm-lock.yaml']
    });
    expect(result.global).toBe(true);
  });
});
