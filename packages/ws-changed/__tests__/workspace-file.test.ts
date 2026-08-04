import { rmSync } from 'fs';

import {
  packageJsonWorkspaceGlobs,
  pnpmWorkspaceGlobs,
  workspaceGlobs
} from '../src/workspace-file';
import { buildWorkspace } from './support/build-workspace';

describe('workspace globs', () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  it('reads pnpm-workspace.yaml packages', () => {
    const root = buildWorkspace({
      pnpmGlobs: ['packages/*', 'apps/*'],
      packages: [{ dir: 'packages/a' }]
    });
    roots.push(root);
    expect(pnpmWorkspaceGlobs(root)).toEqual(['packages/*', 'apps/*']);
  });

  it('reads a package.json workspaces array', () => {
    const root = buildWorkspace({
      workspaces: ['packages/*', 'tools/*'],
      packages: [{ dir: 'packages/a' }]
    });
    roots.push(root);
    expect(packageJsonWorkspaceGlobs(root)).toEqual(['packages/*', 'tools/*']);
  });

  it('prefers pnpm-workspace.yaml, then package.json, then packages/*', () => {
    const withPnpm = buildWorkspace({ pnpmGlobs: ['x/*'], packages: [] });
    const withPkg = buildWorkspace({ workspaces: ['y/*'], packages: [] });
    const bare = buildWorkspace({ packages: [] });
    roots.push(withPnpm, withPkg, bare);
    expect(workspaceGlobs(withPnpm)).toEqual(['x/*']);
    expect(workspaceGlobs(withPkg)).toEqual(['y/*']);
    expect(workspaceGlobs(bare)).toEqual(['packages/*']);
  });

  it('ignores comments and blank lines in the yaml sequence', () => {
    const root = buildWorkspace({ packages: [] });
    roots.push(root);
    // Overwrite with a commented sequence.
    require('fs').writeFileSync(
      require('path').join(root, 'pnpm-workspace.yaml'),
      "packages:\n  # a comment\n  - 'packages/*'\n\n  - 'apps/*' # trailing\n"
    );
    expect(pnpmWorkspaceGlobs(root)).toEqual(['packages/*', 'apps/*']);
  });
});
