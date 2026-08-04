import { affected } from '../src/affected';
import type { Workspace, WorkspacePackage } from '../src/types';

function pkg(name: string, relDir: string, requires: string[] = []): WorkspacePackage {
  return { name, dir: `/r/${relDir}`, relDir, requires, external: [], provider: 'test' };
}

//   packages/app -> packages/lib -> packages/core
const workspace: Workspace = {
  root: '/r',
  providers: ['test'],
  packages: [
    pkg('core', 'packages/core'),
    pkg('lib', 'packages/lib', ['core']),
    pkg('app', 'packages/app', ['lib'])
  ]
};

describe('affected', () => {
  it('maps a changed file to its owning package', () => {
    const r = affected(workspace, { changed: ['packages/app/src/index.ts'] });
    expect(r.changed).toEqual(['app']);
  });

  it('includes transitive dependents of a changed package', () => {
    const r = affected(workspace, { changed: ['packages/core/src/x.ts'] });
    expect(r.packages).toEqual(['app', 'core', 'lib']);
    expect(r.changed).toEqual(['core']);
  });

  it('does not pull in dependencies, only dependents', () => {
    const r = affected(workspace, { changed: ['packages/app/src/x.ts'] });
    expect(r.packages).toEqual(['app']);
  });

  it('reports root/unowned changes separately', () => {
    const r = affected(workspace, { changed: ['README.md', 'packages/lib/x.ts'] });
    expect(r.rootChanged).toEqual(['README.md']);
    expect(r.changed).toEqual(['lib']);
    expect(r.packages).toEqual(['app', 'lib']);
  });

  it('maps by longest matching directory (nested packages)', () => {
    const nested: Workspace = {
      root: '/r',
      providers: ['test'],
      packages: [pkg('outer', 'packages'), pkg('inner', 'packages/inner')]
    };
    const r = affected(nested, { changed: ['packages/inner/file.ts'] });
    expect(r.changed).toEqual(['inner']);
  });

  it('flags a global-trigger change', () => {
    const r = affected(workspace, {
      changed: ['pnpm-lock.yaml'],
      global: ['pnpm-lock.yaml', '.github/**']
    });
    expect(r.global).toBe(true);
    expect(r.globalMatches).toEqual(['pnpm-lock.yaml']);
  });

  it('accepts absolute paths', () => {
    const r = affected(workspace, { changed: ['/r/packages/lib/index.ts'] });
    expect(r.changed).toEqual(['lib']);
  });

  it('explains why each package is affected', () => {
    const r = affected(workspace, { changed: ['packages/core/x.ts'] });
    const byName = new Map(r.why.map((w) => [w.package, w]));
    expect(byName.get('core')).toMatchObject({ kind: 'changed', via: 'packages/core/x.ts' });
    expect(byName.get('lib')).toMatchObject({ kind: 'dependent', via: 'core' });
    expect(byName.get('app')).toMatchObject({ kind: 'dependent', via: 'lib' });
  });
});
