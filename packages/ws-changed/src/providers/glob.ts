/**
 * The glob provider: plain directories as packages, with no dependency edges.
 *
 * For workspaces that are not pnpm and not pgpm — a directory of services, a
 * docs tree, anything you want change-mapped by path. Affected selection still
 * works (changed ∪ dependents), there are simply no edges, so `dependents` is
 * always empty and `affected === changed`. Add edges with a custom provider or
 * an edge provider on top.
 */
import { existsSync } from 'fs';
import { join } from 'path';

import { expandDirGlob, toRel } from '../glob';
import type { ProviderContext, WorkspacePackage, WorkspaceProvider } from '../types';
import { workspaceGlobs } from '../workspace-file';

export const globProvider: WorkspaceProvider = {
  name: 'glob',
  discover(ctx: ProviderContext): WorkspacePackage[] {
    const { root } = ctx;
    const globs = ctx.config.providers?.glob?.globs ?? workspaceGlobs(root);
    const dirs = new Set<string>();
    for (const glob of globs) for (const d of expandDirGlob(root, glob)) dirs.add(d);

    const packages: WorkspacePackage[] = [];
    for (const relDir of dirs) {
      const dir = join(root, relDir);
      if (!existsSync(dir)) continue;
      packages.push({
        name: relDir,
        dir,
        relDir: toRel(root, dir),
        requires: [],
        external: [],
        provider: 'glob'
      });
    }
    return packages;
  }
};
