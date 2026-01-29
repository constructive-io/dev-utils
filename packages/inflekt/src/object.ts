/**
 * Object key transformation utilities
 */

/**
 * Convert kebab-case keys to camelCase in an object
 * @param obj - Object with kebab-case keys
 * @returns New object with camelCase keys
 * @example inflektObject({ 'schema-file': 'test.graphql', 'dry-run': true }) -> { schemaFile: 'test.graphql', dryRun: true }
 */
export function inflektObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Convert kebab-case to camelCase
      const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = obj[key];
    }
  }
  
  return result;
}
