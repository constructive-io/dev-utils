import { rmSync } from 'fs';

import { pgpmProvider } from '../src/providers/pgpm';
import { buildWorkspace, writePgpmModule } from './support/build-workspace';

describe('pgpm provider', () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  it('reads module names and requires from control files, splitting internal vs external', () => {
    const root = buildWorkspace({ pnpmGlobs: ['packages/*'], packages: [] });
    roots.push(root);
    writePgpmModule(root, 'packages/a', 'mod-a', ['mod-b', 'plpgsql', 'pgpm-verify']);
    writePgpmModule(root, 'packages/b', 'mod-b', []);

    const pkgs = new Map(pgpmProvider.discover({ root, config: {} }).map((p) => [p.name, p]));
    expect([...pkgs.keys()].sort()).toEqual(['mod-a', 'mod-b']);
    expect(pkgs.get('mod-a')!.requires).toEqual(['mod-b']);
    expect(pkgs.get('mod-a')!.external).toEqual(['pgpm-verify', 'plpgsql']);
    expect(pkgs.get('mod-a')!.provider).toBe('pgpm');
  });

  it('ignores directories with no control file', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*'],
      packages: [{ dir: 'packages/js-only', pkg: { name: 'js-only' } }]
    });
    roots.push(root);
    writePgpmModule(root, 'packages/mod', 'mod', []);
    const pkgs = pgpmProvider.discover({ root, config: {} });
    expect(pkgs.map((p) => p.name)).toEqual(['mod']);
  });

  it('uses %project from pgpm.plan as the module identity, over the control stem', () => {
    const root = buildWorkspace({ pnpmGlobs: ['packages/*'], packages: [] });
    roots.push(root);
    const { mkdirSync, writeFileSync } = require('fs');
    const { join } = require('path');
    const dir = join(root, 'packages/x');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'stem-name.control'), "default_version = '0.0.1'\nrequires = ''\n");
    writeFileSync(join(dir, 'pgpm.plan'), '%syntax-version=1.0.0\n%project=plan-name\n');
    const pkgs = pgpmProvider.discover({ root, config: {} });
    expect(pkgs.map((p) => p.name)).toEqual(['plan-name']);
  });
});
