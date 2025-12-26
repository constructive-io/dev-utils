import { appstash } from 'appstash';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Options for checking for updates
 */
export interface UpdateCheckOptions {
  /** Package name to check for updates */
  pkgName: string;
  /** Current version of the package */
  currentVersion: string;
  /** Tool name for storing update check state (used with appstash) */
  toolName: string;
  /** Registry base URL (default: https://registry.npmjs.org) */
  registryBaseUrl?: string;
  /** How often to check for updates in milliseconds (default: 24 hours) */
  checkInterval?: number;
  /** Custom fetch function for testing or alternative registries */
  fetchFn?: typeof fetch;
}

/**
 * Result of an update check
 */
export interface UpdateCheckResult {
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Current version */
  currentVersion: string;
  /** Latest version available (if check was performed) */
  latestVersion?: string;
  /** Whether the check was skipped due to recent check */
  skipped?: boolean;
}

const DEFAULT_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a newer version of a package is available on npm.
 * Uses appstash to store the last check time and avoid excessive API calls.
 * 
 * @example
 * ```typescript
 * const result = await checkForUpdates({
 *   pkgName: '@constructive-io/cli',
 *   currentVersion: '1.0.0',
 *   toolName: 'cnc'
 * });
 * 
 * if (result.updateAvailable) {
 *   console.log(`Update available: ${result.latestVersion}`);
 * }
 * ```
 */
export async function checkForUpdates(options: UpdateCheckOptions): Promise<UpdateCheckResult> {
  const {
    pkgName,
    currentVersion,
    toolName,
    registryBaseUrl = 'https://registry.npmjs.org',
    checkInterval = DEFAULT_CHECK_INTERVAL,
    fetchFn = fetch
  } = options;

  const dirs = appstash(toolName, { ensure: true });
  const updateCheckFile = path.join(dirs.cache, 'update-check.json');

  // Check if we should skip based on last check time
  try {
    if (fs.existsSync(updateCheckFile)) {
      const data = JSON.parse(fs.readFileSync(updateCheckFile, 'utf-8'));
      const lastCheck = new Date(data.lastCheck).getTime();
      const now = Date.now();

      if (now - lastCheck < checkInterval) {
        return {
          updateAvailable: false,
          currentVersion,
          skipped: true
        };
      }
    }
  } catch {
    // Ignore errors reading cache file
  }

  try {
    const response = await fetchFn(`${registryBaseUrl}/${pkgName}/latest`);
    
    if (!response.ok) {
      return {
        updateAvailable: false,
        currentVersion
      };
    }

    const data = await response.json() as { version: string };
    const latestVersion = data.version;

    // Save the check time
    try {
      fs.writeFileSync(updateCheckFile, JSON.stringify({
        lastCheck: new Date().toISOString(),
        latestVersion
      }));
    } catch {
      // Ignore errors writing cache file
    }

    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

    return {
      updateAvailable,
      currentVersion,
      latestVersion
    };
  } catch {
    return {
      updateAvailable: false,
      currentVersion
    };
  }
}

/**
 * Compare two semver versions.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    if (partA !== partB) {
      return partA - partB;
    }
  }

  return 0;
}
