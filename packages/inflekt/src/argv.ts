/**
 * Object key transformation utilities for CLI arguments and other use cases
 */

import { camelize } from 'inflection';
import { inflektTree } from './transform-keys';

const isTopLevel = (_key: string, path: string[]) => path.length === 0;

/**
 * Camelize argv keys (typically from minimist or similar CLI parsers)
 * Transforms kebab-case and snake_case keys to camelCase at the top level only.
 * Skips minimist internal keys like '_' and keys starting with '_'.
 *
 * @param argv - Parsed CLI arguments object
 * @returns New object with camelCase keys
 *
 * @example
 * const argv = { 'schema-file': 'test.graphql', 'dry-run': true, _: [] };
 * const parsedArgv = camelizeArgv(argv);
 * // Result: { schemaFile: 'test.graphql', dryRun: true, _: [] }
 */
export const camelizeArgv = (argv: Record<string, any>) =>
  inflektTree(argv, (key) => camelize(key, true), {
    skip: (key, path) =>
      !isTopLevel(key, path) ||
      key === '_' ||
      key.startsWith('_')
  });
