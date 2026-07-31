import { findAndRequirePackageJson } from 'find-and-require-package-json';
import { blue,green } from 'yanse';

// Function to display the version information
export function displayVersion(): any {
  const pkg = findAndRequirePackageJson(__dirname);
  console.log(green(`Name: ${pkg.name}`));
  console.log(blue(`Version: ${pkg.version}`));
}


export function getVersion(): string {
  const pkg = findAndRequirePackageJson(__dirname);
  return pkg.version;
}
