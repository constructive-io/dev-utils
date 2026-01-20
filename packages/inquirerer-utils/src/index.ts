// Re-export core CLI utilities from inquirerer for backwards compatibility
export {
  extractFirst,
  cliExitWithError,
  getPackageJson,
  getPackageVersion,
  getPackageName
} from 'inquirerer';
export type { ParsedArgs, CliExitOptions, PackageJson } from 'inquirerer';

// Legacy aliases for backwards compatibility
export { getPackageJson as getSelfPackageJson } from 'inquirerer';
export { getPackageVersion as getSelfVersion } from 'inquirerer';
export { getPackageName as getSelfName } from 'inquirerer';
export type { PackageJson as PackageJsonInfo } from 'inquirerer';

// Update checking (requires appstash, not available in inquirerer)
export { checkForUpdates, shouldSkipUpdateCheck } from './update-check';
export type { UpdateCheckOptions, UpdateCheckResult } from './update-check';
