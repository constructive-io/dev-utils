import { findAndRequirePackageJson } from 'find-and-require-package-json';

export interface PackageJson {
  name: string;
  version: string;
  [key: string]: any;
}

/**
 * Gets the package.json for the current package by searching up from the given directory.
 * This is useful for CLIs to get their own package information.
 *
 * @example
 * ```typescript
 * const pkg = getPackageJson(__dirname);
 * console.log(`${pkg.name}@${pkg.version}`);
 * ```
 */
export const getPackageJson = (dirname: string): PackageJson => {
  return findAndRequirePackageJson(dirname);
};

/**
 * Gets the version from the package.json for the current package.
 * Shorthand for `getPackageJson(dirname).version`.
 *
 * @example
 * ```typescript
 * if (argv.version) {
 *   console.log(getPackageVersion(__dirname));
 *   process.exit(0);
 * }
 * ```
 */
export const getPackageVersion = (dirname: string): string => {
  return getPackageJson(dirname).version;
};

/**
 * Gets the name from the package.json for the current package.
 * Shorthand for `getPackageJson(dirname).name`.
 *
 * @example
 * ```typescript
 * const toolName = getPackageName(__dirname);
 * console.log(`Welcome to ${toolName}!`);
 * ```
 */
export const getPackageName = (dirname: string): string => {
  return getPackageJson(dirname).name;
};
