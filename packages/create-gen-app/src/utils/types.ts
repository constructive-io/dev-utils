export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  isOutdated: boolean;
  error?: string;
}
