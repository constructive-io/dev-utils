/**
 * Quantifier Helpers for Safegres
 *
 * Safe, deterministic iteration helpers for policy evaluation.
 */

/**
 * Check if all items satisfy the predicate
 */
export function all<T>(
  items: readonly T[] | undefined | null,
  pred: (x: T) => boolean
): boolean {
  if (!items || items.length === 0) return true;
  return items.every(pred);
}

/**
 * Check if any item satisfies the predicate
 */
export function any<T>(
  items: readonly T[] | undefined | null,
  pred: (x: T) => boolean
): boolean {
  if (!items || items.length === 0) return false;
  return items.some(pred);
}

/**
 * Check if no items satisfy the predicate
 */
export function none<T>(
  items: readonly T[] | undefined | null,
  pred: (x: T) => boolean
): boolean {
  if (!items || items.length === 0) return true;
  return !items.some(pred);
}

/**
 * Count items that satisfy the predicate
 */
export function count<T>(
  items: readonly T[] | undefined | null,
  pred: (x: T) => boolean
): number {
  if (!items || items.length === 0) return 0;
  return items.filter(pred).length;
}

/**
 * Find first item that satisfies the predicate
 */
export function find<T>(
  items: readonly T[] | undefined | null,
  pred: (x: T) => boolean
): T | undefined {
  if (!items || items.length === 0) return undefined;
  return items.find(pred);
}

/**
 * Find all items that satisfy the predicate
 */
export function filter<T>(
  items: readonly T[] | undefined | null,
  pred: (x: T) => boolean
): T[] {
  if (!items || items.length === 0) return [];
  return items.filter(pred);
}

/**
 * Map items through a transformation function
 */
export function map<T, U>(
  items: readonly T[] | undefined | null,
  fn: (x: T) => U
): U[] {
  if (!items || items.length === 0) return [];
  return items.map(fn);
}

/**
 * Get the first item or undefined
 */
export function first<T>(items: readonly T[] | undefined | null): T | undefined {
  if (!items || items.length === 0) return undefined;
  return items[0];
}

/**
 * Get the last item or undefined
 */
export function last<T>(items: readonly T[] | undefined | null): T | undefined {
  if (!items || items.length === 0) return undefined;
  return items[items.length - 1];
}

/**
 * Quantifier helpers object for convenient access
 */
export const quantifiers = {
  all,
  any,
  none,
  count,
  find,
  filter,
  map,
  first,
  last,
};

export type QuantifierHelpers = typeof quantifiers;
