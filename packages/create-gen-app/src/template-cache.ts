import { execSync } from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { appstash, resolve as resolveAppstash } from "appstash";

import { CacheOptions } from "./types";
import { normalizeGitUrl } from "./clone";

const DEFAULT_TOOL = "pgpm";

interface CacheMetadata {
  templateUrl: string;
  branch?: string;
  timestamp: number;
  gitUrl: string;
}

export interface TemplateCacheConfig {
  enabled: boolean;
  toolName: string;
  baseDir?: string;
  ttl?: number;
}

/**
 * Manages template repository caching with TTL support
 */
export class TemplateCache {
  private config: TemplateCacheConfig;
  private reposDir: string;
  private metadataDir: string;

  constructor(options?: CacheOptions | false) {
    this.config = this.normalizeConfig(options);

    if (this.config.enabled) {
      const dirs = appstash(this.config.toolName, {
        ensure: true,
        baseDir: this.config.baseDir,
      });

      this.reposDir = resolveAppstash(dirs, "cache", "repos");
      this.metadataDir = resolveAppstash(dirs, "cache", "metadata");

      if (!fs.existsSync(this.reposDir)) {
        fs.mkdirSync(this.reposDir, { recursive: true });
      }
      if (!fs.existsSync(this.metadataDir)) {
        fs.mkdirSync(this.metadataDir, { recursive: true });
      }
    } else {
      this.reposDir = "";
      this.metadataDir = "";
    }
  }

  private normalizeConfig(options?: CacheOptions | false): TemplateCacheConfig {
    if (options === false) {
      return {
        enabled: false,
        toolName: DEFAULT_TOOL,
      };
    }

    const { enabled, toolName, baseDir, ttl, maxAge } = options ?? {};

    return {
      enabled: enabled !== false,
      toolName: toolName ?? DEFAULT_TOOL,
      baseDir,
      ttl: ttl ?? maxAge,
    };
  }

  /**
   * Get cached template if it exists and is not expired
   */
  get(templateUrl: string, branch?: string): string | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.createCacheKey(templateUrl, branch);
    const cachePath = path.join(this.reposDir, key);
    const metadataPath = path.join(this.metadataDir, `${key}.json`);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    if (this.config.ttl && fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(
          fs.readFileSync(metadataPath, "utf-8")
        ) as CacheMetadata;

        if (this.isExpired(metadata)) {
          this.clear(templateUrl, branch);
          return null;
        }
      } catch (error) {
        // If metadata is corrupted, treat as expired
        this.clear(templateUrl, branch);
        return null;
      }
    }

    return cachePath;
  }

  /**
   * Cache a template repository
   */
  set(templateUrl: string, branch?: string): string {
    if (!this.config.enabled) {
      throw new Error("Cache is disabled");
    }

    const key = this.createCacheKey(templateUrl, branch);
    const cachePath = path.join(this.reposDir, key);
    const metadataPath = path.join(this.metadataDir, `${key}.json`);

    // Clone the repository
    this.cloneInto(templateUrl, cachePath, branch);

    // Write metadata
    const metadata: CacheMetadata = {
      templateUrl,
      branch,
      timestamp: Date.now(),
      gitUrl: normalizeGitUrl(templateUrl),
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    return cachePath;
  }

  /**
   * Clear a specific cached template
   */
  clear(templateUrl: string, branch?: string): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.createCacheKey(templateUrl, branch);
    const cachePath = path.join(this.reposDir, key);
    const metadataPath = path.join(this.metadataDir, `${key}.json`);

    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }

    if (fs.existsSync(metadataPath)) {
      fs.rmSync(metadataPath, { force: true });
    }
  }

  /**
   * Clear all cached templates
   */
  clearAll(): void {
    if (!this.config.enabled) {
      return;
    }

    if (fs.existsSync(this.reposDir)) {
      fs.rmSync(this.reposDir, { recursive: true, force: true });
      fs.mkdirSync(this.reposDir, { recursive: true });
    }

    if (fs.existsSync(this.metadataDir)) {
      fs.rmSync(this.metadataDir, { recursive: true, force: true });
      fs.mkdirSync(this.metadataDir, { recursive: true });
    }
  }

  /**
   * Check if cache metadata is expired
   */
  isExpired(metadata: CacheMetadata): boolean {
    if (!this.config.ttl) {
      return false;
    }

    const age = Date.now() - metadata.timestamp;
    return age > this.config.ttl;
  }

  /**
   * Get cache metadata for a template
   */
  getMetadata(templateUrl: string, branch?: string): CacheMetadata | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.createCacheKey(templateUrl, branch);
    const metadataPath = path.join(this.metadataDir, `${key}.json`);

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(metadataPath, "utf-8")) as CacheMetadata;
    } catch {
      return null;
    }
  }

  /**
   * List all cached templates with their metadata
   */
  listAll(): Array<CacheMetadata & { key: string; expired: boolean }> {
    if (!this.config.enabled) {
      return [];
    }

    if (!fs.existsSync(this.metadataDir)) {
      return [];
    }

    const results: Array<CacheMetadata & { key: string; expired: boolean }> = [];
    const files = fs.readdirSync(this.metadataDir);

    for (const file of files) {
      if (!file.endsWith(".json")) {
        continue;
      }

      const metadataPath = path.join(this.metadataDir, file);
      try {
        const metadata = JSON.parse(
          fs.readFileSync(metadataPath, "utf-8")
        ) as CacheMetadata;

        results.push({
          ...metadata,
          key: path.basename(file, ".json"),
          expired: this.isExpired(metadata),
        });
      } catch {
        // Skip corrupted metadata
      }
    }

    return results;
  }

  private createCacheKey(templateUrl: string, branch?: string): string {
    const gitUrl = normalizeGitUrl(templateUrl);
    return crypto
      .createHash("md5")
      .update(`${gitUrl}#${branch ?? "default"}`)
      .digest("hex");
  }

  private cloneInto(
    templateUrl: string,
    destination: string,
    branch?: string
  ): void {
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }

    const gitUrl = normalizeGitUrl(templateUrl);
    const branchArgs = branch ? ` --branch ${branch} --single-branch` : "";
    const depthArgs = " --depth 1";

    execSync(`git clone${branchArgs}${depthArgs} ${gitUrl} ${destination}`, {
      stdio: "inherit",
    });

    const gitDir = path.join(destination, ".git");
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): TemplateCacheConfig {
    return { ...this.config };
  }
}
