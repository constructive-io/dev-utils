// Argv utilities
export { extractFirst } from './argv';
export type { ParsedArgs } from './argv';

// CLI error handling
export { cliExitWithError } from './cli-error';
export type { CliExitOptions } from './cli-error';

// Update checking
export { checkForUpdates } from './update-check';
export type { UpdateCheckOptions, UpdateCheckResult } from './update-check';

// Package.json utilities
export { getSelfPackageJson, getSelfVersion, getSelfName } from './package-json';
export type { PackageJsonInfo } from './package-json';
