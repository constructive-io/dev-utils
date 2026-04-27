import { Node, Script } from './types';

/**
 * Transform function type
 */
type TransformFn = (value: any, key: string, parent: any) => any;

/**
 * Transform options - map of property names to transform functions
 */
type TransformOptions = Record<string, TransformFn>;

/**
 * No-op transform function - removes the property
 */
export const noop = (): undefined => undefined;

/**
 * Deep transform an object
 */
function transform(obj: any, options: TransformOptions): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transform(item, options));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      
      // Check if there's a transform function for this key
      if (key in options) {
        const transformed = options[key](value, key, obj);
        if (transformed !== undefined) {
          result[key] = transformed;
        }
        // If undefined, skip the property (remove it)
      } else {
        // Recursively transform nested objects
        result[key] = transform(value, options);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Clean AST tree by removing location/position information
 * This is used for comparing ASTs in round-trip testing
 */
export function cleanTree<T extends Node | Script>(tree: T): T {
  return transform(tree, {
    // Remove range/position information
    range: noop,
    
    // Normalize text strings (trim whitespace)
    text: (value: any) => {
      if (typeof value === 'string') {
        return value.trim();
      }
      return value;
    }
  }) as T;
}

/**
 * Compare two ASTs for equality after cleaning
 */
export function compareAst(ast1: any, ast2: any): boolean {
  const clean1 = cleanTree(ast1);
  const clean2 = cleanTree(ast2);
  return JSON.stringify(clean1) === JSON.stringify(clean2);
}
