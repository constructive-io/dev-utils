import { rmSync } from 'fs';

import { getProvider, providerNames, registerProvider } from '../src/registry';
import type { ProviderContext, WorkspacePackage } from '../src/types';
import { loadWorkspace } from '../src/workspace';
import { buildWorkspace, writePgpmModule } from './support/build-workspace';

describe('loadWorkspace', () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  function load(root: string, overrides = {}) {
    return loadWorkspace({ cwd: root, overrides: { root, ...overrides } }).workspace;
  }

  it('discovers pnpm packages by default', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/app', pkg: { name: 'app', dependencies: { lib: 'workspace:*' } } },
        { dir: 'packages/lib', pkg: { name: 'lib' } }
      ]
    });
    roots.push(root);
    const ws = load(root);
    expect(ws.packages.map((p) => p.name)).toEqual(['app', 'lib']);
  });

  it('composes multiple providers, unioning edges on shared nodes', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [
        { dir: 'packages/a', pkg: { name: 'mod-a', dependencies: { 'mod-b': 'workspace:*' } } },
        { dir: 'packages/b', pkg: { name: 'mod-b' } }
      ]
    });
    roots.push(root);
    // Same dirs also carry pgpm modules with a reversed extra edge.
    writePgpmModule(root, 'packages/a', 'mod-a', []);
    writePgpmModule(root, 'packages/b', 'mod-b', ['mod-a']);

    const ws = load(root, { provider: ['pnpm', 'pgpm'] });
    const byName = new Map(ws.packages.map((p) => [p.name, p]));
    expect(byName.get('mod-a')!.requires).toEqual(['mod-b']); // from pnpm
    expect(byName.get('mod-b')!.requires).toEqual(['mod-a']); // from pgpm
    expect(byName.get('mod-a')!.provider).toContain('+');
  });

  it('applies include/exclude filters', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*', 'apps/*'],
      packages: [
        { dir: 'packages/a', pkg: { name: 'a' } },
        { dir: 'apps/web', pkg: { name: 'web' } }
      ]
    });
    roots.push(root);
    expect(load(root, { include: ['packages/**'] }).packages.map((p) => p.name)).toEqual(['a']);
    expect(load(root, { exclude: ['apps/**'] }).packages.map((p) => p.name)).toEqual(['a']);
  });

  it('throws on an unknown provider', () => {
    const root = buildWorkspace({ pnpmGlobs: ['packages/*'], packages: [] });
    roots.push(root);
    expect(() => load(root, { provider: 'nope' })).toThrow(/Unknown workspace provider/);
  });

  it('supports a custom registered provider', () => {
    const custom = {
      name: 'custom-test',
      discover(_ctx: ProviderContext): WorkspacePackage[] {
        return [{ name: 'z', dir: '/r/z', relDir: 'z', requires: [], external: [], provider: 'custom-test' }];
      }
    };
    registerProvider(custom);
    expect(getProvider('custom-test')).toBe(custom);
    expect(providerNames()).toContain('custom-test');

    const root = buildWorkspace({ pnpmGlobs: ['packages/*'], packages: [] });
    roots.push(root);
    const ws = load(root, { provider: 'custom-test' });
    expect(ws.packages.map((p) => p.name)).toEqual(['z']);
  });
});
