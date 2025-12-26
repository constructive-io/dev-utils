import { Question } from 'commodore';

/**
 * Questions configuration that can be loaded from .boilerplate.json or .boilerplate.js
 * @typedef {Object} Questions
 * @property {Question[]} questions - Array of commodore questions
 */
export interface Questions {
  questions: Question[];
}

/**
 * Variable extracted from filename patterns like ____variable____
 */
export interface FileReplacer {
  variable: string;
  pattern: RegExp;
}

/**
 * Variable extracted from file content patterns like ____variable____
 */
export interface ContentReplacer {
  variable: string;
  pattern: RegExp;
}

/**
 * Options for creating a new project from a template
 */
export interface CreateGenOptions {
  /**
   * URL or path to the template repository
   */
  templateUrl: string;
  
  /**
   * Optional branch or tag to checkout after cloning
   */
  fromBranch?: string;

  /**
   * Path inside the repository to use as the template root
   */
  fromPath?: string;
  
  /**
   * Destination directory for the generated project
   */
  outputDir: string;
  
  /**
   * Command-line arguments to pre-populate answers
   */
  argv?: Record<string, any>;
  
  /**
   * Whether to use TTY for interactive prompts
   */
  noTty?: boolean;

  /**
   * Optional caching configuration. Pass `false` to disable caching entirely.
   */
  cache?: CacheOptions | false;
}

/**
 * Options that control template caching behavior
 */
export interface CacheOptions {
  /**
   * Enable or disable caching. Defaults to true.
   */
  enabled?: boolean;

  /**
   * Tool name used for appstash (affects ~/.<tool> dirs). Defaults to `pgpm`.
   */
  toolName?: string;

  /**
   * Optional base directory for appstash. Useful for tests to avoid touching the real home dir.
   */
  baseDir?: string;

  /**
   * Time-to-live in milliseconds. If set, cached templates older than this will be invalidated.
   * Defaults to undefined (no expiration).
   */
  ttl?: number;

  /**
   * Alias for ttl. Maximum age in milliseconds for cached templates.
   * Defaults to undefined (no expiration).
   */
  maxAge?: number;
}

/**
 * Result of extracting variables from a template
 */
export interface ExtractedVariables {
  fileReplacers: FileReplacer[];
  contentReplacers: ContentReplacer[];
  projectQuestions: Questions | null;
}

/**
 * Context for processing a template
 */
export interface TemplateContext {
  tempDir: string;
  extractedVariables: ExtractedVariables;
  answers: Record<string, any>;
}
