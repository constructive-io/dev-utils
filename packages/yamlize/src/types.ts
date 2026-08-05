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

/** A location in a YAML document: `'a.b.c'` or `['a', 'b', 'c']`. */
export type YamlPath = string | Array<string | number>;

/**
 * Comments keyed by path.
 *
 * The record form reads better and covers most keys; the entry form takes an
 * explicit path array, which is the only way to address a key that contains a
 * dot (`lodash.merge`) without it being read as two segments.
 */
export type CommentMap =
  | Record<string, string>
  | Array<[YamlPath, string]>;

/** Comments to attach to a serialized document. */
export interface CommentOptions {
  /** Comment block written above the whole document. */
  header?: string;
  /** Comment block written below the whole document. */
  footer?: string;
  /** Comment blocks written above the addressed key or sequence item. */
  before?: CommentMap;
  /** Comments written at the end of the addressed key's line. */
  inline?: CommentMap;
}

/** Options for serializing to YAML. */
export interface ToYamlOptions {
  /** Comments to attach to the output. */
  comments?: CommentOptions;
  /** Wrap width. 0 disables wrapping, which is the default. */
  lineWidth?: number;
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
