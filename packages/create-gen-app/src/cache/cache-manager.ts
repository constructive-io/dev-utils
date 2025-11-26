import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { appstash, resolve as resolveAppstash, AppStashResult } from 'appstash';
import { CacheManagerConfig, CacheMetadata, CacheEntryInfo } from './types';

export class CacheManager {
  private config: CacheManagerConfig;
  private dirs: AppStashResult;
  private reposDir: string;
  private metadataDir: string;

  constructor(config: CacheManagerConfig) {
    // Validate required toolName
    if (!config.toolName) {
      throw new Error('CacheManager requires toolName parameter');
    }

    this.config = {
      toolName: config.toolName,
      baseDir: config.baseDir,
      ttl: config.ttl,
    };

    this.dirs = appstash(this.config.toolName, {
      ensure: true,
      baseDir: this.config.baseDir,
    });

    this.reposDir = resolveAppstash(this.dirs, 'cache', 'repos');
    this.metadataDir = resolveAppstash(this.dirs, 'cache', 'metadata');

    this.ensureDirectories();
  }

  /**
   * Get cached directory path if exists and not expired
   * Returns null if not cached or expired
   */
  get(key: string): string | null {
    const cachePath = this.getCachePath(key);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    // Check expiration - if expired, return null
    const expired = this.checkExpiration(key);
    if (expired) {
      return null;
    }

    return cachePath;
  }

  /**
   * Store directory in cache with metadata
   * Does NOT perform cloning - just registers the directory
   */
  set(key: string, sourcePath: string): string {
    const cachePath = this.getCachePath(key);

    // Write metadata with current timestamp
    const metadata: CacheMetadata = {
      key,
      identifier: sourcePath,
      lastUpdated: Date.now(),
    };

    fs.writeFileSync(
      this.getMetadataPath(key),
      JSON.stringify(metadata, null, 2)
    );

    return cachePath;
  }

  /**
   * Check if cache entry is expired based on TTL
   * Returns null if no metadata or not expired, returns metadata if expired
   */
  checkExpiration(key: string): CacheMetadata | null {
    const metadata = this.getMetadata(key);

    if (!metadata) {
      return null;
    }

    if (this.isExpired(metadata)) {
      return metadata;
    }

    return null;
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    const cachePath = this.getCachePath(key);
    const metadataPath = this.getMetadataPath(key);

    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }

    if (fs.existsSync(metadataPath)) {
      fs.rmSync(metadataPath, { force: true });
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
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
   * List all cache entries with expiration status
   */
  listAll(): CacheEntryInfo[] {
    if (!fs.existsSync(this.metadataDir)) {
      return [];
    }

    const results: CacheEntryInfo[] = [];
    const files = fs.readdirSync(this.metadataDir);

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const metadataPath = path.join(this.metadataDir, file);
      try {
        const metadata = JSON.parse(
          fs.readFileSync(metadataPath, 'utf-8')
        ) as CacheMetadata;

        results.push({
          ...metadata,
          path: this.getCachePath(metadata.key),
          expired: this.isExpired(metadata),
        });
      } catch {
        // Skip corrupted metadata
      }
    }

    return results;
  }

  /**
   * Get metadata for a cache entry
   */
  getMetadata(key: string): CacheMetadata | null {
    const metadataPath = this.getMetadataPath(key);

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      return JSON.parse(
        fs.readFileSync(metadataPath, 'utf-8')
      ) as CacheMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Create a cache key from identifier (e.g., git URL + branch)
   */
  createKey(identifier: string, variant?: string): string {
    const input = variant ? `${identifier}#${variant}` : identifier;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.reposDir)) {
      fs.mkdirSync(this.reposDir, { recursive: true });
    }
    if (!fs.existsSync(this.metadataDir)) {
      fs.mkdirSync(this.metadataDir, { recursive: true });
    }
  }

  private isExpired(metadata: CacheMetadata): boolean {
    if (!this.config.ttl) {
      return false;
    }

    const age = Date.now() - metadata.lastUpdated;
    return age > this.config.ttl;
  }

  private getCachePath(key: string): string {
    return path.join(this.reposDir, key);
  }

  private getMetadataPath(key: string): string {
    return path.join(this.metadataDir, `${key}.json`);
  }
}
