import { appstash } from 'appstash';
import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';

export interface UpdateCheckOptions {
  pkgName: string;
  pkgVersion: string;
  registryBaseUrl?: string;
  toolName?: string;
  ttl?: number;
  /** Force check even in CI or when skip env vars are set */
  force?: boolean;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  message: string | null;
  /** Whether the check was skipped due to CI or env vars */
  skipped?: boolean;
  /** Reason for skipping: 'ci', 'env', or 'tool-env' */
  skipReason?: 'ci' | 'env' | 'tool-env';
}

/**
 * Converts a tool name to an environment variable name.
 * e.g., "pgpm" -> "PGPM", "my-cli" -> "MY_CLI"
 */
function toEnvVarName(toolName: string): string {
  return toolName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/**
 * Checks if update checking should be skipped based on environment variables.
 * 
 * Skip conditions (in order of precedence):
 * 1. CI environment (process.env.CI is truthy)
 * 2. Generic skip: INQUIRERER_SKIP_UPDATE_CHECK is truthy
 * 3. Tool-specific skip: {TOOLNAME}_SKIP_UPDATE_CHECK is truthy
 * 
 * @returns Object with skip status and reason, or null if should not skip
 */
export function shouldSkipUpdateCheck(
  toolName?: string,
  env: NodeJS.ProcessEnv = process.env
): { skip: true; reason: 'ci' | 'env' | 'tool-env' } | { skip: false } {
  // Check CI environment
  if (env.CI) {
    return { skip: true, reason: 'ci' };
  }

  // Check generic skip env var
  if (env.INQUIRERER_SKIP_UPDATE_CHECK) {
    return { skip: true, reason: 'env' };
  }

  // Check tool-specific skip env var (derived from toolName)
  if (toolName) {
    const toolEnvVar = `${toEnvVarName(toolName)}_SKIP_UPDATE_CHECK`;
    if (env[toolEnvVar]) {
      return { skip: true, reason: 'tool-env' };
    }
  }

  return { skip: false };
}

const CACHE_FILENAME = 'update-check.json';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

export function clearUpdateCache(toolName: string): boolean {
  try {
    const dirs = appstash(toolName);
    const cacheFile = path.join(dirs.cache, CACHE_FILENAME);
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      return true;
    }
  } catch {}
  return false;
}

/**
 * Write a cache entry that suppresses the update notification.
 *
 * After a CLI `update` command installs a new version, the currently running
 * binary still reports the OLD version via getPackageJson(__dirname). If we
 * merely clear the cache, the next command will fetch the latest from npm and
 * compare it against the stale pkgVersion, producing a false-positive
 * "Update available" message.
 *
 * By writing the current binary's version as `latestVersion`, the next
 * checkForUpdates call sees latestVersion === pkgVersion and returns
 * hasUpdate: false. Once the cache expires (24 h by default), a fresh check
 * runs against the (by then correct) new binary version.
 *
 * @param toolName - Tool name used for appstash directory (e.g., 'pgpm')
 * @param currentVersion - The version of the currently running binary
 * @returns true if the cache was written successfully
 */
export function suppressUpdateCheck(toolName: string, currentVersion: string): boolean {
  try {
    const dirs = appstash(toolName);
    const cacheFile = path.join(dirs.cache, CACHE_FILENAME);
    if (!fs.existsSync(dirs.cache)) {
      fs.mkdirSync(dirs.cache, { recursive: true });
    }
    fs.writeFileSync(cacheFile, JSON.stringify({
      latestVersion: currentVersion,
      timestamp: Date.now()
    }));
    return true;
  } catch {
    // If writing fails, fall back to clearing the old cache
    clearUpdateCache(toolName);
    return false;
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  if (semver.valid(latest) && semver.valid(current)) {
    return semver.gt(latest, current);
  }
  return latest !== current && latest > current;
}

/**
 * Checks for updates to a package and caches the result.
 * Uses appstash for configuration storage.
 * 
 * Automatically skips in CI environments or when skip env vars are set:
 * - CI=true (any CI environment)
 * - INQUIRERER_SKIP_UPDATE_CHECK=1 (generic skip)
 * - {TOOLNAME}_SKIP_UPDATE_CHECK=1 (tool-specific, e.g., PGPM_SKIP_UPDATE_CHECK)
 * 
 * Use `force: true` to bypass skip logic.
 */
export const checkForUpdates = async (
  options: UpdateCheckOptions
): Promise<UpdateCheckResult> => {
  const {
    pkgName,
    pkgVersion,
    registryBaseUrl = DEFAULT_REGISTRY,
    toolName = pkgName,
    ttl = DEFAULT_TTL,
    force = false
  } = options;

  // Check if we should skip (unless force is true)
  if (!force) {
    const skipResult = shouldSkipUpdateCheck(toolName);
    if (skipResult.skip) {
      return {
        hasUpdate: false,
        currentVersion: pkgVersion,
        latestVersion: null,
        message: null,
        skipped: true,
        skipReason: skipResult.reason
      };
    }
  }

  const dirs = appstash(toolName);
  const cacheFile = path.join(dirs.cache, CACHE_FILENAME);

  // Check cache first
  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      if (Date.now() - cached.timestamp < ttl) {
        return {
          hasUpdate: isNewerVersion(cached.latestVersion, pkgVersion),
          currentVersion: pkgVersion,
          latestVersion: cached.latestVersion,
          message: isNewerVersion(cached.latestVersion, pkgVersion)
            ? `Update available: ${pkgVersion} -> ${cached.latestVersion}`
            : null
        };
      }
    }
  } catch {
    // Cache read failed, continue to fetch
  }

  // Fetch latest version from registry
  try {
    const response = await fetch(`${registryBaseUrl}/${pkgName}/latest`);
    if (!response.ok) {
      return {
        hasUpdate: false,
        currentVersion: pkgVersion,
        latestVersion: null,
        message: null
      };
    }

    const data = await response.json();
    const latestVersion = data.version;

    // Cache the result
    try {
      if (!fs.existsSync(dirs.cache)) {
        fs.mkdirSync(dirs.cache, { recursive: true });
      }
      fs.writeFileSync(cacheFile, JSON.stringify({
        latestVersion,
        timestamp: Date.now()
      }));
    } catch {
      // Cache write failed, continue anyway
    }

    return {
      hasUpdate: isNewerVersion(latestVersion, pkgVersion),
      currentVersion: pkgVersion,
      latestVersion,
      message: isNewerVersion(latestVersion, pkgVersion)
        ? `Update available: ${pkgVersion} -> ${latestVersion}`
        : null
    };
  } catch {
    return {
      hasUpdate: false,
      currentVersion: pkgVersion,
      latestVersion: null,
      message: null
    };
  }
};
