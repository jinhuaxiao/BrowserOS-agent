/**
 * Configuration Cache
 *
 * In-memory cache for fingerprint configurations to avoid redundant
 * file writes and computations during browser launches.
 */

import { createHash } from 'crypto';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  /** Cached data */
  data: T;

  /** Hash of the config that produced this data */
  configHash: string;

  /** When the entry was created */
  createdAt: number;

  /** Entry expiration time (ms since epoch) */
  expiresAt: number;
}

/**
 * Cache lookup result
 */
export interface CacheLookupResult<T> {
  /** Whether the cache had a valid hit */
  hit: boolean;

  /** Cached data (if hit) */
  data?: T;

  /** Why cache missed (for debugging) */
  missReason?: 'not_found' | 'expired' | 'config_changed';
}

/**
 * Configuration cache options
 */
export interface ConfigCacheOptions {
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTtlMs?: number;

  /** Maximum number of entries (default: 100) */
  maxEntries?: number;
}

/**
 * ConfigCache class for managing configuration caching
 */
export class ConfigCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTtlMs: number;
  private maxEntries: number;

  constructor(options?: ConfigCacheOptions) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 5 * 60 * 1000; // 5 minutes
    this.maxEntries = options?.maxEntries ?? 100;
  }

  /**
   * Generate a hash for a configuration object
   */
  private hashConfig(config: unknown): string {
    const json = JSON.stringify(config, Object.keys(config as object).sort());
    return createHash('sha256').update(json).digest('hex').slice(0, 16);
  }

  /**
   * Get cached data if available and valid
   *
   * @param key - Cache key
   * @param currentConfig - Current configuration (for change detection)
   * @returns Cache lookup result
   */
  get<T>(key: string, currentConfig: unknown): CacheLookupResult<T> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return { hit: false, missReason: 'not_found' };
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return { hit: false, missReason: 'expired' };
    }

    // Check if config has changed
    const currentHash = this.hashConfig(currentConfig);
    if (entry.configHash !== currentHash) {
      this.cache.delete(key);
      return { hit: false, missReason: 'config_changed' };
    }

    return { hit: true, data: entry.data };
  }

  /**
   * Store data in cache
   *
   * @param key - Cache key
   * @param config - Configuration that produced this data (for change detection)
   * @param data - Data to cache
   * @param ttlMs - Time-to-live in milliseconds (optional, uses default)
   */
  set<T>(key: string, config: unknown, data: T, ttlMs?: number): void {
    // Enforce max entries limit
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const ttl = ttlMs ?? this.defaultTtlMs;
    const entry: CacheEntry<T> = {
      data,
      configHash: this.hashConfig(config),
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Clear cache entry or all entries
   *
   * @param key - Optional key to clear (clears all if not provided)
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string, currentConfig?: unknown): boolean {
    if (currentConfig) {
      return this.get(key, currentConfig).hit;
    }
    return this.cache.has(key);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxEntries: number;
    defaultTtlMs: number;
  } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      defaultTtlMs: this.defaultTtlMs,
    };
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Global config cache instance
 */
let globalCache: ConfigCache | null = null;

/**
 * Get or create the global config cache
 */
export function getConfigCache(options?: ConfigCacheOptions): ConfigCache {
  if (!globalCache) {
    globalCache = new ConfigCache(options);
  }
  return globalCache;
}

/**
 * Reset the global config cache
 */
export function resetConfigCache(): void {
  globalCache = null;
}

/**
 * Extension version cache for tracking extracted versions
 */
interface ExtensionVersionInfo {
  /** Extension ID */
  extensionId: string;

  /** Installed version */
  version: string;

  /** Path to extracted extension */
  path: string;

  /** When it was extracted */
  extractedAt: number;
}

/**
 * Extension version cache
 */
class ExtensionVersionCache {
  private versions: Map<string, ExtensionVersionInfo> = new Map();

  /**
   * Check if extension version matches
   */
  isCurrentVersion(extensionId: string, version: string, outputDir: string): boolean {
    const key = `${extensionId}@${outputDir}`;
    const info = this.versions.get(key);

    if (!info) {
      return false;
    }

    return info.version === version;
  }

  /**
   * Record extracted extension version
   */
  recordVersion(extensionId: string, version: string, outputDir: string): void {
    const key = `${extensionId}@${outputDir}`;
    this.versions.set(key, {
      extensionId,
      version,
      path: outputDir,
      extractedAt: Date.now(),
    });
  }

  /**
   * Clear cached version info
   */
  clear(extensionId?: string): void {
    if (extensionId) {
      for (const [key] of this.versions) {
        if (key.startsWith(`${extensionId}@`)) {
          this.versions.delete(key);
        }
      }
    } else {
      this.versions.clear();
    }
  }

  /**
   * Get all cached versions
   */
  getAll(): ExtensionVersionInfo[] {
    return Array.from(this.versions.values());
  }
}

/**
 * Global extension version cache
 */
let extensionCache: ExtensionVersionCache | null = null;

/**
 * Get extension version cache
 */
export function getExtensionVersionCache(): ExtensionVersionCache {
  if (!extensionCache) {
    extensionCache = new ExtensionVersionCache();
  }
  return extensionCache;
}

/**
 * Reset extension version cache
 */
export function resetExtensionVersionCache(): void {
  extensionCache = null;
}
