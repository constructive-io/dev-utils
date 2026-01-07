/**
 * Naming utilities for GraphQL field and query name generation
 */
import { lcFirst } from './case';
import { pluralize, singularize } from './pluralize';

/**
 * Convert a plural PascalCase type name to singular camelCase field name
 * @example "Users" -> "user", "OrderItems" -> "orderItem"
 */
export function toFieldName(pluralTypeName: string): string {
  return lcFirst(singularize(pluralTypeName));
}

/**
 * Convert a singular PascalCase type name to plural camelCase query name
 * @example "User" -> "users", "OrderItem" -> "orderItems"
 */
export function toQueryName(singularTypeName: string): string {
  return lcFirst(pluralize(singularTypeName));
}
