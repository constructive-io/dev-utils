/**
 * Deep object key transformation utilities
 *
 * Transform all property names (keys) in an object tree using pluggable inflekt transformers.
 */

export type KeyTransformer = (key: string) => string;

export interface InflektTreeOptions {
  /**
   * Optional function to skip transformation for specific keys
   * @param key - The current key being processed
   * @param path - Array of keys representing the path to the current key
   * @returns true to skip transformation, false to transform
   */
  skip?: (key: string, path: string[]) => boolean;
}

/**
 * Recursively traverse an object and transform all property names using the provided transformer.
 *
 * @param obj - The object to transform
 * @param transformer - Function that transforms a key string
 * @param options - Optional configuration
 * @returns A new object with transformed keys
 *
 * @example
 * // Convert snake_case keys to camelCase
 * const apiResponse = { user_name: 'John', order_items: [{ item_id: 1 }] };
 * const result = inflektTree(apiResponse, toCamelCase);
 * // Result: { userName: 'John', orderItems: [{ itemId: 1 }] }
 *
 * @example
 * // Convert camelCase keys to snake_case
 * const frontendObj = { userName: 'John', orderItems: [{ itemId: 1 }] };
 * const result = inflektTree(frontendObj, underscore);
 * // Result: { user_name: 'John', order_items: [{ item_id: 1 }] }
 *
 * @example
 * // Skip keys starting with underscore
 * inflektTree(obj, toCamelCase, {
 *   skip: (key) => key.startsWith('_')
 * });
 */
export function inflektTree(
  obj: any,
  transformer: KeyTransformer,
  options?: InflektTreeOptions
): any {
  return transformKeys(obj, transformer, options, []);
}

function transformKeys(
  obj: any,
  transformer: KeyTransformer,
  options: InflektTreeOptions | undefined,
  path: string[]
): any {
  // Handle primitives (null, undefined, non-objects)
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }

  // Handle Date - clone and return
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  // Handle Array - recursively transform each element
  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      transformKeys(item, transformer, options, path)
    );
  }

  // Handle Object - create new object with transformed keys
  const result: Record<string, any> = {};

  for (const key of Object.keys(obj)) {
    const shouldSkip = options?.skip?.(key, path) ?? false;
    const newKey = shouldSkip ? key : transformer(key);
    const newPath = [...path, key];

    result[newKey] = transformKeys(obj[key], transformer, options, newPath);
  }

  return result;
}
