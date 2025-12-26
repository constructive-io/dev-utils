import { execSync } from 'child_process';
import { VersionCheckResult } from './types';

/**
 * Check if current package version is outdated compared to npm registry
 * @param packageName - Package name to check
 * @param currentVersion - Current version string
 * @returns Version comparison result
 */
export async function checkNpmVersion(
  packageName: string,
  currentVersion: string
): Promise<VersionCheckResult> {
  try {
    const latestVersion = execSync(
      `npm view ${packageName} version`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();

    const isOutdated = compareVersions(currentVersion, latestVersion) < 0;

    return {
      currentVersion,
      latestVersion,
      isOutdated,
    };
  } catch (error) {
    return {
      currentVersion,
      latestVersion: null,
      isOutdated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Compare two semver version strings
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

/**
 * Print version warning to console if outdated
 */
export function warnIfOutdated(
  packageName: string,
  result: VersionCheckResult
): void {
  if (result.isOutdated && result.latestVersion) {
    console.warn(
      `\n⚠️  New version available: ${result.currentVersion} → ${result.latestVersion}`
    );
    console.warn(`   Run: npm install -g ${packageName}@latest\n`);
  }
}
