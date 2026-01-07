/**
 * Case transformation utilities
 */
export {
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  toConstantCase,
} from 'komoji';

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
