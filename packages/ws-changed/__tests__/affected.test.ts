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

  it('reports the extensions in the changeset, and per changed package', () => {
    const r = affected(workspace, {
      changed: ['packages/core/deploy/x.sql', 'packages/core/src/x.ts', 'packages/lib/README.md']
    });
    expect(r.extensions).toEqual(['.md', '.sql', '.ts']);
    expect(r.extensionsByPackage).toEqual({ core: ['.sql', '.ts'], lib: ['.md'] });
  });

  it('leaves dependents out of extensionsByPackage — they own no changed file', () => {
    const r = affected(workspace, { changed: ['packages/core/x.sql'] });
    expect(r.packages).toEqual(['app', 'core', 'lib']);
    expect(Object.keys(r.extensionsByPackage)).toEqual(['core']);
  });

  it('explains why each package is affected', () => {
    const r = affected(workspace, { changed: ['packages/core/x.ts'] });
    const byName = new Map(r.why.map((w) => [w.package, w]));
    expect(byName.get('core')).toMatchObject({ kind: 'changed', via: 'packages/core/x.ts' });
    expect(byName.get('lib')).toMatchObject({ kind: 'dependent', via: 'core' });
    expect(byName.get('app')).toMatchObject({ kind: 'dependent', via: 'lib' });
  });
});

describe('affected — file filter', () => {
  it('keeps only the named extensions, and reports the rest as ignored', () => {
    const r = affected(workspace, {
      changed: ['packages/core/deploy/x.sql', 'packages/lib/src/x.ts'],
      files: { ext: '.sql' }
    });
    expect(r.changed).toEqual(['core']);
    expect(r.packages).toEqual(['app', 'core', 'lib']);
    expect(r.ignored).toEqual(['packages/lib/src/x.ts']);
    expect(r.extensions).toEqual(['.sql']);
  });

  it('accepts an extension with or without a dot, in any case, comma-joined', () => {
    const changed = ['packages/lib/a.SQL', 'packages/app/b.tsx', 'packages/core/c.md'];
    expect(affected(workspace, { changed, files: { ext: 'sql' } }).changed).toEqual(['lib']);
    expect(affected(workspace, { changed, files: { ext: ['.sql', 'tsx'] } }).changed).toEqual([
      'app',
      'lib'
    ]);
    expect(affected(workspace, { changed, files: { ext: 'sql,tsx' } }).changed).toEqual(['app', 'lib']);
  });

  it('treats an extensionless file and a dotfile as having no extension', () => {
    const changed = ['packages/lib/Makefile', 'packages/app/.gitignore'];
    const all = affected(workspace, { changed });
    expect(all.changed).toEqual(['app', 'lib']);
    expect(all.extensions).toEqual([]);
    // Nothing can match an ext filter, so neither package is selected.
    expect(affected(workspace, { changed, files: { ext: '.ts' } }).changed).toEqual([]);
  });

  it('filters by include and exclude globs', () => {
    const changed = ['packages/lib/src/x.ts', 'packages/lib/generated/y.ts'];
    expect(
      affected(workspace, { changed, files: { exclude: ['**/generated/**'] } }).changed
    ).toEqual(['lib']);
    expect(
      affected(workspace, { changed, files: { exclude: ['**/generated/**'] } }).ignored
    ).toEqual(['packages/lib/generated/y.ts']);
    expect(affected(workspace, { changed, files: { include: ['**/generated/**'] } }).ignored).toEqual([
      'packages/lib/src/x.ts'
    ]);
  });

  it('does not let a filtered-out file trigger the global short-circuit', () => {
    // The lockfile means "everything" only for a question its extension is part
    // of: a SQL lane asking about .sql must not be globalized by pnpm-lock.yaml.
    const params = { changed: ['pnpm-lock.yaml'], global: ['pnpm-lock.yaml'] };
    expect(affected(workspace, params).global).toBe(true);
    expect(affected(workspace, { ...params, files: { ext: '.sql' } }).global).toBe(false);
    expect(affected(workspace, { ...params, files: { ext: '.sql' } }).ignored).toEqual([
      'pnpm-lock.yaml'
    ]);
  });

  it('drops a filtered-out root change from rootChanged', () => {
    const r = affected(workspace, {
      changed: ['README.md', 'tsconfig.json'],
      files: { ext: '.json' }
    });
    expect(r.rootChanged).toEqual(['tsconfig.json']);
    expect(r.ignored).toEqual(['README.md']);
  });

  it('an empty filter keeps everything', () => {
    const changed = ['packages/lib/x.ts', 'README.md'];
    const r = affected(workspace, { changed, files: { ext: [], include: [], exclude: [] } });
    expect(r.changed).toEqual(['lib']);
    expect(r.rootChanged).toEqual(['README.md']);
    expect(r.ignored).toEqual([]);
  });

  it('filters absolute paths too', () => {
    const r = affected(workspace, {
      changed: ['/r/packages/lib/x.sql', '/r/packages/app/x.ts'],
      files: { ext: '.sql' }
    });
    expect(r.changed).toEqual(['lib']);
    expect(r.ignored).toEqual(['packages/app/x.ts']);
  });
});
