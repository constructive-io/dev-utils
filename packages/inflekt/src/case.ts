/**
 * Case transformation utilities
 */

/**
 * Convert PascalCase to camelCase (lowercase first character)
 * @example "UserProfile" -> "userProfile"
 */
export function lcFirst(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Convert camelCase to PascalCase (uppercase first character)
 * @example "userProfile" -> "UserProfile"
 */
export function ucFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
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
 * Convert snake_case to PascalCase (or camelCase if lowFirstLetter is true)
 * @param str - The snake_case string to convert
 * @param lowFirstLetter - If true, returns camelCase instead of PascalCase
 * @example camelize('user_profile') -> 'UserProfile'
 * @example camelize('user_profile', true) -> 'userProfile'
 */
export function camelize(str: string, lowFirstLetter?: boolean): string {
  const result = str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  if (lowFirstLetter) {
    return lcFirst(result);
  }
  return result;
}

/**
 * Convert PascalCase or camelCase to snake_case
 * @example underscore('UserProfile') -> 'user_profile'
 * @example underscore('userProfile') -> 'user_profile'
 */
export function underscore(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/^_/, '')
    .toLowerCase();
}

/**
 * Convert a hyphenated or underscored string to camelCase.
 * Unlike `camelize`, this also handles hyphens and preserves
 * camelCase boundaries that are already present.
 * @example toCamelCase('user-profile') -> 'userProfile'
 * @example toCamelCase('user_profile') -> 'userProfile'
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (_, char) => char.toLowerCase());
}

/**
 * Convert a hyphenated or underscored string to PascalCase.
 * Unlike `camelize`, this also handles hyphens.
 * @example toPascalCase('user-profile') -> 'UserProfile'
 * @example toPascalCase('user_profile') -> 'UserProfile'
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (_, char) => char.toUpperCase());
}

/**
 * Convert a camelCase or PascalCase string to SCREAMING_SNAKE_CASE.
 * @example toScreamingSnake('userProfile') -> 'USER_PROFILE'
 * @example toScreamingSnake('UserProfile') -> 'USER_PROFILE'
 */
export function toScreamingSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]/g, '_')
    .toUpperCase()
    .replace(/^_/, '');
}
