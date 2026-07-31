/**
 * Inflection utilities for pluralization and singularization
 *
 * This library provides consistent inflection behavior for PostGraphile and GraphQL codegen.
 * It uses the 'inflection' package with custom overrides for Latin plural suffixes
 * that PostGraphile handles differently than standard English pluralization.
 */
export * from './case';
export * from './matching';
export * from './naming';
export * from './pluralize';
export * from './transform-keys';
