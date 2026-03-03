import { redisCache } from './redis-cache';

export type CacheStrategy = 'memory' | 'redis' | 'both';

export interface QueryCacheConfig {
  strategy: CacheStrategy;
  ttl?: number;
  invalidateOn?: 'mutation' | 'time' | 'manual';
}

export interface DBCacheStats {
  queryHits: number;
  queryMisses: number;
  mutations: number;
  invalidations: number;
}

/**
 * Database Caching Layer
 * Sits between app and database to reduce query load
 */
export class DBCache {
  private stats: DBCacheStats = {
    queryHits: 0,
    queryMisses: 0,
    mutations: 0,
    invalidations: 0,
  };

  private config: QueryCacheConfig = {
    strategy: 'both',
    ttl: 300, // 5 minutes default for queries
    invalidateOn: 'manual',
  };

  /**
   * Configure caching behavior
   */
  configure(config: Partial<QueryCacheConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[DBCache] Configured:', this.config);
  }

  /**
   * Cache a database query result
   */
  async cachedQuery<T>(key: string, query: () => Promise<T>, ttl?: number): Promise<T> {
    const cacheKey = `query:${key}`;

    // Try Redis first if available
    if (redisCache.isOnline()) {
      const cached = await redisCache.get<T>(cacheKey);
      if (cached !== null) {
        this.stats.queryHits++;
        return cached;
      }
    }

    // Cache miss - execute query
    this.stats.queryMisses++;
    const result = await query();

    // Store result in cache
    await redisCache.set(cacheKey, result, { ttl: ttl || this.config.ttl });

    return result;
  }

  /**
   * Cache multiple queries (batch)
   */
  async cachedBatchQuery<T>(
    queries: Array<{
      key: string;
      query: () => Promise<T>;
      ttl?: number;
    }>
  ): Promise<T[]> {
    return Promise.all(queries.map((q) => this.cachedQuery(q.key, q.query, q.ttl)));
  }

  /**
   * Handle database mutation (invalidate related caches)
   */
  async handleMutation(
    mutationType: 'create' | 'update' | 'delete',
    entityType: string,
    entityId?: string,
    relatedKeys?: string[]
  ): Promise<void> {
    this.stats.mutations++;

    // Invalidate entity cache
    const entityCacheKey = entityId ? `query:${entityType}:${entityId}` : `query:${entityType}:*`;

    const invalidated = await redisCache.invalidatePattern(entityCacheKey);
    this.stats.invalidations += invalidated;

    // Invalidate related caches
    if (relatedKeys && relatedKeys.length > 0) {
      const related = await redisCache.invalidateMany(relatedKeys.map((k) => `query:${k}`));
      this.stats.invalidations += related;
    }

    console.log(
      `[DBCache] Invalidated ${invalidated + (relatedKeys?.length || 0)} caches for ${mutationType} on ${entityType}`
    );
  }

  /**
   * Cache listing query with invalidation support
   */
  async cachedListings(filters: Record<string, any>, query: () => Promise<any[]>): Promise<any[]> {
    const filterKey = Object.entries(filters)
      .map(([k, v]) => `${k}:${v}`)
      .join('|');

    return this.cachedQuery(`listings:${filterKey}`, query, 300); // 5 min TTL
  }

  /**
   * Cache user queries
   */
  async cachedUser(userId: string, query: () => Promise<any>): Promise<any> {
    return this.cachedQuery(`user:${userId}`, query, 600); // 10 min TTL
  }

  /**
   * Cache user listings
   */
  async cachedUserListings(userId: string, query: () => Promise<any[]>): Promise<any[]> {
    return this.cachedQuery(`user-listings:${userId}`, query, 300);
  }

  /**
   * Cache chat messages
   */
  async cachedChatMessages(chatId: string, query: () => Promise<any[]>): Promise<any[]> {
    return this.cachedQuery(`chat:${chatId}`, query, 180); // 3 min TTL
  }

  /**
   * Invalidate user cache (called on user update)
   */
  async invalidateUser(userId: string): Promise<void> {
    const cacheKey = `query:user:${userId}`;
    const deleted = await redisCache.delete(cacheKey);
    if (deleted) {
      this.stats.invalidations++;
      console.log(`[DBCache] Invalidated user:${userId}`);
    }
  }

  /**
   * Invalidate listing cache (called on listing update)
   */
  async invalidateListing(listingId: string): Promise<void> {
    // Invalidate listing-specific cache
    const deleted1 = await redisCache.delete(`query:listing:${listingId}`);

    // Invalidate all listings cache (listing list needs refresh)
    const deleted2 = await redisCache.invalidatePattern('query:listings:*');

    if (deleted1 || deleted2) {
      this.stats.invalidations += deleted1 ? 1 : 0;
      this.stats.invalidations += deleted2;
      console.log(`[DBCache] Invalidated listing:${listingId}`);
    }
  }

  /**
   * Invalidate listings for a seller
   */
  async invalidateUserListings(userId: string): Promise<void> {
    const deleted = await redisCache.invalidatePattern(`query:user-listings:${userId}`);
    if (deleted > 0) {
      this.stats.invalidations += deleted;
      console.log(`[DBCache] Invalidated user-listings:${userId} (${deleted} caches)`);
    }
  }

  /**
   * Invalidate chat cache
   */
  async invalidateChat(chatId: string): Promise<void> {
    const deleted = await redisCache.delete(`query:chat:${chatId}`);
    if (deleted) {
      this.stats.invalidations++;
      console.log(`[DBCache] Invalidated chat:${chatId}`);
    }
  }

  /**
   * Invalidate all listings (called on bulk operations)
   */
  async invalidateAllListings(): Promise<void> {
    const deleted = await redisCache.invalidatePattern('query:listings:*');
    if (deleted > 0) {
      this.stats.invalidations += deleted;
      console.log(`[DBCache] Invalidated all listings cache (${deleted} entries)`);
    }
  }

  /**
   * Invalidate all caches
   */
  async invalidateAll(): Promise<void> {
    await redisCache.clear();
    this.stats.invalidations++;
    console.log('[DBCache] Cleared all caches');
  }

  /**
   * Get cache statistics
   */
  getStats(): DBCacheStats & {
    hitRate: number;
    redisStats: any;
  } {
    const total = this.stats.queryHits + this.stats.queryMisses;
    const hitRate = total > 0 ? (this.stats.queryHits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      redisStats: redisCache.getStats(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      queryHits: 0,
      queryMisses: 0,
      mutations: 0,
      invalidations: 0,
    };
  }
}

/**
 * Export singleton instance
 */
export const dbCache = new DBCache();
