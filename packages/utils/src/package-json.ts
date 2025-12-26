import { findAndRequirePackageJson } from 'find-and-require-package-json';

/**
 * Package.json structure (partial)
 */
export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  [key: string]: any;
}

/**
 * Get the package.json for the current CLI tool.
 * This is a convenience wrapper around find-and-require-package-json
 * that provides consistent behavior across CLI tools.
 * 
 * @param dirname - The __dirname of the calling module
 * @returns The parsed package.json object
 * 
 * @example
 * ```typescript
 * const pkg = getSelfPackageJson(__dirname);
 * console.log(`${pkg.name}@${pkg.version}`);
 * ```
 */
export function getSelfPackageJson(dirname: string): PackageJson {
  return findAndRequirePackageJson(dirname) as PackageJson;
}

/**
 * Get the version string for the current CLI tool.
 * 
 * @param dirname - The __dirname of the calling module
 * @returns The version string from package.json
 * 
 * @example
 * ```typescript
 * const version = getSelfVersion(__dirname);
 * console.log(`v${version}`);
 * ```
 */
export function getSelfVersion(dirname: string): string {
  return getSelfPackageJson(dirname).version;
}

/**
 * Get the name of the current CLI tool.
 * 
 * @param dirname - The __dirname of the calling module
 * @returns The name from package.json
 */
export function getSelfName(dirname: string): string {
  return getSelfPackageJson(dirname).name;
}
