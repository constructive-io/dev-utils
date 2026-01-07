/**
 * Case transformation utilities
 */
import * as inflection from 'inflection';

/**
 * Convert PascalCase to camelCase (lowercase first character)
 * @example "UserProfile" -> "userProfile"
 */
export function lcFirst(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Convert a string to camelCase
 * @param str - The string to convert
 * @param lowFirstLetter - If true, the first letter will be lowercase (default: false)
 * @example camelize("user_profile") -> "UserProfile"
 * @example camelize("user_profile", true) -> "userProfile"
 */
export function camelize(str: string, lowFirstLetter?: boolean): string {
  return inflection.camelize(str, lowFirstLetter);
}

/**
 * Convert a camelCase or PascalCase string to snake_case
 * @example underscore("UserProfile") -> "user_profile"
 */
export function underscore(str: string): string {
  return inflection.underscore(str);
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
