import { findAndRequirePackageJson } from 'find-and-require-package-json';

export interface PackageJsonInfo {
  name: string;
  version: string;
  [key: string]: any;
}

/**
 * Gets the package.json for the current package by searching up from the given directory.
 * This is useful for CLIs to get their own version information.
 */
export const getSelfPackageJson = (dirname: string): PackageJsonInfo => {
  return findAndRequirePackageJson(dirname);
};

/**
 * Gets the version from the package.json for the current package.
 */
export const getSelfVersion = (dirname: string): string => {
  return getSelfPackageJson(dirname).version;
};

/**
 * Gets the name from the package.json for the current package.
 */
export const getSelfName = (dirname: string): string => {
  return getSelfPackageJson(dirname).name;
};
