// Re-export core CLI utilities from inquirerer
export {
  parseArgv,
  extractFirst,
  cliExitWithError,
  getPackageJson,
  getPackageVersion,
  getPackageName
} from 'inquirerer';
export type { ParsedArgs, ParseArgvOptions, CliExitOptions, PackageJson } from 'inquirerer';

// Update checking (requires appstash, not available in inquirerer)
export { checkForUpdates, shouldSkipUpdateCheck } from './update-check';
export type { UpdateCheckOptions, UpdateCheckResult } from './update-check';
