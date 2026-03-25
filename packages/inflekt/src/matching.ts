/**
 * Name matching utilities for resolving PostGraphile v5 naming mismatches.
 *
 * PostGraphile v5 uses different inflection conventions in different contexts:
 *   - Table types are PascalCase (e.g., "Shipment", "DeliveryZone")
 *   - Relation codec names are raw snake_case or camelCase (e.g., "shipments", "deliveryZones")
 *
 * These helpers provide a single, shared way to normalize and compare names
 * across those boundaries instead of duplicating fuzzy-match logic in every consumer.
 */

import { singularize } from './pluralize';

/**
 * Normalize a name for case-insensitive, delimiter-insensitive comparison.
 * Strips underscores and lowercases.
 *
 * @example normalizeName("delivery_zone") // "deliveryzone"
 * @example normalizeName("DeliveryZone")  // "deliveryzone"
 * @example normalizeName("deliveryZones") // "deliveryzones"
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/_/g, '');
}

/**
 * Normalize a name to its singular base form for comparison.
 * Strips underscores, lowercases, and removes a trailing 's' when present.
 *
 * @example normalizeNameSingular("shipments")    // "shipment"
 * @example normalizeNameSingular("DeliveryZone") // "deliveryzone"
 * @example normalizeNameSingular("routes")       // "route"
 */
export function normalizeNameSingular(name: string): string {
  const normalized = normalizeName(name);
  return normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
}

/**
 * Find a matching item by name using exact match first, then fuzzy
 * case-insensitive / plural-insensitive fallback.
 *
 * This is the single shared implementation for resolving relation target names
 * to table definitions, replacing ad-hoc fuzzy matching scattered across consumers.
 *
 * @param items      - Array of items to search through
 * @param targetName - The name to find (may be PascalCase, snake_case, plural, etc.)
 * @param getName    - Accessor to extract the comparable name from each item
 * @returns The matched item, or undefined if no match found
 *
 * @example
 * // Find a table by its relation target name
 * const table = fuzzyFindByName(allTables, "shipments", t => t.name);
 * // Matches Table with name "Shipment"
 *
 * @example
 * // Works with snake_case codec names too
 * const table = fuzzyFindByName(allTables, "delivery_zone", t => t.name);
 * // Matches Table with name "DeliveryZone"
 */
export function fuzzyFindByName<T>(
  items: T[],
  targetName: string,
  getName: (item: T) => string,
): T | undefined {
  // 1. Exact match (fast path)
  const exact = items.find((item) => getName(item) === targetName);
  if (exact) return exact;

  // 2. Fuzzy match: case-insensitive, strip underscores, optional trailing 's'
  const targetNormalized = normalizeName(targetName);
  const targetBase = normalizeNameSingular(targetName);

  return items.find((item) => {
    const itemNormalized = normalizeName(getName(item));
    return itemNormalized === targetNormalized || itemNormalized === targetBase;
  });
}

/**
 * Check whether two names refer to the same entity, ignoring case,
 * underscores, and singular/plural differences.
 *
 * @example namesMatch("shipments", "Shipment")       // true
 * @example namesMatch("delivery_zone", "DeliveryZone") // true
 * @example namesMatch("Route", "routes")               // true
 * @example namesMatch("User", "Post")                  // false
 */
export function namesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const aNorm = normalizeName(a);
  const bNorm = normalizeName(b);
  if (aNorm === bNorm) return true;
  const aBase = normalizeNameSingular(a);
  const bBase = normalizeNameSingular(b);
  return aBase === bBase;
}
