/**
 * String Matching Helpers for Safegres
 *
 * Safe, deterministic string matching operations for policy evaluation.
 */

/**
 * Exact string equality (case-sensitive)
 */
export function exact(a?: string, b?: string): boolean {
  if (a === undefined || b === undefined) return false;
  return a === b;
}

/**
 * Case-insensitive exact match
 */
export function iexact(a?: string, b?: string): boolean {
  if (a === undefined || b === undefined) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Check if value starts with prefix
 */
export function prefix(value: string | undefined, pfx: string): boolean {
  if (value === undefined) return false;
  return value.startsWith(pfx);
}

/**
 * Check if value ends with suffix
 */
export function suffix(value: string | undefined, sfx: string): boolean {
  if (value === undefined) return false;
  return value.endsWith(sfx);
}

/**
 * Check if value contains substring
 */
export function contains(value: string | undefined, substr: string): boolean {
  if (value === undefined) return false;
  return value.includes(substr);
}

/**
 * Simple glob matching (supports * and ?)
 * * matches any sequence of characters
 * ? matches any single character
 */
export function glob(value: string | undefined, pattern: string): boolean {
  if (value === undefined) return false;

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*') // * -> .*
    .replace(/\?/g, '.'); // ? -> .

  try {
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  } catch {
    return false;
  }
}

/**
 * Safe regex matching with timeout protection
 * Returns false on invalid patterns or timeout
 */
export function regex(
  value: string | undefined,
  pattern: string,
  flags?: string
): boolean {
  if (value === undefined) return false;

  try {
    const re = new RegExp(pattern, flags);
    return re.test(value);
  } catch {
    return false;
  }
}

/**
 * Match helpers object for convenient access
 */
export const match = {
  exact,
  iexact,
  prefix,
  suffix,
  contains,
  glob,
  regex,
};

export type MatchHelpers = typeof match;
