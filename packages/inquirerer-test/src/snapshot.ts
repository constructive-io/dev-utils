/**
 * Options for normalizing package.json for snapshots.
 */
export interface NormalizeOptions {
  /** Package names whose versions should be preserved (not normalized) */
  preserveVersionsFor?: string[];
}

/**
 * Normalizes a package.json object for snapshot testing by replacing
 * dependency versions with a placeholder. This prevents snapshot failures
 * when boilerplate/tooling dependency versions change.
 * 
 * @param pkgJson - The parsed package.json object
 * @param options - Configuration options
 * @returns A new object with normalized dependency versions
 * 
 * @example
 * ```typescript
 * import { normalizePackageJsonForSnapshot } from '@inquirerer/test';
 * 
 * const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
 * const normalized = normalizePackageJsonForSnapshot(pkgJson, {
 *   preserveVersionsFor: ['my-important-package']
 * });
 * 
 * expect(normalized).toMatchSnapshot();
 * ```
 */
export function normalizePackageJsonForSnapshot(
  pkgJson: Record<string, unknown>,
  options: NormalizeOptions = {}
): Record<string, unknown> {
  const { preserveVersionsFor = [] } = options;
  const result = { ...pkgJson };

  const depFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
  ] as const;

  for (const field of depFields) {
    const deps = result[field];
    if (deps && typeof deps === 'object' && !Array.isArray(deps)) {
      const normalizedDeps: Record<string, string> = {};
      const sortedKeys = Object.keys(deps as Record<string, string>).sort();
      
      for (const key of sortedKeys) {
        if (preserveVersionsFor.includes(key)) {
          normalizedDeps[key] = (deps as Record<string, string>)[key];
        } else {
          normalizedDeps[key] = '<VERSION>';
        }
      }
      
      result[field] = normalizedDeps;
    }
  }

  return result;
}

/**
 * Normalizes file paths in output for cross-platform snapshot testing.
 * Replaces absolute paths with placeholders.
 * 
 * @param output - The output string to normalize
 * @param replacements - Map of path patterns to replacement strings
 * @returns Normalized output string
 */
export function normalizePathsForSnapshot(
  output: string,
  replacements: Record<string, string> = {}
): string {
  let result = output;

  // Apply custom replacements first
  for (const [pattern, replacement] of Object.entries(replacements)) {
    result = result.split(pattern).join(replacement);
  }

  // Normalize common temp directory patterns
  result = result.replace(/\/tmp\/[a-zA-Z0-9_-]+/g, '/tmp/<TEMP_DIR>');
  result = result.replace(/\/var\/folders\/[^/]+\/[^/]+\/T\/[a-zA-Z0-9_-]+/g, '<TEMP_DIR>');
  
  // Normalize home directory
  result = result.replace(/\/home\/[a-zA-Z0-9_-]+/g, '/home/<USER>');
  result = result.replace(/\/Users\/[a-zA-Z0-9_-]+/g, '/Users/<USER>');

  return result;
}

/**
 * Normalizes timestamps and dates in output for stable snapshots.
 * 
 * @param output - The output string to normalize
 * @returns Normalized output string
 */
export function normalizeDatesForSnapshot(output: string): string {
  let result = output;

  // ISO date format
  result = result.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/g, '<ISO_DATE>');
  
  // Unix timestamps (13 digits for milliseconds)
  result = result.replace(/\b\d{13}\b/g, '<TIMESTAMP_MS>');
  
  // Unix timestamps (10 digits for seconds)
  result = result.replace(/\b\d{10}\b/g, '<TIMESTAMP_S>');

  return result;
}
