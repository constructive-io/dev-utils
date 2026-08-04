/**
 * The question this package exists to answer: given a set of changed files,
 * which workspace packages are affected? `affected = changed ∪ transitive
 * dependents`, plus a `global` short-circuit when a changed path matches a
 * configured global-trigger pattern (a lockfile, CI config).
 */
import { isAbsolute } from 'path';

import { makeMatcher, toRel } from './glob';
import { WorkspaceGraph } from './graph';
import type { AffectedReason, AffectedResult, Workspace } from './types';

export interface AffectedParams {
  /** Changed paths — absolute, or relative to the workspace root. */
  changed: string[];
  /** Glob patterns (relative to root) that mean "everything is affected". */
  global?: string[];
}

/** Map a changed path to the workspace package that owns it (longest relDir prefix). */
function ownerOf(relPath: string, packagesByRelDir: Array<{ name: string; relDir: string }>): string | undefined {
  let best: { name: string; relDir: string } | undefined;
  for (const pkg of packagesByRelDir) {
    // Root package (relDir === '') owns everything not owned by a deeper dir;
    // only accept it as a last resort so it never shadows a real subpackage.
    const prefix = pkg.relDir === '' ? '' : `${pkg.relDir}/`;
    if (prefix === '' || relPath === pkg.relDir || relPath.startsWith(prefix)) {
      if (!best || pkg.relDir.length > best.relDir.length) best = pkg;
    }
  }
  return best?.name;
}

/**
 * Compute the affected set for a workspace.
 *
 * ```ts
 * const { workspace } = loadWorkspace();
 * const result = affected(workspace, {
 *   changed: changedPaths({ base: 'origin/main' }),
 *   global: ['pnpm-lock.yaml', '.github/**']
 * });
 * ```
 */
export function affected(workspace: Workspace, params: AffectedParams): AffectedResult {
  const graph = new WorkspaceGraph(workspace);
  const packagesByRelDir = workspace.packages.map((p) => ({ name: p.name, relDir: p.relDir }));

  const globalPatterns = params.global ?? [];
  const globalMatch = makeMatcher(globalPatterns);
  const globalMatches = new Set<string>();

  const changedPkgs = new Set<string>();
  const rootChanged: string[] = [];
  const changedVia = new Map<string, string>();

  const perPattern = globalPatterns.map((p) => ({ p, match: makeMatcher([p]) }));
  for (const raw of params.changed) {
    const rel = isAbsolute(raw) ? toRel(workspace.root, raw) : raw.split('\\').join('/');
    if (globalPatterns.length && globalMatch(rel)) {
      // Record which pattern matched for the report; keep scanning so a mixed
      // changeset still lists its owning packages.
      for (const { p, match } of perPattern) if (match(rel)) globalMatches.add(p);
    }
    const owner = ownerOf(rel, packagesByRelDir);
    if (owner) {
      if (!changedPkgs.has(owner)) changedVia.set(owner, rel);
      changedPkgs.add(owner);
    } else {
      rootChanged.push(rel);
    }
  }

  const { names, via } = graph.affectedFrom([...changedPkgs]);

  const why: AffectedReason[] = [];
  for (const name of [...names].sort()) {
    if (changedPkgs.has(name)) {
      why.push({ package: name, kind: 'changed', via: changedVia.get(name) ?? '' });
    } else {
      why.push({ package: name, kind: 'dependent', via: via.get(name) ?? '' });
    }
  }

  return {
    packages: [...names].sort(),
    changed: [...changedPkgs].sort(),
    rootChanged: [...new Set(rootChanged)].sort(),
    global: globalMatches.size > 0,
    globalMatches: [...globalMatches].sort(),
    why
  };
}
