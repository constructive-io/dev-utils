/**
 * Resolve a {@link Workspace} from config: pick the provider(s), run them,
 * compose their package sets (union by name, edges merged), and apply the
 * include/exclude filter. This is where "which set of packages do you mean"
 * gets answered.
 */
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

import { loadConfig } from './config';
import { makeMatcher } from './glob';
import { getProvider, providerNames } from './registry';
import type { ProviderContext, Workspace, WorkspaceProvider, WsChangedConfig } from './types';

export interface LoadWorkspaceParams {
  cwd?: string;
  configFile?: string;
  /** Config overrides applied over discovered files (CLI flags). */
  overrides?: Partial<WsChangedConfig>;
}

/** The git repo root of `cwd`, or `undefined` outside a repository. */
function repoRoot(cwd: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8'
    }).trim();
  } catch {
    return undefined;
  }
}

/** Resolve the workspace root: explicit config, else git root, else cwd. */
export function resolveRoot(config: WsChangedConfig, cwd: string): string {
  if (config.root) return resolve(cwd, config.root);
  return repoRoot(cwd) ?? cwd;
}

function providerList(config: WsChangedConfig): WorkspaceProvider[] {
  const names = Array.isArray(config.provider)
    ? config.provider
    : [config.provider ?? 'pnpm'];
  const providers: WorkspaceProvider[] = [];
  for (const name of names) {
    const provider = getProvider(name);
    if (!provider) {
      throw new Error(
        `Unknown workspace provider: "${name}". Registered: ${providerNames().join(', ')}`
      );
    }
    providers.push(provider);
  }
  return providers;
}

/**
 * Discover the workspace. Multiple providers are composed: a package present
 * under more than one provider keeps its first appearance's directory and
 * unions its edges, so `provider: ['pnpm','pgpm']` yields JS *and* SQL edges on
 * the same node set.
 */
export function loadWorkspace(params: LoadWorkspaceParams = {}): {
  workspace: Workspace;
  config: WsChangedConfig;
  configPath?: string;
} {
  const cwd = resolve(params.cwd ?? process.cwd());
  const { config, filepath } = loadConfig({
    cwd,
    configFile: params.configFile,
    overrides: params.overrides
  });
  const root = resolveRoot(config, cwd);
  if (!existsSync(root)) throw new Error(`Workspace root does not exist: ${root}`);

  const providers = providerList(config);
  const ctx: ProviderContext = { root, config };

  const byName = new Map<string, Workspace['packages'][number]>();
  for (const provider of providers) {
    for (const pkg of provider.discover(ctx)) {
      const existing = byName.get(pkg.name);
      if (!existing) {
        byName.set(pkg.name, { ...pkg });
        continue;
      }
      // Compose: union edges, remember every provider that saw this node.
      existing.requires = [...new Set([...existing.requires, ...pkg.requires])].sort();
      existing.external = [...new Set([...existing.external, ...pkg.external])].sort();
      existing.provider = `${existing.provider}+${pkg.provider}`;
      existing.meta = { ...(existing.meta ?? {}), [`${pkg.provider}`]: pkg.meta };
    }
  }

  let packages = [...byName.values()];

  const include = config.include ?? [];
  if (include.length) {
    const match = makeMatcher(include);
    packages = packages.filter((p) => match(p.relDir));
  }
  const exclude = config.exclude ?? [];
  if (exclude.length) {
    const match = makeMatcher(exclude);
    packages = packages.filter((p) => !match(p.relDir));
  }

  packages.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return {
    workspace: { root, providers: providers.map((p) => p.name), packages },
    config,
    configPath: filepath
  };
}
