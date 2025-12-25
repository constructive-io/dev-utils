import * as fs from 'fs';
import * as path from 'path';

import { CacheManager } from '../cache/cache-manager';
import { GitCloner } from '../git/git-cloner';
import { Templatizer } from '../template/templatizer';
import {
  TemplateScaffolderConfig,
  ScaffoldOptions,
  ScaffoldResult,
  BoilerplatesConfig,
  BoilerplateConfig,
} from './types';

/**
 * High-level orchestrator for template scaffolding operations.
 * Combines CacheManager, GitCloner, and Templatizer into a single, easy-to-use API.
 *
 * @example
 * ```typescript
 * const scaffolder = new TemplateScaffolder({
 *   toolName: 'my-cli',
 *   defaultRepo: 'https://github.com/org/templates.git',
 *   ttlMs: 7 * 24 * 60 * 60 * 1000, // 1 week
 * });
 *
 * await scaffolder.scaffold({
 *   outputDir: './my-project',
 *   fromPath: 'starter',
 *   answers: { name: 'my-project' },
 * });
 * ```
 */
export class TemplateScaffolder {
  private config: TemplateScaffolderConfig;
  private cacheManager: CacheManager;
  private gitCloner: GitCloner;
  private templatizer: Templatizer;

  constructor(config: TemplateScaffolderConfig) {
    if (!config.toolName) {
      throw new Error('TemplateScaffolder requires toolName in config');
    }

    this.config = config;
    this.cacheManager = new CacheManager({
      toolName: config.toolName,
      ttl: config.ttlMs,
      baseDir: config.cacheBaseDir,
    });
    this.gitCloner = new GitCloner();
    this.templatizer = new Templatizer();
  }

  /**
   * Scaffold a new project from a template.
   *
   * Handles both local directories and remote git repositories.
   * For remote repos, caching is used to avoid repeated cloning.
   *
   * @param options - Scaffold options
   * @returns Scaffold result with output path and metadata
   */
  async scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
    const template = options.template ?? this.config.defaultRepo;
    if (!template) {
      throw new Error(
        'No template specified and no defaultRepo configured. ' +
        'Either pass template in options or set defaultRepo in config.'
      );
    }

    const branch = options.branch ?? this.config.defaultBranch;
    const resolvedTemplate = this.resolveTemplatePath(template);

    if (this.isLocalPath(resolvedTemplate) && fs.existsSync(resolvedTemplate)) {
      return this.scaffoldFromLocal(resolvedTemplate, options);
    }

    return this.scaffoldFromRemote(resolvedTemplate, branch, options);
  }

  /**
   * Read the .boilerplates.json configuration from a template repository root.
   */
  readBoilerplatesConfig(templateDir: string): BoilerplatesConfig | null {
    const configPath = path.join(templateDir, '.boilerplates.json');
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as BoilerplatesConfig;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Read the .boilerplate.json configuration from a boilerplate directory.
   */
  readBoilerplateConfig(boilerplatePath: string): BoilerplateConfig | null {
    const jsonPath = path.join(boilerplatePath, '.boilerplate.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        return JSON.parse(content) as BoilerplateConfig;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Get the underlying CacheManager instance for advanced cache operations.
   */
  getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * Get the underlying GitCloner instance for advanced git operations.
   */
  getGitCloner(): GitCloner {
    return this.gitCloner;
  }

  /**
   * Get the underlying Templatizer instance for advanced template operations.
   */
  getTemplatizer(): Templatizer {
    return this.templatizer;
  }

  private async scaffoldFromLocal(
    templateDir: string,
    options: ScaffoldOptions
  ): Promise<ScaffoldResult> {
    const { fromPath, resolvedTemplatePath } = this.resolveFromPath(
      templateDir,
      options.fromPath
    );

    const boilerplateConfig = this.readBoilerplateConfig(resolvedTemplatePath);

    const result = await this.templatizer.process(templateDir, options.outputDir, {
      argv: options.answers,
      noTty: options.noTty,
      fromPath,
      prompter: options.prompter,
    });

    return {
      outputDir: result.outputDir,
      cacheUsed: false,
      cacheExpired: false,
      templateDir,
      fromPath,
      questions: boilerplateConfig?.questions,
      answers: result.answers,
    };
  }

  private async scaffoldFromRemote(
    templateUrl: string,
    branch: string | undefined,
    options: ScaffoldOptions
  ): Promise<ScaffoldResult> {
    const normalizedUrl = this.gitCloner.normalizeUrl(templateUrl);
    const cacheKey = this.cacheManager.createKey(normalizedUrl, branch);

    const expiredMetadata = this.cacheManager.checkExpiration(cacheKey);
    if (expiredMetadata) {
      this.cacheManager.clear(cacheKey);
    }

    let templateDir: string;
    let cacheUsed = false;

    const cachedPath = this.cacheManager.get(cacheKey);
    if (cachedPath && !expiredMetadata) {
      templateDir = cachedPath;
      cacheUsed = true;
    } else {
      const tempDest = path.join(this.cacheManager.getReposDir(), cacheKey);
      this.gitCloner.clone(normalizedUrl, tempDest, {
        branch,
        depth: 1,
        singleBranch: true,
      });
      this.cacheManager.set(cacheKey, tempDest);
      templateDir = tempDest;
    }

    const { fromPath, resolvedTemplatePath } = this.resolveFromPath(
      templateDir,
      options.fromPath
    );

    const boilerplateConfig = this.readBoilerplateConfig(resolvedTemplatePath);

    const result = await this.templatizer.process(templateDir, options.outputDir, {
      argv: options.answers,
      noTty: options.noTty,
      fromPath,
      prompter: options.prompter,
    });

    return {
      outputDir: result.outputDir,
      cacheUsed,
      cacheExpired: Boolean(expiredMetadata),
      templateDir,
      fromPath,
      questions: boilerplateConfig?.questions,
      answers: result.answers,
    };
  }

  /**
   * Resolve the fromPath using .boilerplates.json convention.
   *
   * Resolution order:
   * 1. If explicit fromPath is provided and exists, use it directly
   * 2. If .boilerplates.json exists with a dir field, prepend it to fromPath
   * 3. Return the fromPath as-is
   */
  private resolveFromPath(
    templateDir: string,
    fromPath?: string
  ): { fromPath?: string; resolvedTemplatePath: string } {
    if (!fromPath) {
      return {
        fromPath: undefined,
        resolvedTemplatePath: templateDir,
      };
    }

    const directPath = path.isAbsolute(fromPath)
      ? fromPath
      : path.join(templateDir, fromPath);

    if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
      return {
        fromPath: path.isAbsolute(fromPath) ? path.relative(templateDir, fromPath) : fromPath,
        resolvedTemplatePath: directPath,
      };
    }

    const rootConfig = this.readBoilerplatesConfig(templateDir);
    if (rootConfig?.dir) {
      const configBasedPath = path.join(templateDir, rootConfig.dir, fromPath);
      if (fs.existsSync(configBasedPath) && fs.statSync(configBasedPath).isDirectory()) {
        return {
          fromPath: path.join(rootConfig.dir, fromPath),
          resolvedTemplatePath: configBasedPath,
        };
      }
    }

    return {
      fromPath,
      resolvedTemplatePath: path.join(templateDir, fromPath),
    };
  }

  private isLocalPath(value: string): boolean {
    return (
      value.startsWith('.') ||
      value.startsWith('/') ||
      value.startsWith('~') ||
      (process.platform === 'win32' && /^[a-zA-Z]:/.test(value))
    );
  }

  private resolveTemplatePath(template: string): string {
    if (this.isLocalPath(template)) {
      if (template.startsWith('~')) {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(home, template.slice(1));
      }
      return path.resolve(template);
    }
    return template;
  }
}
