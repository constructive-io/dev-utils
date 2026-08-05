/**
 * Read the workspace's package globs. pnpm keeps them in `pnpm-workspace.yaml`;
 * npm/yarn/lerna keep a `workspaces` array in `package.json` (or lerna.json).
 * Parsed by hand rather than with a YAML dependency — the shape is a flat
 * sequence of scalars, the one YAML shape worth hand-reading, and staying
 * dependency-free keeps ws-changed usable in the same bootstrap contexts
 * git-changed targets.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Package globs from `pnpm-workspace.yaml`'s `packages:` sequence, if present. */
export function pnpmWorkspaceGlobs(root: string): string[] | undefined {
  const file = join(root, 'pnpm-workspace.yaml');
  if (!existsSync(file)) return undefined;
  const yaml = readFileSync(file, 'utf-8');
  const globs: string[] = [];
  let inPackages = false;
  for (const line of yaml.split('\n')) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = line.match(/^\s+-\s+'?"?([^'"#\s]+)'?"?\s*(#.*)?$/);
    if (item) {
      globs.push(item[1]);
      continue;
    }
    // A blank/comment line is fine mid-sequence; a new unindented key ends it.
    if (line.trim() === '' || line.startsWith('#') || /^\s/.test(line)) continue;
    break;
  }
  return globs.length ? globs : undefined;
}

/** `workspaces` from package.json — an array, or `{ packages: [...] }`. */
export function packageJsonWorkspaceGlobs(root: string): string[] | undefined {
  const file = join(root, 'package.json');
  if (!existsSync(file)) return undefined;
  let pkg: unknown;
  try {
    pkg = JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return undefined;
  }
  const ws = (pkg as { workspaces?: unknown }).workspaces;
  if (Array.isArray(ws)) return (ws as unknown[]).filter((g): g is string => typeof g === 'string');
  if (ws && typeof ws === 'object' && Array.isArray((ws as { packages?: unknown }).packages)) {
    return ((ws as { packages: unknown[] }).packages).filter((g): g is string => typeof g === 'string');
  }
  return undefined;
}

/**
 * The workspace's package globs, from pnpm-workspace.yaml then package.json,
 * falling back to `packages/*` so a conventional layout works with no config.
 */
export function workspaceGlobs(root: string): string[] {
  return pnpmWorkspaceGlobs(root) ?? packageJsonWorkspaceGlobs(root) ?? ['packages/*'];
}
