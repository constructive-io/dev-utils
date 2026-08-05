import type { Inventory } from '../src';
import { buildInventory, groupByScope, inventoryMatches, packagesByMaintainer } from '../src';

/** A registry stub: query string in, package names out. */
function stubFetch(pages: Record<string, string[]>): typeof fetch {
  return (async (url: string) => {
    const parsed = new URL(url);
    const text = parsed.searchParams.get('text') ?? '';
    const from = Number(parsed.searchParams.get('from') ?? 0);
    const size = Number(parsed.searchParams.get('size') ?? 250);
    const names = pages[text] ?? [];
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        total: names.length,
        objects: names.slice(from, from + size).map((name) => ({ package: { name } }))
      })
    };
  }) as unknown as typeof fetch;
}

const options = { throttleMs: 0, fetchImpl: undefined as unknown as typeof fetch };

describe('groupByScope', () => {
  it('separates scoped names from unscoped ones', () => {
    const { scopes, unscoped } = groupByScope([
      '@pgsql/types',
      '@pgsql/utils',
      'pgsql-parser',
      'yanse'
    ]);
    expect([...scopes.keys()]).toEqual(['@pgsql']);
    expect(scopes.get('@pgsql')).toEqual(['@pgsql/types', '@pgsql/utils']);
    expect(unscoped).toEqual(['pgsql-parser', 'yanse']);
  });
});

describe('packagesByMaintainer', () => {
  it('follows pagination past the 250-result page size', async () => {
    const many = Array.from({ length: 600 }, (_, i) => `pkg-${String(i).padStart(3, '0')}`);
    const names = await packagesByMaintainer('pyramation', {
      ...options,
      fetchImpl: stubFetch({ 'maintainer:pyramation': many })
    });
    expect(names).toHaveLength(600);
  });

  it('retries a 429 and honours Retry-After', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '0' }),
          json: async () => ({})
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ total: 1, objects: [{ package: { name: 'yanse' } }] })
      };
    }) as unknown as typeof fetch;

    expect(await packagesByMaintainer('pyramation', { throttleMs: 0, fetchImpl })).toEqual([
      'yanse'
    ]);
    expect(calls).toBe(2);
  });

  it('gives up with a useful message rather than looping forever', async () => {
    const fetchImpl = (async () => ({
      ok: false,
      status: 429,
      headers: new Headers(),
      json: async () => ({})
    })) as unknown as typeof fetch;

    await expect(
      packagesByMaintainer('pyramation', { throttleMs: 0, retries: 1, fetchImpl })
    ).rejects.toThrow(/failed after 2 attempts/);
  });
});

describe('buildInventory', () => {
  const mine = ['@acme/one', '@acme/two', '@shared/mine', 'unscoped-a'];

  it('lists scoped names individually unless the scope is claimed', async () => {
    const fetchImpl = jest.fn(stubFetch({ 'maintainer:me': mine })) as unknown as typeof fetch;
    const inventory = await buildInventory(['me'], { ...options, fetchImpl });

    expect(inventory.scopes).toEqual([]);
    expect(inventory.packages).toEqual([
      '@acme/one',
      '@acme/two',
      '@shared/mine',
      'unscoped-a'
    ]);
    // No scope queries: the default costs exactly one request per maintainer.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('globs a scope nobody else publishes into, when verification is asked for', async () => {
    const inventory = await buildInventory(['me'], {
      ...options,
      verifyScopes: true,
      fetchImpl: stubFetch({
        'maintainer:me': mine,
        'scope:acme': ['@acme/one', '@acme/two'],
        'scope:shared': ['@shared/mine']
      })
    });
    expect(inventory.scopes).toEqual(['@acme', '@shared']);
    expect(inventory.packages).toEqual(['unscoped-a']);
  });

  it('refuses to glob a scope someone else publishes into', async () => {
    const inventory = await buildInventory(['me'], {
      ...options,
      verifyScopes: true,
      fetchImpl: stubFetch({
        'maintainer:me': mine,
        'scope:acme': ['@acme/one', '@acme/two'],
        'scope:shared': ['@shared/mine', '@shared/theirs']
      })
    });
    expect(inventory.scopes).toEqual(['@acme']);
    expect(inventory.sharedScopes).toEqual(['@shared']);
    // Left expanded, so `@shared/theirs` is not silently exempted.
    expect(inventory.packages).toEqual(['@shared/mine', 'unscoped-a']);
  });

  it('trusts a configured scope without asking the registry', async () => {
    const inventory = await buildInventory(['me'], {
      ...options,
      trustedScopes: ['@shared'],
      verifyScopes: true,
      fetchImpl: stubFetch({
        'maintainer:me': mine,
        'scope:acme': ['@acme/one', '@acme/two'],
        'scope:shared': ['@shared/mine', '@shared/theirs']
      })
    });
    expect(inventory.scopes).toEqual(['@acme', '@shared']);
  });

  it('merges several maintainer accounts', async () => {
    const inventory = await buildInventory(['me', 'my-ci'], {
      ...options,
      fetchImpl: stubFetch({
        'maintainer:me': ['a'],
        'maintainer:my-ci': ['b', 'a']
      })
    });
    expect(inventory.packages).toEqual(['a', 'b']);
    expect(inventory.maintainers).toEqual(['me', 'my-ci']);
  });

  it('requires a maintainer', async () => {
    await expect(buildInventory([])).rejects.toThrow(/At least one maintainer/);
  });
});

describe('inventoryMatches', () => {
  const inventory: Inventory = {
    generatedAt: '',
    maintainers: [],
    scopes: ['@acme'],
    packages: ['yanse']
  };

  it('matches through a scope glob or an exact name', () => {
    expect(inventoryMatches(inventory, '@acme/anything')).toBe(true);
    expect(inventoryMatches(inventory, 'yanse')).toBe(true);
    expect(inventoryMatches(inventory, '@acme-other/x')).toBe(false);
    expect(inventoryMatches(inventory, 'react')).toBe(false);
  });
});
