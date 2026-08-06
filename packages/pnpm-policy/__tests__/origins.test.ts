import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  groupByOwner,
  namesFromOwners,
  packageOrigins,
  reachableFrom,
  readLockfileGraph,
  repositorySlug
} from '../src';

describe('repositorySlug', () => {
  it('handles the shapes a repository field actually takes', () => {
    expect(repositorySlug('git+https://github.com/graphile/crystal.git')).toBe('graphile/crystal');
    expect(repositorySlug('https://github.com/graphile/crystal')).toBe('graphile/crystal');
    expect(repositorySlug('git@github.com:graphile/crystal.git')).toBe('graphile/crystal');
    expect(repositorySlug('ssh://git@github.com/graphile/crystal.git')).toBe('graphile/crystal');
    expect(repositorySlug('graphile/crystal')).toBe('graphile/crystal');
  });

  it('lowercases, so owner comparisons are not case-sensitive', () => {
    expect(repositorySlug('https://github.com/GraphQL/graphql-js')).toBe('graphql/graphql-js');
  });

  it('is undefined when there is nothing usable', () => {
    expect(repositorySlug(undefined)).toBeUndefined();
    expect(repositorySlug('not a url')).toBeUndefined();
  });
});

const LOCKFILE = `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      postgraphile:
        specifier: ^5.0.0
        version: 5.0.0
    devDependencies:
      jest:
        specifier: ^30.0.0
        version: 30.0.0

snapshots:
  postgraphile@5.0.0:
    dependencies:
      grafast: 1.0.0
      graphql: 16.0.0
  grafast@1.0.0:
    dependencies:
      graphql: 16.0.0
      tamedevil: 1.0.0
  tamedevil@1.0.0: {}
  graphql@16.0.0: {}
  jest@30.0.0:
    dependencies:
      chalk: 5.0.0
  chalk@5.0.0: {}
`;

function lockfile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pnpm-policy-graph-'));
  writeFileSync(join(dir, 'pnpm-lock.yaml'), LOCKFILE);
  return join(dir, 'pnpm-lock.yaml');
}

describe('readLockfileGraph', () => {
  it('reads direct dependencies as roots, dev included', () => {
    const graph = readLockfileGraph(lockfile());
    expect([...graph.roots].sort()).toEqual(['jest', 'postgraphile']);
  });

  it('maps each package to what it depends on', () => {
    const graph = readLockfileGraph(lockfile());
    expect([...(graph.edges.get('postgraphile') ?? [])].sort()).toEqual(['grafast', 'graphql']);
  });
});

describe('reachableFrom', () => {
  it('returns the subtree under a dependency, not the whole lockfile', () => {
    const graph = readLockfileGraph(lockfile());
    const under = reachableFrom(graph, ['postgraphile']);
    expect([...under].sort()).toEqual(['grafast', 'graphql', 'postgraphile', 'tamedevil']);
    // jest is a root too, but nothing under postgraphile pulls it in.
    expect(under.has('jest')).toBe(false);
    expect(under.has('chalk')).toBe(false);
  });

  it('terminates on a cycle', () => {
    const graph = {
      roots: new Set(['a']),
      edges: new Map([
        ['a', new Set(['b'])],
        ['b', new Set(['a'])]
      ])
    };
    expect([...reachableFrom(graph, ['a'])].sort()).toEqual(['a', 'b']);
  });
});

describe('packageOrigins', () => {
  const packuments: Record<string, unknown> = {
    grafast: { repository: { url: 'git+https://github.com/graphile/crystal.git' } },
    graphql: { repository: { url: 'git+https://github.com/graphql/graphql-js.git' } },
    // repository only on the latest version, as older publishes sometimes do
    ruru: {
      'dist-tags': { latest: '2.0.0' },
      versions: { '2.0.0': { repository: 'https://github.com/graphile/crystal' } }
    }
  };

  const stub = (async (url: string) => {
    const name = decodeURIComponent(url.split('/').pop() as string);
    const body = packuments[name];
    return body
      ? { ok: true, json: async () => body }
      : { ok: false, status: 404, json: async () => ({}) };
  }) as unknown as typeof fetch;

  it('resolves owners, including a repository found only on the latest version', async () => {
    const origins = await packageOrigins(['grafast', 'graphql', 'ruru'], { fetchImpl: stub });
    expect(origins.map((o) => o.owner)).toEqual(['graphile', 'graphql', 'graphile']);
  });

  it('reports an unknown package instead of aborting the survey', async () => {
    const origins = await packageOrigins(['grafast', 'nope'], { fetchImpl: stub });
    expect(origins).toHaveLength(2);
    expect(origins[1]).toEqual({ name: 'nope' });
  });

  it('groups by owner and filters to the owners asked for', async () => {
    const origins = await packageOrigins(['grafast', 'graphql', 'ruru'], { fetchImpl: stub });
    expect(groupByOwner(origins).get('graphile')).toEqual(['grafast', 'ruru']);
    // The point of the whole exercise: graphql is a different project.
    expect(namesFromOwners(origins, ['graphile'])).toEqual(['grafast', 'ruru']);
    expect(namesFromOwners(origins, ['graphile'])).not.toContain('graphql');
  });
});
