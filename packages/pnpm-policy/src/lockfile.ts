/**
 * Reading the set of packages a workspace actually resolves.
 *
 * The lockfile is the honest answer to "what does this workspace depend on":
 * it covers transitive dependencies, which a walk of every package.json does
 * not, and those are exactly the ones an exemption list forgets.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

import { PolicyError } from './errors';

export const LOCKFILE_NAME = 'pnpm-lock.yaml';

interface LockfileShape {
  packages?: Record<string, unknown>;
  snapshots?: Record<string, unknown>;
}

/**
 * Strip a lockfile key down to a package name.
 *
 * Keys look like `name@1.2.3`, `@scope/name@1.2.3`, or carry a peer suffix:
 * `@scope/name@1.2.3(react@18.0.0)`.
 */
export function packageNameFromLockKey(key: string): string | undefined {
  const cleaned = key.replace(/^\//, '').split('(')[0];
  const at = cleaned.indexOf('@', cleaned.startsWith('@') ? 1 : 0);
  if (at <= 0) return undefined;
  return cleaned.slice(0, at);
}

/** Every package name resolved in a lockfile, direct and transitive. */
export function readLockfilePackages(lockfilePath: string): Set<string> {
  if (!existsSync(lockfilePath)) {
    throw new PolicyError(
      `No ${LOCKFILE_NAME} at ${lockfilePath}. Run pnpm install first, or pass --no-intersect.`
    );
  }

  const lockfile = parseYaml(readFileSync(lockfilePath, 'utf-8')) as LockfileShape | null;
  const names = new Set<string>();

  for (const section of [lockfile?.packages, lockfile?.snapshots]) {
    for (const key of Object.keys(section ?? {})) {
      const name = packageNameFromLockKey(key);
      if (name) names.add(name);
    }
  }

  return names;
}

/** Convenience: the lockfile beside a workspace root. */
export function readWorkspacePackages(workspaceDir: string): Set<string> {
  return readLockfilePackages(join(workspaceDir, LOCKFILE_NAME));
}
