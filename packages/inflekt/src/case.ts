/**
 * Case transformation utilities
 *
 * Pure case transforms are delegated to komoji (the origin of truth).
 * This module re-exports them for backward compatibility and adds
 * inflekt-specific helpers (fixCapitalisedPlural, underscore, toScreamingSnake).
 */

import {
  lcFirst,
  ucFirst,
  toCamelCase as _toCamelCase,
  toPascalCase,
  toSnakeCase,
  toConstantCase,
} from 'komoji';

// Re-export komoji functions directly
export { lcFirst, ucFirst, toPascalCase };

// Re-export toCamelCase — komoji's version accepts a second parameter
// (stripLeadingNonAlphabetChars) so we wrap to keep the simpler inflekt signature
export function toCamelCase(str: string): string {
  return _toCamelCase(str);
}

/**
 * Fix capitalized plurals that end with a number followed by 'S'
 * This solves the issue with `blah-table1s` becoming `blahTable1S`
 * @example "Table1S" -> "Table1s"
 */
export function fixCapitalisedPlural(str: string): string {
  return str.replace(/[0-9]S(?=[A-Z]|$)/g, (match) => match.toLowerCase());
}

/**
 * Convert PascalCase or camelCase to snake_case
 * @deprecated Use toSnakeCase from komoji instead
 * @example underscore('UserProfile') -> 'user_profile'
 * @example underscore('userProfile') -> 'user_profile'
 */
export function underscore(str: string): string {
  return toSnakeCase(str);
}

/**
 * Convert a camelCase or PascalCase string to SCREAMING_SNAKE_CASE.
 * @deprecated Use toConstantCase from komoji instead
 * @example toScreamingSnake('userProfile') -> 'USER_PROFILE'
 * @example toScreamingSnake('UserProfile') -> 'USER_PROFILE'
 */
export function toScreamingSnake(str: string): string {
  return toConstantCase(str);
}
