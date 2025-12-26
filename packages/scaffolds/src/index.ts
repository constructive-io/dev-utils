import * as fs from 'fs';
import * as path from 'path';

import { registerDefaultResolver } from 'commodore';

import { extractVariables } from './template/extract';
import { promptUser } from './template/prompt';
import { replaceVariables } from './template/replace';
import { listSupportedLicenses } from './licenses';
import { CreateGenOptions } from './types';

// Register the 'licenses' resolver for optionsFrom support
// This allows boilerplate templates to use: "optionsFrom": "licenses"
registerDefaultResolver('licenses', () => listSupportedLicenses());

// Export new modular classes
export * from './cache/cache-manager';
export * from './cache/types';
export * from './git/git-cloner';
export * from './git/types';
export * from './scaffolder/template-scaffolder';
export * from './scaffolder/types';
export * from './template/templatizer';
export * from './template/types';
export * from './utils/npm-version-check';
export * from './utils/types';

// Export template processing functions
export * from './template/extract';
export * from './template/prompt';
export * from './template/replace';

// Export shared types
export * from './types';

// DEPRECATED: Legacy exports for backward compatibility (will be removed in future)
// Use CacheManager, GitCloner, and Templatizer classes instead
export { extractVariables, promptUser, replaceVariables };

/**
 * @deprecated This function is deprecated and will be removed in the next major version.
 * Use the modular approach with CacheManager, GitCloner, and Templatizer classes instead.
 * See create-gen-app-test package for an example of the new orchestration pattern.
 *
 * Create a new project from a template repository
 * @param options - Options for creating the project
 * @returns Path to the generated project
 */
export async function createGen(options: CreateGenOptions): Promise<string> {
  throw new Error(
    'createGen() has been deprecated. Please use CacheManager, GitCloner, and Templatizer classes for modular template processing. ' +
    'See create-gen-app-test package for the new orchestration pattern.'
  );
}
