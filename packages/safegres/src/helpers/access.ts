/**
 * Access Helpers for Safegres
 *
 * Safe property access and value checking helpers for policy evaluation.
 */

/**
 * Safe property access that never throws
 * Supports dot notation paths like "request.headers.authorization"
 */
export function get<T>(obj: unknown, path: string, fallback: T): T {
  if (obj === null || obj === undefined) return fallback;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return fallback;
    if (typeof current !== 'object') return fallback;
    current = (current as Record<string, unknown>)[part];
  }

  return current === undefined ? fallback : (current as T);
}

/**
 * Check if a value is defined (not null or undefined)
 */
export function defined(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/**
 * Check if an array or string is empty
 */
export function empty(
  value: unknown[] | string | undefined | null
): boolean {
  if (value === null || value === undefined) return true;
  return value.length === 0;
}

/**
 * Check if a value is in a list
 */
export function includes<T>(list: readonly T[] | undefined | null, value: T): boolean {
  if (!list) return false;
  return list.includes(value);
}

/**
 * Check if a value is truthy
 */
export function truthy(value: unknown): boolean {
  return Boolean(value);
}

/**
 * Check if a value is falsy
 */
export function falsy(value: unknown): boolean {
  return !value;
}

/**
 * Check if two values are equal (deep equality for objects)
 */
export function equals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      equals(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
}

/**
 * Coalesce to first defined value
 */
export function coalesce<T>(...values: (T | undefined | null)[]): T | undefined {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return undefined;
}

/**
 * Access helpers object for convenient access
 */
export const access = {
  get,
  defined,
  empty,
  includes,
  truthy,
  falsy,
  equals,
  coalesce,
};

export type AccessHelpers = typeof access;
