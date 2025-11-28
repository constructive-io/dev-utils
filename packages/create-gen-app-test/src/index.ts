import * as path from 'path';
import { CacheManager } from 'create-gen-app';
import { GitCloner } from 'create-gen-app';
import { Templatizer } from 'create-gen-app';

// Configuration constants (top-most layer owns defaults)
const DEFAULT_TOOL_NAME = 'pgpm';

export interface CreateFromTemplateOptions {
  templateUrl: string;
  outputDir: string;
  answers?: Record<string, any>;
  toolName?: string;
  branch?: string;
  ttl?: number;
  baseDir?: string;
  fromPath?: string;
  noTty?: boolean;
}

export interface CreateFromTemplateResult {
  outputDir: string;
  cacheUsed: boolean;
  cacheExpired: boolean;
  cachePath?: string;
}

/**
 * Create a project from a template with caching support
 * Orchestrates CacheManager + GitCloner + Templatizer
 */
export async function createFromTemplate(
  options: CreateFromTemplateOptions
): Promise<CreateFromTemplateResult> {
  const {
    templateUrl,
    outputDir,
    answers = {},
    toolName = DEFAULT_TOOL_NAME,
    branch,
    ttl,
    baseDir,
    fromPath,
    noTty = false,
  } = options;

  // 1. Initialize modules
  const cacheManager = new CacheManager({ toolName, ttl, baseDir });
  const gitCloner = new GitCloner();
  const templatizer = new Templatizer();

  // 2. Create cache key
  const normalizedUrl = gitCloner.normalizeUrl(templateUrl);
  const cacheKey = cacheManager.createKey(normalizedUrl, branch);

  // 3. Check cache + expiration
  let templateDir: string;
  let cacheUsed = false;
  let cacheExpired = false;

  const cachedPath = cacheManager.get(cacheKey);
  const expiredMetadata = cacheManager.checkExpiration(cacheKey);

  if (expiredMetadata) {
    // Cache exists but expired - warn user then auto-update
    console.warn(
      `⚠️  Cached template expired (last updated: ${new Date(expiredMetadata.lastUpdated).toLocaleString()})`
    );
    console.log('Updating cache...');
    cacheManager.clear(cacheKey);
    cacheExpired = true;
  }

  if (cachedPath && !expiredMetadata) {
    console.log(`Using cached template: ${cachedPath}`);
    templateDir = cachedPath;
    cacheUsed = true;
  } else {
    // 4. Clone to cache
    console.log(`Cloning ${normalizedUrl}...`);
    const tempDest = path.join(cacheManager.getReposDir(), cacheKey);

    gitCloner.clone(normalizedUrl, tempDest, { branch, depth: 1 });
    cacheManager.set(cacheKey, tempDest);

    templateDir = tempDest;
    console.log('Template cached for future runs');
  }

  // 5. Process template
  console.log('Processing template...');
  await templatizer.process(templateDir, outputDir, { argv: answers, noTty, fromPath });

  console.log(`✨ Project created at ${outputDir}`);

  return {
    outputDir,
    cacheUsed,
    cacheExpired,
    cachePath: templateDir,
  };
}

// Re-export components for external use
export { CacheManager, GitCloner, Templatizer } from 'create-gen-app';
