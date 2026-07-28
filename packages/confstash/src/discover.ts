import * as fs from 'fs';
import * as path from 'path';

import type { SearchPlace } from './types';

/**
 * Default search places for a tool, in precedence order:
 *
 *   <tool>.config.ts / .js / .mjs / .cjs
 *   .<tool>rc / .<tool>rc.json / .<tool>rc.yaml / .<tool>rc.yml / .<tool>rc.js
 *   <tool>.json
 *   package.json ("<tool>" key)
 */
export function defaultSearchPlaces(tool: string): SearchPlace[] {
  return [
    `${tool}.config.ts`,
    `${tool}.config.js`,
    `${tool}.config.mjs`,
    `${tool}.config.cjs`,
    `.${tool}rc`,
    `.${tool}rc.json`,
    `.${tool}rc.yaml`,
    `.${tool}rc.yml`,
    `.${tool}rc.js`,
    `${tool}.json`,
    { packageJson: tool }
  ];
}

export interface FoundConfig {
  /** Absolute path of the file containing the config. */
  filepath: string;
  /** Set when the config lives under a key in package.json. */
  packageJsonKey?: string;
}

/**
 * Walk up from `startDir` looking for the first directory containing any of
 * the search places. Within a directory, places are checked in order.
 */
export function findConfigSync(
  startDir: string,
  searchPlaces: SearchPlace[],
  walkUp: boolean = true
): FoundConfig | null {
  let currentDir = path.resolve(startDir);

  for (;;) {
    for (const place of searchPlaces) {
      if (typeof place === 'string') {
        const candidate = path.join(currentDir, place);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { filepath: candidate };
        }
      } else {
        const pkgPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(pkgPath) && packageJsonHasKey(pkgPath, place.packageJson)) {
          return { filepath: pkgPath, packageJsonKey: place.packageJson };
        }
      }
    }

    if (!walkUp) return null;
    const parent = path.dirname(currentDir);
    if (parent === currentDir) return null;
    currentDir = parent;
  }
}

function packageJsonHasKey(pkgPath: string, key: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg != null && typeof pkg === 'object' && pkg[key] != null;
  } catch {
    return false;
  }
}

/**
 * Walk up from `startDir` to find the directory containing `filename`.
 * Returns the directory path or null. (Non-throwing analog of
 * `@pgpmjs/env`'s `walkUp`.)
 */
export function findUpDir(startDir: string, filename: string): string | null {
  let currentDir = path.resolve(startDir);

  for (;;) {
    if (fs.existsSync(path.join(currentDir, filename))) {
      return currentDir;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) return null;
    currentDir = parent;
  }
}
