/**
 * Config loading via confstash. Discovers `ws-changed.config.{ts,js,json}`,
 * `.ws-changedrc{,.json,.yaml}`, and a `ws-changed` key in package.json by
 * walking up from `cwd`, merges them over the defaults, and applies runtime
 * overrides (the CLI's parsed flags) on top.
 */
import { createConfigLoader } from 'confstash';

import type { WsChangedConfig } from './types';

export const DEFAULT_CONFIG: WsChangedConfig = {
  provider: 'pnpm',
  global: [],
  providers: {}
};

/**
 * Load and merge configuration. `overrides` (e.g. CLI flags) win over every
 * discovered file; `configFile` forces a specific file instead of discovery.
 */
export function loadConfig(params: {
  cwd?: string;
  configFile?: string;
  overrides?: Partial<WsChangedConfig>;
} = {}): { config: WsChangedConfig; filepath?: string } {
  const loader = createConfigLoader<WsChangedConfig>({
    tool: 'ws-changed',
    defaults: DEFAULT_CONFIG,
    // A changed lockfile or CI change should invalidate everything, so let the
    // environment inject a global-trigger list without a config file.
    envLayer: (env) =>
      env.WS_CHANGED_GLOBAL
        ? { global: env.WS_CHANGED_GLOBAL.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}
  });
  const result = loader.loadSync({
    cwd: params.cwd,
    configFile: params.configFile,
    overrides: params.overrides
  });
  return { config: result.config, filepath: result.filepath };
}
