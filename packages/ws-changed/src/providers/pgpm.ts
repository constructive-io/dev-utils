/**
 * The pgpm provider: PostgreSQL package-manager *modules* and the edges between
 * them. A module's directory carries a `<name>.control` whose `requires`
 * field lists the modules it depends on, and a `pgpm.plan` whose `%project`
 * header names the module. Edges to modules outside the workspace (`plpgsql`,
 * `pgpm-verify`, extensions) are recorded as external.
 *
 * This is the SQL-side answer to "which set of packages" — the same monorepo
 * seen as a deployment graph rather than a JavaScript dependency graph.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { expandDirGlob, toRel } from '../glob';
import type { ProviderContext, WorkspacePackage, WorkspaceProvider } from '../types';
import { workspaceGlobs } from '../workspace-file';

/** `%project=<name>` from a pgpm.plan, if present. */
function planProject(dir: string): string | undefined {
  const plan = join(dir, 'pgpm.plan');
  if (!existsSync(plan)) return undefined;
  for (const line of readFileSync(plan, 'utf-8').split('\n')) {
    const m = line.match(/^%project=(.+)$/);
    if (m) return m[1].trim();
  }
  return undefined;
}

/** The single `*.control` file in `dir`, if any. */
function controlFile(dir: string): string | undefined {
  let found: string | undefined;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.control')) {
      // Prefer a control whose stem matches the plan/dir; otherwise take the first.
      found = found ?? entry.name;
    }
  }
  return found;
}

/** Parse `requires = 'a,b,c'` from a `.control` file into a name list. */
function controlRequires(text: string): string[] {
  const m = text.match(/^\s*requires\s*=\s*'([^']*)'/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const pgpmProvider: WorkspaceProvider = {
  name: 'pgpm',
  discover(ctx: ProviderContext): WorkspacePackage[] {
    const { root } = ctx;
    const globs = ctx.config.providers?.pgpm?.globs ?? workspaceGlobs(root);
    const dirs = new Set<string>();
    for (const glob of globs) for (const d of expandDirGlob(root, glob)) dirs.add(d);

    interface Raw {
      name: string;
      relDir: string;
      requires: string[];
    }
    const raw: Raw[] = [];
    for (const relDir of dirs) {
      const dir = join(root, relDir);
      const control = controlFile(dir);
      if (!control) continue; // not a pgpm module
      const name = planProject(dir) ?? control.replace(/\.control$/, '');
      const requires = controlRequires(readFileSync(join(dir, control), 'utf-8'));
      raw.push({ name, relDir, requires });
    }

    const names = new Set(raw.map((r) => r.name));
    return raw.map((r) => {
      const internal: string[] = [];
      const external: string[] = [];
      for (const dep of r.requires) {
        (names.has(dep) ? internal : external).push(dep);
      }
      return {
        name: r.name,
        dir: join(root, r.relDir),
        relDir: toRel(root, join(root, r.relDir)),
        requires: internal.sort(),
        external: external.sort(),
        provider: 'pgpm'
      };
    });
  }
};
