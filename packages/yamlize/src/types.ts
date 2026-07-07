/**
 * Core types for the yamlize templating engine.
 */

/** Context object passed to template variable resolution. */
export type YamlizeContext = Record<string, unknown>;

/** Options for the yamlize function. */
export interface YamlizeOptions {
  /** Base directory for resolving import-yaml paths. Defaults to dirname of input file. */
  baseDir?: string;
}

/** Options for deep merge. */
export interface MergeOptions {
  /** When true, null values in overrides remove the key from the result. */
  nullRemoves?: boolean;
}

/** A parsed YAML node — either a scalar, array, or object. */
export type YamlNode =
  | string
  | number
  | boolean
  | null
  | YamlNode[]
  | { [key: string]: YamlNode };
