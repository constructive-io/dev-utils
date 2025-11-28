import { AppStashResult } from 'appstash';

export interface CacheManagerConfig {
  toolName: string;
  baseDir?: string;
  ttl?: number;
  /**
   * Optional pre-resolved appstash directories owned by the caller.
   * When provided, CacheManager will use these instead of creating its own.
   */
  dirs?: AppStashResult;
}

export interface CacheMetadata {
  key: string;
  identifier: string;
  variant?: string;
  lastUpdated: number;
  source?: string;
}

export interface CacheEntryInfo extends CacheMetadata {
  path: string;
  expired: boolean;
}
