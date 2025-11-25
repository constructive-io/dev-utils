import { replaceVariables, extractVariables, TemplateCache } from 'create-gen-app';

export interface CachedTemplateOptions {
  templateUrl: string;
  outputDir: string;
  answers: Record<string, any>;
  cacheTool?: string;
  branch?: string;
  ttl?: number;
  maxAge?: number;
}

export interface CachedTemplateResult {
  outputDir: string;
  cacheUsed: boolean;
  cachePath?: string;
}

/**
 * Create project from cached template using the shared TemplateCache
 * @param options - Options for creating from cached template
 * @returns Result with output directory and cache information
 */
export async function createFromCachedTemplate(options: CachedTemplateOptions): Promise<CachedTemplateResult> {
  const { templateUrl, outputDir, answers, cacheTool = 'mymodule', branch, ttl, maxAge } = options;

  const templateCache = new TemplateCache({
    enabled: true,
    toolName: cacheTool,
    ttl,
    maxAge,
  });

  let templateDir: string;
  let cacheUsed = false;
  let cachePath: string | undefined;

  const cachedRepo = templateCache.get(templateUrl, branch);

  if (cachedRepo) {
    console.log(`Using cached template from ${cachedRepo}`);
    templateDir = cachedRepo;
    cacheUsed = true;
    cachePath = cachedRepo;
  } else {
    console.log(`Cloning template to cache from ${templateUrl}`);
    templateDir = templateCache.set(templateUrl, branch);
    cachePath = templateDir;
  }

  const extractedVariables = await extractVariables(templateDir);

  await replaceVariables(templateDir, outputDir, extractedVariables, answers);

  return {
    outputDir,
    cacheUsed,
    cachePath
  };
}

// Re-export TemplateCache for convenience
export { TemplateCache } from 'create-gen-app';
