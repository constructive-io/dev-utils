export interface SkillInstallOptions {
  /**
   * Tool name for cache directory naming (e.g., 'pgpm' -> ~/.pgpm/cache).
   * Sharing the same toolName as your TemplateScaffolder means skills
   * and templates share the same cache directory.
   * @default 'genomic'
   */
  toolName?: string;

  /**
   * Cache TTL in milliseconds for cloned skill source repos.
   * @default 7 days
   */
  cacheTtlMs?: number;

  /**
   * Base directory for cache storage.
   * Useful for tests to avoid touching the real home directory.
   */
  cacheBaseDir?: string;
}

export interface SkillInstallResult {
  /** Successfully installed skill names */
  installed: string[];
  /** Skills that failed to install */
  failed: SkillInstallFailure[];
}

export interface SkillInstallFailure {
  /** Skill name that failed */
  skill: string;
  /** Source repository */
  source: string;
  /** Error description */
  error: string;
}
