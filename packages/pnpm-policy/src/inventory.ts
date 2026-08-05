/**
 * The inventory: what a maintainer publishes, compressed.
 *
 * A raw maintainer query is a flat list of names. Most of them share a handful
 * of scopes, and a scope published to only by you can be expressed as one glob
 * that also covers everything you publish there *tomorrow* — so compressing is
 * not just about file size, it is what keeps the export from going stale the
 * moment a new package ships.
 *
 * The compression is only safe when the scope is exclusively yours. If someone
 * else publishes into it, `@scope/*` would exempt their packages too — so a
 * scope is globbed only when you say you own it (`scopes:` in the config), and
 * every other scope is listed name by name, which is exact because the names
 * come from your own maintainer query.
 */

import { readFileSync, writeFileSync } from 'fs';

import { PolicyError } from './errors';
import type { RegistryOptions } from './registry';
import { packagesByMaintainer, packagesInScope } from './registry';
import type { Inventory } from './types';

export interface BuildInventoryOptions extends RegistryOptions {
  /**
   * Also glob a scope when the registry shows nobody else publishing into it.
   *
   * Off by default, and best-effort when on: npm has no "list a scope" API, so
   * this reads the search index, which is incomplete enough to report zero
   * packages for a scope that plainly has some. Finding a foreign package is
   * proof a scope is shared; finding none is not proof that it is yours.
   */
  verifyScopes?: boolean;
  /** Scopes you own. These are globbed. */
  trustedScopes?: string[];
  onProgress?: (message: string) => void;
}

/** Split names into scope buckets and unscoped leftovers. */
export function groupByScope(names: string[]): {
  scopes: Map<string, string[]>;
  unscoped: string[];
} {
  const scopes = new Map<string, string[]>();
  const unscoped: string[] = [];

  for (const name of names) {
    if (!name.startsWith('@')) {
      unscoped.push(name);
      continue;
    }
    const scope = name.slice(0, name.indexOf('/'));
    const bucket = scopes.get(scope);
    if (bucket) bucket.push(name);
    else scopes.set(scope, [name]);
  }

  return { scopes, unscoped: unscoped.sort() };
}

/** Query the registry and compress the result into an inventory. */
export async function buildInventory(
  maintainers: string[],
  options: BuildInventoryOptions = {}
): Promise<Inventory> {
  if (maintainers.length === 0) {
    throw new PolicyError('At least one maintainer is required to build an inventory');
  }

  const all = new Set<string>();
  for (const maintainer of maintainers) {
    options.onProgress?.(`querying maintainer:${maintainer}`);
    for (const name of await packagesByMaintainer(maintainer, options)) {
      all.add(name);
    }
  }

  const { scopes, unscoped } = groupByScope([...all]);
  const trusted = new Set((options.trustedScopes ?? []).map((s) => s.replace(/\/\*$/, '')));
  const verify = options.verifyScopes ?? false;

  const ownedScopes: string[] = [];
  const sharedScopes: string[] = [];
  const packages: string[] = [...unscoped];

  for (const [scope, members] of [...scopes].sort()) {
    if (trusted.has(scope)) {
      ownedScopes.push(scope);
      continue;
    }

    if (!verify) {
      // Not claimed as yours: list what you publish there, and leave the rest
      // of the scope subject to the wait.
      packages.push(...members);
      continue;
    }

    options.onProgress?.(`verifying ${scope}/*`);
    const inScope = await packagesInScope(scope, options);
    const foreign = inScope.filter((name) => !all.has(name));

    if (foreign.length === 0) {
      ownedScopes.push(scope);
    } else {
      options.onProgress?.(
        `${scope}/* is shared (${foreign.length} package(s) published by someone else) — listing its members individually`
      );
      sharedScopes.push(scope);
      packages.push(...members);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    maintainers: [...maintainers].sort(),
    scopes: ownedScopes.sort(),
    packages: packages.sort(),
    ...(sharedScopes.length ? { sharedScopes: sharedScopes.sort() } : {})
  };
}

/** True if a name is covered by one of the inventory's scope globs. */
export function inScope(name: string, scopes: string[]): boolean {
  return scopes.some((scope) => name.startsWith(`${scope}/`));
}

/** Every first-party name an inventory knows: scope members plus listed packages. */
export function inventoryMatches(inventory: Inventory, name: string): boolean {
  return inScope(name, inventory.scopes) || inventory.packages.includes(name);
}

export function readInventory(file: string): Inventory {
  const parsed = JSON.parse(readFileSync(file, 'utf-8')) as Inventory;
  if (!Array.isArray(parsed.scopes) || !Array.isArray(parsed.packages)) {
    throw new PolicyError(`${file} is not a pnpm-policy inventory`);
  }
  return parsed;
}

export function writeInventory(file: string, inventory: Inventory): void {
  writeFileSync(file, `${JSON.stringify(inventory, null, 2)}\n`);
}
