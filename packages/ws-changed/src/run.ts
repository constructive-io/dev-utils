/**
 * The one-call path most callers want: resolve the workspace, ask git-changed
 * what changed against a base, and return the affected packages. Everything it
 * composes is exported separately for callers that already hold changed paths
 * or a workspace.
 */
import { changedFiles } from 'git-changed';

import { affected } from './affected';
import type { AffectedResult, Workspace, WsChangedConfig } from './types';
import { loadWorkspace } from './workspace';

export interface WsChangedParams {
  cwd?: string;
  configFile?: string;
  /** Config overrides applied over discovered files. */
  overrides?: Partial<WsChangedConfig>;
  /**
   * Base ref to diff against (passed to git-changed). Omit to auto-resolve
   * (`$GITHUB_BASE_REF` → default branch); pass `false` for working-tree only.
   */
  base?: string | false;
  /** Provide changed paths directly instead of calling git. */
  changed?: string[];
}

export interface WsChangedRun {
  workspace: Workspace;
  config: WsChangedConfig;
  configPath?: string;
  result: AffectedResult;
  base?: string;
}

/** Resolve workspace + changed files + affected in one call. */
export function wsChanged(params: WsChangedParams = {}): WsChangedRun {
  const { workspace, config, configPath } = loadWorkspace({
    cwd: params.cwd,
    configFile: params.configFile,
    overrides: params.overrides
  });

  let changed = params.changed;
  let base: string | undefined;
  if (!changed) {
    // Diff at the workspace root so relative paths line up with package relDirs.
    const cr = changedFiles({ cwd: workspace.root, base: params.base });
    changed = cr.paths;
    base = cr.base;
  }

  const result = affected(workspace, { changed, global: config.global });
  return { workspace, config, configPath, result, base };
}
