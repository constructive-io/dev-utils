// Re-export core CLI utilities from inquirerer
export type { CliExitOptions, PackageJson,ParseArgvOptions, ParsedArgs } from 'inquirerer';
export {
  cliExitWithError,
  extractFirst,
  getPackageJson,
  getPackageName,
  getPackageVersion,
  parseArgv} from 'inquirerer';

// Update checking (requires appstash, not available in inquirerer)
export type { UpdateCheckOptions, UpdateCheckResult } from './update-check';
export { checkForUpdates, clearUpdateCache, shouldSkipUpdateCheck, suppressUpdateCheck } from './update-check';
