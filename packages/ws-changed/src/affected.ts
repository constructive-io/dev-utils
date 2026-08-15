/**
 * The question this package exists to answer: given a set of changed files,
 * which workspace packages are affected? `affected = changed ∪ transitive
 * dependents`, plus a `global` short-circuit when a changed path matches a
 * configured global-trigger pattern (a lockfile, CI config).
 */
import { isAbsolute } from 'path';

import { extOf, makeMatcher, normalizeExts, toRel } from './glob';
import { WorkspaceGraph } from './graph';
import type { AffectedReason, AffectedResult, FileFilter, Workspace } from './types';

export interface AffectedParams {
  /** Changed paths — absolute, or relative to the workspace root. */
  changed: string[];
  /** Glob patterns (relative to root) that mean "everything is affected". */
  global?: string[];
  /**
   * Narrow the changed files before they are attributed to packages, by
   * extension and/or glob. A dropped file affects nothing and triggers no
   * `global` — the filter defines which files the question is about, so asking
   * "which packages have changed SQL" is not answered `true` by a lockfile.
   */
  files?: FileFilter;
}

/**
 * Compile a {@link FileFilter} into a predicate over relative paths. Order is
 * ext → include → exclude, and each clause is skipped when unset, so an empty
 * filter keeps everything.
 */
function fileFilter(filter: FileFilter | undefined): (rel: string) => boolean {
  const exts = normalizeExts(filter?.ext);
  const include = filter?.include?.length ? makeMatcher(filter.include) : undefined;
  const exclude = filter?.exclude?.length ? makeMatcher(filter.exclude) : undefined;
  if (!exts.length && !include && !exclude) return () => true;
  return (rel: string) => {
    if (exts.length && !exts.includes(extOf(rel))) return false;
    if (include && !include(rel)) return false;
    if (exclude && exclude(rel)) return false;
    return true;
  };
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
  const keep = fileFilter(params.files);
  const ignored: string[] = [];
  const extensions = new Set<string>();
  const extsByPkg = new Map<string, Set<string>>();

  const perPattern = globalPatterns.map((p) => ({ p, match: makeMatcher([p]) }));
  for (const raw of params.changed) {
    const rel = isAbsolute(raw) ? toRel(workspace.root, raw) : raw.split('\\').join('/');
    if (!keep(rel)) {
      ignored.push(rel);
      continue;
    }
    const ext = extOf(rel);
    if (ext) extensions.add(ext);
    if (globalPatterns.length && globalMatch(rel)) {
      // Record which pattern matched for the report; keep scanning so a mixed
      // changeset still lists its owning packages.
      for (const { p, match } of perPattern) if (match(rel)) globalMatches.add(p);
    }
    const owner = ownerOf(rel, packagesByRelDir);
    if (owner) {
      if (!changedPkgs.has(owner)) changedVia.set(owner, rel);
      changedPkgs.add(owner);
      if (ext) {
        const set = extsByPkg.get(owner) ?? new Set<string>();
        set.add(ext);
        extsByPkg.set(owner, set);
      }
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
    why,
    extensions: [...extensions].sort(),
    extensionsByPackage: Object.fromEntries(
      [...extsByPkg.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, set]) => [name, [...set].sort()])
    ),
    ignored: [...new Set(ignored)].sort()
  };
}
