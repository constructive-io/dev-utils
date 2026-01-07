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
