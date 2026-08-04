/**
 * The dependency graph over a workspace's packages: forward edges (what a
 * package requires) and reverse edges (what depends on it), with transitive
 * closures and a topological sort. This is the machinery Lerna/`pnpm --filter`
 * hide behind `...[ref]`; here it is explicit and inspectable.
 */
import type { Workspace, WorkspacePackage } from './types';

export class WorkspaceGraph {
  readonly workspace: Workspace;
  private readonly byName = new Map<string, WorkspacePackage>();
  /** name -> direct requires (in-workspace only). */
  private readonly forward = new Map<string, string[]>();
  /** name -> direct dependents. */
  private readonly reverse = new Map<string, string[]>();

  constructor(workspace: Workspace) {
    this.workspace = workspace;
    for (const pkg of workspace.packages) {
      this.byName.set(pkg.name, pkg);
      this.forward.set(pkg.name, []);
      this.reverse.set(pkg.name, []);
    }
    for (const pkg of workspace.packages) {
      for (const dep of pkg.requires) {
        if (!this.byName.has(dep)) continue; // defensive: skip dangling edges
        this.forward.get(pkg.name)!.push(dep);
        this.reverse.get(dep)!.push(pkg.name);
      }
    }
  }

  /** Every package name, sorted. */
  names(): string[] {
    return [...this.byName.keys()].sort();
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  get(name: string): WorkspacePackage | undefined {
    return this.byName.get(name);
  }

  /** Direct dependencies of `name` (in-workspace). */
  dependencies(name: string): string[] {
    return [...(this.forward.get(name) ?? [])].sort();
  }

  /** Direct dependents of `name`. */
  dependents(name: string): string[] {
    return [...(this.reverse.get(name) ?? [])].sort();
  }

  /** Transitive dependencies of `name` (not including `name`). */
  transitiveDependencies(name: string): string[] {
    return this.closure([name], this.forward, false);
  }

  /** Transitive dependents of `name` (not including `name`). */
  transitiveDependents(name: string): string[] {
    return this.closure([name], this.reverse, false);
  }

  /**
   * The set reachable from `seed` through `edges`, breadth-first, excluding the
   * seed names themselves (a seed reappears only if a cycle leads back to it).
   * `includeSeed` keeps the starting names in the result.
   */
  private closure(
    seed: string[],
    edges: Map<string, string[]>,
    includeSeed: boolean
  ): string[] {
    const seen = new Set<string>();
    const queue = [...seed];
    while (queue.length) {
      const name = queue.shift()!;
      for (const next of edges.get(name) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    if (includeSeed) for (const s of seed) seen.add(s);
    return [...seen].sort();
  }

  /**
   * Dependents of every name in `seed`, seed included — the affected closure.
   * Returned with a BFS layer so callers can explain the path.
   */
  affectedFrom(seed: string[]): { names: Set<string>; via: Map<string, string> } {
    const names = new Set<string>(seed.filter((s) => this.byName.has(s)));
    const via = new Map<string, string>();
    const queue = [...names];
    while (queue.length) {
      const name = queue.shift()!;
      for (const dependent of this.reverse.get(name) ?? []) {
        if (!names.has(dependent)) {
          names.add(dependent);
          via.set(dependent, name);
          queue.push(dependent);
        }
      }
    }
    return { names, via };
  }

  /**
   * Topological order (dependencies before dependents). Throws on a cycle,
   * naming the packages involved — a workspace cycle is a real bug, not
   * something to silently linearize.
   */
  topoSort(): string[] {
    const result: string[] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const stack: string[] = [];

    const visit = (name: string): void => {
      const s = state.get(name);
      if (s === 'done') return;
      if (s === 'visiting') {
        const cycle = [...stack.slice(stack.indexOf(name)), name].join(' -> ');
        throw new Error(`Dependency cycle: ${cycle}`);
      }
      state.set(name, 'visiting');
      stack.push(name);
      for (const dep of this.dependencies(name)) visit(dep);
      stack.pop();
      state.set(name, 'done');
      result.push(name);
    };

    for (const name of this.names()) visit(name);
    return result;
  }
}
