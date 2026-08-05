/**
 * The two operations a workspace performs: write the policy, and verify it.
 */

import { existsSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';

import { loadConfig, resolveFromConfig } from './config';
import { PolicyError } from './errors';
import { readInventory } from './inventory';
import { readWorkspacePackages } from './lockfile';
import type { BuildsKey } from './policy';
import { resolvePolicy } from './policy';
import type { Inventory, PolicyReport, ResolvedConfig, ResolvedPolicy } from './types';
import { workspaceDrift, writeWorkspacePolicy } from './workspace';

export interface RunOptions {
  /** Workspace root. Defaults to the config file's directory. */
  cwd?: string;
  /** Config file or the directory holding one. */
  config?: string;
  buildsKey?: BuildsKey;
  /** Override the config's `intersect`. */
  intersect?: boolean;
  now?: Date;
}

interface Loaded {
  configFile: string;
  config: ResolvedConfig;
  workspaceDir: string;
  policy: ResolvedPolicy;
}

/**
 * Locate the inventory: a path relative to the config, or a package that ships
 * one (`@constructive-io/pnpm-policy`), which is how a fleet of workspaces
 * shares a single reviewed export instead of each keeping its own copy.
 */
function loadInventory(configFile: string, reference: string): Inventory {
  const asPath = resolveFromConfig(configFile, reference);
  if (existsSync(asPath)) return readInventory(asPath);

  const require = createRequire(join(dirname(configFile), 'noop.js'));
  for (const specifier of [reference, `${reference}/inventory.json`]) {
    try {
      return readInventory(require.resolve(specifier));
    } catch {
      // Not resolvable under this specifier; try the next.
    }
  }

  throw new PolicyError(
    `Inventory "${reference}" is neither a file nor a resolvable package. ` +
      'Build one with: pnpm-policy inventory'
  );
}

function load(options: RunOptions): Loaded {
  const { file: configFile, config } = loadConfig(options.config ?? options.cwd ?? process.cwd());
  const workspaceDir = options.cwd ?? dirname(configFile);
  const intersect = options.intersect ?? config.intersect;

  const inventory = config.inventory
    ? loadInventory(configFile, config.inventory)
    : undefined;

  if (!inventory && config.maintainers.length && !config.scopes.length) {
    throw new PolicyError(
      'maintainers are configured but no inventory is available. ' +
        'Run `pnpm-policy inventory` to build one, or set `scopes` to skip the registry.'
    );
  }

  const policy = resolvePolicy({
    config: { ...config, intersect },
    inventory,
    resolved: intersect ? readWorkspacePackages(workspaceDir) : undefined,
    buildsKey: options.buildsKey,
    now: options.now
  });

  return { configFile, config, workspaceDir, policy };
}

export interface GenerateResult {
  file: string;
  changed: boolean;
  report: PolicyReport;
}

/** Write the policy into `pnpm-workspace.yaml`. */
export function generate(options: RunOptions = {}): GenerateResult {
  const { workspaceDir, policy } = load(options);
  const { file, changed } = writeWorkspacePolicy(workspaceDir, policy, {
    buildsKey: options.buildsKey
  });
  return { file, changed, report: policy.report };
}

export interface CheckResult {
  file: string;
  /** The workspace file no longer matches what the policy generates. */
  drifted: boolean;
  /** Waivers whose `until` date has passed. */
  expired: PolicyReport['expiredExceptions'];
  expected: string;
  actual: string;
  report: PolicyReport;
  ok: boolean;
}

/**
 * Verify the committed policy without changing it.
 *
 * Two ways to fail, and they are different problems: the file drifted from the
 * config (someone hand-edited it, or forgot to regenerate), or a waiver expired
 * (the exception is still in force but nobody re-justified it).
 */
export function check(options: RunOptions = {}): CheckResult {
  const { workspaceDir, policy } = load(options);
  const { file, expected, actual, drifted } = workspaceDrift(workspaceDir, policy, {
    buildsKey: options.buildsKey
  });
  const expired = policy.report.expiredExceptions;

  return {
    file,
    drifted,
    expired,
    expected,
    actual,
    report: policy.report,
    ok: !drifted && expired.length === 0
  };
}
