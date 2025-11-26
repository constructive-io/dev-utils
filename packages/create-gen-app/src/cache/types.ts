export interface CacheManagerConfig {
  toolName: string;
  baseDir?: string;
  ttl?: number;
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
