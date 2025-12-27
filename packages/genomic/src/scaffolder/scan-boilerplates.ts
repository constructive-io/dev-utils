import * as fs from 'fs';
import * as path from 'path';

import { BoilerplateConfig } from './types';

/**
 * Directories to skip during recursive scanning.
 * These are common directories that should never contain boilerplates.
 */
const SKIP_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.pnpm',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
]);

/**
 * Result of scanning for boilerplates.
 */
export interface ScannedBoilerplate {
  /**
   * The relative path from the scan root to the boilerplate directory.
   * For example: "default/module", "default/workspace"
   */
  relativePath: string;

  /**
   * The absolute path to the boilerplate directory.
   */
  absolutePath: string;

  /**
   * The boilerplate configuration from .boilerplate.json
   */
  config: BoilerplateConfig;
}

/**
 * Options for scanning boilerplates.
 */
export interface ScanBoilerplatesOptions {
  /**
   * Maximum depth to recurse into directories.
   * Default: 10 (should be enough for any reasonable structure)
   */
  maxDepth?: number;

  /**
   * Additional directory names to skip during scanning.
   */
  skipDirectories?: string[];
}

/**
 * Read the .boilerplate.json configuration from a directory.
 * 
 * @param dirPath - The directory path to check
 * @returns The boilerplate config or null if not found
 */
export function readBoilerplateConfig(dirPath: string): BoilerplateConfig | null {
  const configPath = path.join(dirPath, '.boilerplate.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as BoilerplateConfig;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Recursively scan a directory for boilerplate templates.
 * 
 * A boilerplate is any directory containing a `.boilerplate.json` file.
 * This function recursively searches the entire directory tree (with sensible
 * pruning of common non-template directories like node_modules, .git, etc.)
 * and returns all discovered boilerplates with their relative paths.
 * 
 * This is useful when:
 * - The user specifies `--dir .` to bypass `.boilerplates.json`
 * - You want to discover all available boilerplates regardless of nesting
 * - You need to match a `fromPath` against available boilerplates
 * 
 * @param baseDir - The root directory to start scanning from
 * @param options - Scanning options
 * @returns Array of discovered boilerplates with relative paths
 * 
 * @example
 * ```typescript
 * // Given structure:
 * // repo/
 * //   default/
 * //     module/.boilerplate.json
 * //     workspace/.boilerplate.json
 * //   scripts/  (no .boilerplate.json)
 * 
 * const boilerplates = scanBoilerplatesRecursive('/path/to/repo');
 * // Returns:
 * // [
 * //   { relativePath: 'default/module', absolutePath: '...', config: {...} },
 * //   { relativePath: 'default/workspace', absolutePath: '...', config: {...} }
 * // ]
 * // Note: 'scripts' is not included because it has no .boilerplate.json
 * ```
 */
export function scanBoilerplatesRecursive(
  baseDir: string,
  options: ScanBoilerplatesOptions = {}
): ScannedBoilerplate[] {
  const { maxDepth = 10, skipDirectories = [] } = options;
  const boilerplates: ScannedBoilerplate[] = [];
  const skipSet = new Set([...SKIP_DIRECTORIES, ...skipDirectories]);

  function scan(currentDir: string, relativePath: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }

    if (!fs.existsSync(currentDir)) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (skipSet.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(currentDir, entry.name);
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      const config = readBoilerplateConfig(entryPath);
      if (config) {
        boilerplates.push({
          relativePath: entryRelativePath,
          absolutePath: entryPath,
          config,
        });
      }

      // Continue scanning subdirectories even if this directory is a boilerplate
      // (in case there are nested boilerplates, though uncommon)
      scan(entryPath, entryRelativePath, depth + 1);
    }
  }

  scan(baseDir, '', 0);

  // Sort by relative path for consistent ordering
  boilerplates.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return boilerplates;
}

/**
 * Find a boilerplate by matching against a fromPath.
 * 
 * This function attempts to match a user-provided `fromPath` against
 * discovered boilerplates. It supports:
 * 1. Exact match: `fromPath` matches a relative path exactly
 * 2. Basename match: `fromPath` matches the last segment of a relative path
 *    (only if unambiguous - i.e., exactly one match)
 * 
 * @param boilerplates - Array of scanned boilerplates
 * @param fromPath - The path to match against
 * @returns The matching boilerplate, or null if no match or ambiguous
 * 
 * @example
 * ```typescript
 * const boilerplates = scanBoilerplatesRecursive('/path/to/repo');
 * 
 * // Exact match
 * findBoilerplateByPath(boilerplates, 'default/module');
 * // Returns the 'default/module' boilerplate
 * 
 * // Basename match (unambiguous)
 * findBoilerplateByPath(boilerplates, 'module');
 * // Returns the 'default/module' boilerplate if it's the only one ending in 'module'
 * 
 * // Ambiguous basename match
 * // If both 'default/module' and 'supabase/module' exist:
 * findBoilerplateByPath(boilerplates, 'module');
 * // Returns null (ambiguous)
 * ```
 */
export function findBoilerplateByPath(
  boilerplates: ScannedBoilerplate[],
  fromPath: string
): ScannedBoilerplate | null {
  // Normalize the fromPath (remove leading/trailing slashes)
  const normalizedPath = fromPath.replace(/^\/+|\/+$/g, '');

  // Try exact match first
  const exactMatch = boilerplates.find(
    (bp) => bp.relativePath === normalizedPath
  );
  if (exactMatch) {
    return exactMatch;
  }

  // Try basename match (last segment of path)
  const basename = path.basename(normalizedPath);
  const basenameMatches = boilerplates.filter(
    (bp) => path.basename(bp.relativePath) === basename
  );

  // Only return if unambiguous (exactly one match)
  if (basenameMatches.length === 1) {
    return basenameMatches[0];
  }

  return null;
}

/**
 * Find a boilerplate by type within a scanned list.
 * 
 * @param boilerplates - Array of scanned boilerplates
 * @param type - The type to find (e.g., 'workspace', 'module')
 * @returns The matching boilerplate or undefined
 */
export function findBoilerplateByType(
  boilerplates: ScannedBoilerplate[],
  type: string
): ScannedBoilerplate | undefined {
  return boilerplates.find((bp) => bp.config.type === type);
}

/**
 * Get all boilerplates of a specific type.
 * 
 * @param boilerplates - Array of scanned boilerplates
 * @param type - The type to filter by
 * @returns Array of matching boilerplates
 */
export function filterBoilerplatesByType(
  boilerplates: ScannedBoilerplate[],
  type: string
): ScannedBoilerplate[] {
  return boilerplates.filter((bp) => bp.config.type === type);
}
