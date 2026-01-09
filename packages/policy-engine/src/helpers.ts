import type { MatchHelpers,PolicyHelpers } from './types';

/**
 * Convert a simple glob pattern to a regex
 * Supports * (any characters) and ? (single character)
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

/**
 * Safe regex execution with basic protection
 */
function safeRegexTest(pattern: string, value: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex.test(value);
  } catch {
    return false;
  }
}

/**
 * Get a nested property from an object using dot notation
 * Never throws - returns fallback if path doesn't exist
 */
function getPath<T>(obj: unknown, path: string, fallback: T): T {
  if (obj === null || obj === undefined) {
    return fallback;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return fallback;
    }
    if (typeof current !== 'object') {
      return fallback;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (current === undefined) {
    return fallback;
  }

  return current as T;
}

/**
 * Match helpers implementation
 */
const matchHelpers: MatchHelpers = {
  exact(a?: string, b?: string): boolean {
    if (a === undefined || b === undefined) {
      return false;
    }
    return a === b;
  },

  prefix(value: string | undefined, prefix: string): boolean {
    if (value === undefined) {
      return false;
    }
    return value.startsWith(prefix);
  },

  suffix(value: string | undefined, suffix: string): boolean {
    if (value === undefined) {
      return false;
    }
    return value.endsWith(suffix);
  },

  glob(value: string | undefined, pattern: string): boolean {
    if (value === undefined) {
      return false;
    }
    try {
      const regex = globToRegex(pattern);
      return regex.test(value);
    } catch {
      return false;
    }
  },

  regex(value: string | undefined, pattern: string): boolean {
    if (value === undefined) {
      return false;
    }
    return safeRegexTest(pattern, value);
  },

  iexact(a?: string, b?: string): boolean {
    if (a === undefined || b === undefined) {
      return false;
    }
    return a.toLowerCase() === b.toLowerCase();
  },
};

/**
 * Create a PolicyHelpers instance
 */
export function createHelpers(): PolicyHelpers {
  return {
    all<T>(items: readonly T[], pred: (x: T) => boolean): boolean {
      if (!Array.isArray(items) || items.length === 0) {
        return true;
      }
      for (const item of items) {
        if (!pred(item)) {
          return false;
        }
      }
      return true;
    },

    any<T>(items: readonly T[], pred: (x: T) => boolean): boolean {
      if (!Array.isArray(items)) {
        return false;
      }
      for (const item of items) {
        if (pred(item)) {
          return true;
        }
      }
      return false;
    },

    none<T>(items: readonly T[], pred: (x: T) => boolean): boolean {
      if (!Array.isArray(items) || items.length === 0) {
        return true;
      }
      for (const item of items) {
        if (pred(item)) {
          return false;
        }
      }
      return true;
    },

    count<T>(items: readonly T[], pred: (x: T) => boolean): number {
      if (!Array.isArray(items)) {
        return 0;
      }
      let count = 0;
      for (const item of items) {
        if (pred(item)) {
          count++;
        }
      }
      return count;
    },

    find<T>(items: readonly T[], pred: (x: T) => boolean): T | undefined {
      if (!Array.isArray(items)) {
        return undefined;
      }
      for (const item of items) {
        if (pred(item)) {
          return item;
        }
      }
      return undefined;
    },

    match: matchHelpers,

    get<T>(obj: unknown, path: string, fallback: T): T {
      return getPath(obj, path, fallback);
    },

    defined(value: unknown): boolean {
      return value !== null && value !== undefined;
    },

    empty(value: unknown[] | string | undefined | null): boolean {
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === 'string') {
        return value.length === 0;
      }
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      return true;
    },

    includes<T>(list: readonly T[], value: T): boolean {
      if (!Array.isArray(list)) {
        return false;
      }
      return list.includes(value);
    },
  };
}

/**
 * Default helpers instance
 */
export const helpers = createHelpers();
