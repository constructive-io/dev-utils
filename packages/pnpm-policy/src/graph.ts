/**
 * The dependency graph a lockfile describes.
 *
 * `readLockfilePackages` answers "what is resolved here", which is the right
 * question for an exemption list. This answers a narrower one: "what is resolved
 * *because of* these packages" — the subtree under a set of roots.
 *
 * That distinction matters when deciding what to trust. A workspace resolving
 * 1300 packages is not making 1300 trust decisions; it is making a few, and
 * inheriting the rest. Asking which packages hang off `postgraphile` tells you
 * what a decision to depend on `postgraphile` actually dragged in.
 *
 * Versions are collapsed to names deliberately. Two copies of a package are two
 * copies of the same trust decision, and an exemption list is keyed by name.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

import { PolicyError } from './errors';
import { LOCKFILE_NAME, packageNameFromLockKey } from './lockfile';

type DependencyBlock = Record<string, unknown> | undefined;

interface ImporterShape {
  dependencies?: DependencyBlock;
  devDependencies?: DependencyBlock;
  optionalDependencies?: DependencyBlock;
}

interface SnapshotShape {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface LockfileShape {
  importers?: Record<string, ImporterShape>;
  snapshots?: Record<string, SnapshotShape>;
  packages?: Record<string, unknown>;
}

export interface DependencyGraph {
  /** Everything the workspace's own package.json files ask for directly. */
  roots: Set<string>;
  /** package name -> the names it depends on. */
  edges: Map<string, Set<string>>;
}

function addEdges(edges: Map<string, Set<string>>, from: string, to: Iterable<string>): void {
  const existing = edges.get(from) ?? new Set<string>();
  for (const name of to) existing.add(name);
  edges.set(from, existing);
}

/** Read a pnpm lockfile into a name-keyed dependency graph. */
export function readLockfileGraph(lockfilePath: string): DependencyGraph {
  if (!existsSync(lockfilePath)) {
    throw new PolicyError(`No ${LOCKFILE_NAME} at ${lockfilePath}. Run pnpm install first.`);
  }

  const lockfile = parseYaml(readFileSync(lockfilePath, 'utf-8')) as LockfileShape | null;
  const roots = new Set<string>();
  const edges = new Map<string, Set<string>>();

  for (const importer of Object.values(lockfile?.importers ?? {})) {
    for (const block of [
      importer.dependencies,
      importer.devDependencies,
      importer.optionalDependencies
    ]) {
      for (const name of Object.keys(block ?? {})) roots.add(name);
    }
  }

  for (const [key, snapshot] of Object.entries(lockfile?.snapshots ?? {})) {
    const from = packageNameFromLockKey(key);
    if (!from) continue;
    const to = [
      ...Object.keys(snapshot?.dependencies ?? {}),
      ...Object.keys(snapshot?.optionalDependencies ?? {})
    ];
    addEdges(edges, from, to);
  }

  return { roots, edges };
}

/**
 * Every package reachable from `from`, including the starting names themselves.
 *
 * Cycles are common in a real tree, so visited names are never re-expanded.
 */
export function reachableFrom(graph: DependencyGraph, from: Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const queue = [...from];

  while (queue.length) {
    const name = queue.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const next of graph.edges.get(name) ?? []) {
      if (!seen.has(next)) queue.push(next);
    }
  }

  return seen;
}

/** Convenience: the graph for the lockfile beside a workspace root. */
export function readWorkspaceGraph(workspaceDir: string): DependencyGraph {
  return readLockfileGraph(join(workspaceDir, LOCKFILE_NAME));
}
