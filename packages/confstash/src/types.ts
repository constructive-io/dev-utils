/**
 * Core types for confstash — standardized project configuration loading.
 */

/**
 * A place to search for configuration. Either a filename (searched during the
 * walk-up) or a key inside `package.json`.
 */
export type SearchPlace = string | { packageJson: string };

/** Where a resolved config value (or layer) came from. */
export type LayerSource =
  | 'defaults'
  | 'preset'
  | 'user'
  | 'file'
  | 'env'
  | 'overrides';

export interface ConfigLayer<T = Record<string, unknown>> {
  source: LayerSource;
  /** Human-readable origin: file path, preset name, env prefix, … */
  origin: string;
  config: Partial<T>;
}

export interface LoadResult<T = Record<string, unknown>> {
  /** Fully merged configuration. */
  config: T;
  /** Path of the project config file that was found, if any. */
  filepath?: string;
  /** Every layer that contributed, in merge order (lowest precedence first). */
  layers: ConfigLayer<T>[];
  /** Whether any project config file was found. */
  isEmpty: boolean;
}

export type ArrayMergeStrategy = 'replace' | 'concat';

export interface LoadParams<T = Record<string, unknown>> {
  /** Directory to start the walk-up search from. Default: process.cwd(). */
  cwd?: string;
  /** Highest-precedence overrides (e.g. parsed CLI flags). */
  overrides?: Partial<T>;
  /** Load an exact config file, skipping discovery. */
  configFile?: string;
  /** Environment to read the env layer from. Default: process.env. */
  env?: NodeJS.ProcessEnv;
}

export interface ConfigLoaderOptions<T = Record<string, unknown>> {
  /** Tool name, e.g. 'safegres'. Drives default search places and stash dir. */
  tool: string;
  /**
   * Ordered list of places to look for project config. When omitted, defaults
   * derived from the tool name are used (see `defaultSearchPlaces`).
   */
  searchPlaces?: SearchPlace[];
  /** Built-in defaults — the lowest-precedence layer. */
  defaults?: Partial<T>;
  /**
   * Named presets resolvable via `extends` (e.g. `'safegres:recommended'`).
   * A preset is just a partial config, and may itself use `extends`.
   */
  presets?: Record<string, Partial<T>>;
  /**
   * Map environment variables into a config layer. Return a partial config.
   * Runs between the project-file layer and CLI overrides.
   */
  envLayer?: (env: NodeJS.ProcessEnv) => Partial<T>;
  /**
   * Include a user-level layer read from `~/.<tool>/config/config.json`
   * (via appstash). Default: false.
   */
  userStash?: boolean;
  /** Array merge behavior. Default: 'replace' (later layers win entirely). */
  arrayMerge?: ArrayMergeStrategy;
  /**
   * Validate/normalize the final merged config. Throw to reject. The return
   * value (if not undefined) replaces the config.
   */
  validate?: (config: T) => T | void;
  /**
   * When true, `load()`/`loadSync()` stop at the first search place found in
   * each directory but keep walking up if none matched (cosmiconfig behavior).
   * Default: true. When false, only `cwd` itself is searched.
   */
  walkUp?: boolean;
}

/** A single key's provenance, produced by `explain()`. */
export interface ExplainedValue {
  path: string;
  value: unknown;
  source: LayerSource;
  origin: string;
}
