import { Inquirerer } from 'inquirerer';
import { Question } from 'inquirerer';

/**
 * Configuration for TemplateScaffolder instance
 */
export interface TemplateScaffolderConfig {
  /**
   * Tool name used for cache directory naming (e.g., 'my-cli' -> ~/.my-cli/cache)
   */
  toolName: string;

  /**
   * Default template repository URL or path.
   * Used when scaffold() is called without specifying a template.
   */
  defaultRepo?: string;

  /**
   * Default branch to use when cloning repositories
   */
  defaultBranch?: string;

  /**
   * Cache time-to-live in milliseconds.
   * Cached templates older than this will be re-cloned.
   * Default: no expiration
   */
  ttlMs?: number;

  /**
   * Base directory for cache storage.
   * Useful for tests to avoid touching the real home directory.
   */
  cacheBaseDir?: string;
}

/**
 * Options for a single scaffold operation
 */
export interface ScaffoldOptions {
  /**
   * Template repository URL, local path, or org/repo shorthand.
   * If not provided, uses the defaultRepo from config.
   */
  template?: string;

  /**
   * Branch to clone (for remote repositories)
   */
  branch?: string;

  /**
   * Subdirectory within the template repository to use as the template root.
   * Can be a direct path or a variant name that gets resolved via .boilerplates.json
   */
  fromPath?: string;

  /**
   * Output directory for the generated project
   */
  outputDir: string;

  /**
   * Pre-populated answers to skip prompting for known values
   */
  answers?: Record<string, any>;

  /**
   * Disable TTY mode for non-interactive environments
   */
  noTty?: boolean;

  /**
   * Optional Inquirerer instance to reuse for prompting.
   * If provided, the caller retains ownership and is responsible for closing it.
   * If not provided, a new instance will be created and closed automatically.
   */
  prompter?: Inquirerer;
}

/**
 * Result of a scaffold operation
 */
export interface ScaffoldResult {
  /**
   * Path to the generated output directory
   */
  outputDir: string;

  /**
   * Whether a cached template was used
   */
  cacheUsed: boolean;

  /**
   * Whether the cache was expired and refreshed
   */
  cacheExpired: boolean;

  /**
   * Path to the cached/cloned template directory
   */
  templateDir: string;

  /**
   * The resolved fromPath used for template processing
   */
  fromPath?: string;

  /**
   * Questions loaded from .boilerplate.json, if any
   */
  questions?: Question[];

  /**
   * Answers collected during prompting
   */
  answers: Record<string, any>;
}

/**
 * Root configuration for a boilerplates repository.
 * Stored in `.boilerplates.json` at the repository root.
 */
export interface BoilerplatesConfig {
  /**
   * Default directory containing boilerplate templates (e.g., "templates", "boilerplates")
   */
  dir?: string;
}

/**
 * Configuration for a single boilerplate template.
 * Stored in `.boilerplate.json` within each template directory.
 */
export interface BoilerplateConfig {
  /**
   * Optional type identifier for the boilerplate
   */
  type?: string;

  /**
   * Questions to prompt the user during scaffolding
   */
  questions?: Question[];
}
