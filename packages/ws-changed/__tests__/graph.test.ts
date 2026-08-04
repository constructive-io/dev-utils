import { WorkspaceGraph } from '../src/graph';
import type { Workspace, WorkspacePackage } from '../src/types';

function pkg(name: string, requires: string[] = []): WorkspacePackage {
  return { name, dir: `/r/${name}`, relDir: name, requires, external: [], provider: 'test' };
}

function ws(packages: WorkspacePackage[]): Workspace {
  return { root: '/r', providers: ['test'], packages };
}

describe('WorkspaceGraph', () => {
  //   d -> c -> a
  //        c -> b
  const graph = new WorkspaceGraph(
    ws([pkg('a'), pkg('b'), pkg('c', ['a', 'b']), pkg('d', ['c'])])
  );

  it('reports direct dependencies and dependents', () => {
    expect(graph.dependencies('c')).toEqual(['a', 'b']);
    expect(graph.dependents('a')).toEqual(['c']);
    expect(graph.dependents('c')).toEqual(['d']);
  });

  it('reports transitive dependencies and dependents', () => {
    expect(graph.transitiveDependencies('d')).toEqual(['a', 'b', 'c']);
    expect(graph.transitiveDependents('a')).toEqual(['c', 'd']);
  });

  it('drops dangling edges to unknown packages', () => {
    const g = new WorkspaceGraph(ws([pkg('a', ['ghost'])]));
    expect(g.dependencies('a')).toEqual([]);
  });

  it('produces a topological order with dependencies first', () => {
    const order = graph.topoSort();
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('is deterministic across runs', () => {
    expect(graph.topoSort()).toEqual(graph.topoSort());
  });

  it('throws a readable cycle path', () => {
    const cyclic = new WorkspaceGraph(ws([pkg('x', ['y']), pkg('y', ['x'])]));
    expect(() => cyclic.topoSort()).toThrow(/Dependency cycle: .*->/);
  });

  it('computes the affected closure from a seed with reasons', () => {
    const { names, via } = graph.affectedFrom(['a']);
    expect([...names].sort()).toEqual(['a', 'c', 'd']);
    expect(via.get('c')).toBe('a');
    expect(via.get('d')).toBe('c');
  });
});
