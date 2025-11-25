import * as fs from "fs";

import { CacheOptions } from "./types";
import { cloneRepo } from "./clone";
import { TemplateCache } from "./template-cache";

export interface TemplateSource {
  templateDir: string;
  cacheUsed: boolean;
  cleanup: () => void;
}

interface PrepareTemplateArgs {
  templateUrl: string;
  branch?: string;
  cache: CacheOptions | false;
}

export async function prepareTemplateDirectory(args: PrepareTemplateArgs): Promise<TemplateSource> {
  const { templateUrl, branch, cache } = args;

  const templateCache = new TemplateCache(cache);

  if (!templateCache.isEnabled()) {
    const tempDir = await cloneRepo(templateUrl, { branch });
    return {
      templateDir: tempDir,
      cacheUsed: false,
      cleanup: () => cleanupDir(tempDir),
    };
  }

  // Try to get from cache
  const cachedPath = templateCache.get(templateUrl, branch);
  if (cachedPath) {
    return {
      templateDir: cachedPath,
      cacheUsed: true,
      cleanup: () => {},
    };
  }

  // Cache miss or expired - clone and cache
  const cachePath = templateCache.set(templateUrl, branch);

  return {
    templateDir: cachePath,
    cacheUsed: false,
    cleanup: () => {},
  };
}

function cleanupDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Re-export TemplateCache for external use
export { TemplateCache } from "./template-cache";


