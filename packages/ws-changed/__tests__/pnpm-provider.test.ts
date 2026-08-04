import { rmSync } from 'fs';

import { pnpmProvider } from '../src/providers/pnpm';
import type { WorkspacePackage } from '../src/types';
import { buildWorkspace } from './support/build-workspace';

function discover(root: string, config = {}): Map<string, WorkspacePackage> {
  const pkgs = pnpmProvider.discover({ root, config });
  return new Map(pkgs.map((p) => [p.name, p]));
}

describe('pnpm provider', () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  it('recognizes every workspace: protocol variant as an internal edge', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/star', pkg: { name: 'star', dependencies: { core: 'workspace:*' } } },
        { dir: 'packages/caret', pkg: { name: 'caret', dependencies: { core: 'workspace:^' } } },
        { dir: 'packages/tilde', pkg: { name: 'tilde', dependencies: { core: 'workspace:~' } } },
        { dir: 'packages/caretver', pkg: { name: 'caretver', dependencies: { core: 'workspace:^1.2.3' } } },
        { dir: 'packages/tildever', pkg: { name: 'tildever', dependencies: { core: 'workspace:~1.2.3' } } },
        { dir: 'packages/exact', pkg: { name: 'exact', dependencies: { core: 'workspace:1.2.3' } } },
        { dir: 'packages/core', pkg: { name: 'core' } }
      ]
    });
    roots.push(root);
    const pkgs = discover(root);
    for (const name of ['star', 'caret', 'tilde', 'caretver', 'tildever', 'exact']) {
      expect(pkgs.get(name)!.requires).toEqual(['core']);
    }
  });

  it('treats a bare semver range as internal when the name is a workspace package', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/app', pkg: { name: 'app', dependencies: { lib: '^1.0.0', lodash: '^4.0.0' } } },
        { dir: 'packages/lib', pkg: { name: 'lib' } }
      ]
    });
    roots.push(root);
    const pkgs = discover(root);
    expect(pkgs.get('app')!.requires).toEqual(['lib']);
    expect(pkgs.get('app')!.external).toEqual(['lodash']);
  });

  it('collects edges from every dependency field by default', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        {
          dir: 'packages/app',
          pkg: {
            name: 'app',
            dependencies: { prodlib: 'workspace:*' },
            devDependencies: { devlib: 'workspace:*' },
            peerDependencies: { peerlib: 'workspace:*' },
            optionalDependencies: { optlib: 'workspace:*' }
          }
        },
        { dir: 'packages/prodlib', pkg: { name: 'prodlib' } },
        { dir: 'packages/devlib', pkg: { name: 'devlib' } },
        { dir: 'packages/peerlib', pkg: { name: 'peerlib' } },
        { dir: 'packages/optlib', pkg: { name: 'optlib' } }
      ]
    });
    roots.push(root);
    const pkgs = discover(root);
    expect(pkgs.get('app')!.requires).toEqual(['devlib', 'optlib', 'peerlib', 'prodlib']);
  });

  it('honours an edgeKinds filter (prod only)', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        {
          dir: 'packages/app',
          pkg: {
            name: 'app',
            dependencies: { prodlib: 'workspace:*' },
            devDependencies: { devlib: 'workspace:*' }
          }
        },
        { dir: 'packages/prodlib', pkg: { name: 'prodlib' } },
        { dir: 'packages/devlib', pkg: { name: 'devlib' } }
      ]
    });
    roots.push(root);
    const pkgs = discover(root, { providers: { pnpm: { edgeKinds: ['prod'] } } });
    expect(pkgs.get('app')!.requires).toEqual(['prodlib']);
  });

  it('records the version spec in meta', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/app', pkg: { name: 'app', dependencies: { core: 'workspace:^1.2.3' } } },
        { dir: 'packages/core', pkg: { name: 'core' } }
      ]
    });
    roots.push(root);
    const pkgs = discover(root);
    expect((pkgs.get('app')!.meta!.specs as Record<string, string>).core).toBe('workspace:^1.2.3');
  });
});
