import { appstash } from 'appstash';
import * as fs from 'fs';
import * as path from 'path';

export interface UpdateCheckOptions {
  pkgName: string;
  pkgVersion: string;
  registryBaseUrl?: string;
  toolName?: string;
  ttl?: number;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  message: string | null;
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

/**
 * Checks for updates to a package and caches the result.
 * Uses appstash for configuration storage.
 */
export const checkForUpdates = async (
  options: UpdateCheckOptions
): Promise<UpdateCheckResult> => {
  const {
    pkgName,
    pkgVersion,
    registryBaseUrl = DEFAULT_REGISTRY,
    toolName = pkgName,
    ttl = DEFAULT_TTL
  } = options;

  const dirs = appstash(toolName);
  const cacheFile = path.join(dirs.cache, 'update-check.json');

  // Check cache first
  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      if (Date.now() - cached.timestamp < ttl) {
        return {
          hasUpdate: cached.latestVersion !== pkgVersion && cached.latestVersion > pkgVersion,
          currentVersion: pkgVersion,
          latestVersion: cached.latestVersion,
          message: cached.latestVersion > pkgVersion
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
      hasUpdate: latestVersion !== pkgVersion && latestVersion > pkgVersion,
      currentVersion: pkgVersion,
      latestVersion,
      message: latestVersion > pkgVersion
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
