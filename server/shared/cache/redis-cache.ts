// @ts-ignore - redis module optional dependency
import { createClient } from 'redis';
// @ts-ignore - redis module optional dependency
import type { RedisClientType } from 'redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 3600 = 1 hour)
  namespace?: string; // Key prefix for organization
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * Redis Cache Service
 * Provides high-performance caching with automatic TTL, namespacing, and statistics
 */
export class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private hasLoggedConnectionError = false;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  private defaultTTL = 3600; // 1 hour default
  private namespace = 'adli:';

  /**
   * Initialize Redis connection
   */
  async connect(
    host: string = process.env.REDIS_HOST || 'localhost',
    port: number = parseInt(process.env.REDIS_PORT || '6379'),
    password?: string
  ): Promise<void> {
    const redisEnabled = String(process.env.REDIS_ENABLED || '')
      .trim()
      .toLowerCase();
    const hasExplicitRedisConfig = Boolean(
      process.env.REDIS_URL ||
        process.env.REDIS_HOST ||
        process.env.REDIS_PORT ||
        process.env.REDIS_PASSWORD
    );
    const isProduction = process.env.NODE_ENV === 'production';

    if (redisEnabled === 'false' || redisEnabled === '0') {
      console.log('[Redis] Disabled by REDIS_ENABLED');
      return;
    }

    if (!isProduction && redisEnabled !== 'true' && redisEnabled !== '1' && !hasExplicitRedisConfig) {
      console.log('[Redis] Skipped in development (set REDIS_ENABLED=true to enable)');
      return;
    }

    try {
      this.client = createClient({
        ...(process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {}),
        ...(password || process.env.REDIS_PASSWORD ? { password: password || process.env.REDIS_PASSWORD } : {}),
        socket: {
          host,
          port,
          reconnectStrategy: (retries: number) => {
            if (!isProduction || retries > 2) {
              return false;
            }
            return Math.min(retries * 100, 500);
          },
        },
      } as any);

      this.client.on('error', (err: unknown) => {
        if (!this.hasLoggedConnectionError) {
          const error = err as { code?: string; message?: string };
          console.warn(
            `[Redis] Unavailable${error?.code ? ` (${error.code})` : ''}; continuing without cache.`
          );
          this.hasLoggedConnectionError = true;
        }
        this.stats.errors++;
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('[Redis] Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      if (!this.hasLoggedConnectionError) {
        const connectionError = error as { code?: string; message?: string };
        console.warn(
          `[Redis] Connection unavailable${connectionError?.code ? ` (${connectionError.code})` : ''}; continuing without cache.`
        );
        this.hasLoggedConnectionError = true;
      }
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('[Redis] Disconnected');
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const data = await this.client.get(this.prefixKey(key));

      if (data === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`[Redis] Get error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const ttl = options.ttl ?? this.defaultTTL;
      const data = JSON.stringify(value);

      await this.client.setEx(this.prefixKey(key), ttl, data);
      this.stats.sets++;
      return true;
    } catch (error) {
      console.error(`[Redis] Set error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.del(this.prefixKey(key));
      if (result > 0) {
        this.stats.deletes++;
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[Redis] Delete error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(this.prefixKey(key));
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Exists error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get with automatic refresh using getter function
   */
  async getOrSet<T = any>(
    key: string,
    getter: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch fresh data
    const fresh = await getter();

    // Store in cache
    await this.set(key, fresh, options);

    return fresh;
  }

  /**
   * Invalidate cache by pattern (Redis SCAN compatible)
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const fullPattern = this.prefixKey(pattern);
      let cursor = 0;
      let deletedCount = 0;

      do {
        const { cursor: nextCursor, keys } = await this.client.scan(cursor, {
          MATCH: fullPattern,
        });

        if (keys.length > 0) {
          deletedCount += await this.client.del(keys);
        }

        cursor = nextCursor;
      } while (cursor !== 0);

      if (deletedCount > 0) {
        this.stats.deletes += deletedCount;
      }

      return deletedCount;
    } catch (error) {
      console.error(`[Redis] Invalidate pattern error for ${pattern}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Invalidate multiple specific keys
   */
  async invalidateMany(keys: string[]): Promise<number> {
    if (!this.isConnected || !this.client || keys.length === 0) {
      return 0;
    }

    try {
      const prefixedKeys = keys.map((k) => this.prefixKey(k));
      const result = await this.client.del(prefixedKeys);
      this.stats.deletes += result;
      return result;
    } catch (error) {
      console.error('[Redis] Delete many error:', error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const pattern = this.prefixKey('*');
      const count = await this.invalidatePattern(pattern);
      console.log(`[Redis] Cleared ${count} keys`);
    } catch (error) {
      console.error('[Redis] Clear error:', error);
      this.stats.errors++;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number; isConnected: boolean } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      isConnected: this.isConnected,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Set default TTL
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * Set namespace prefix
   */
  setNamespace(namespace: string): void {
    this.namespace = `${namespace}:`;
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * Check if connected
   */
  isOnline(): boolean {
    return this.isConnected;
  }

  /**
   * Helper: Add namespace prefix to key
   */
  private prefixKey(key: string): string {
    return `${this.namespace}${key}`;
  }
}

/**
 * Create and export singleton instance
 */
export const redisCache = new RedisCache();
