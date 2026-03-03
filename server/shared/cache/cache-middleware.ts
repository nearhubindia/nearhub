import type { Request, Response, NextFunction } from 'express';
import { redisCache } from './redis-cache';

export interface CachedRequest extends Request {
  cacheKey?: string;
  cacheEnabled?: boolean;
}

/**
 * Cache middleware for GET requests
 * Automatically caches response based on URL and query params
 */
export function cacheMiddleware(ttl: number = 300) {
  return async (req: CachedRequest, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET' || !redisCache.isOnline()) {
      return next();
    }

    // Skip caching if explicitly disabled
    if (req.query.nocache === 'true') {
      return next();
    }

    // Generate cache key from method + path + query
    const cacheKey = `http:${req.method}:${req.path}:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Intercept response.json to cache the response
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisCache.set(cacheKey, data, { ttl });
        res.set('X-Cache', 'MISS');
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Cache busting middleware for mutation endpoints
 * Clears related caches on POST/PUT/DELETE
 */
export function cacheBustMiddleware(pattern: string | ((req: CachedRequest) => string)) {
  return async (req: CachedRequest, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      // Store the pattern for later invalidation
      req.cacheKey = typeof pattern === 'function' ? pattern(req) : pattern;
    }

    next();
  };
}

/**
 * Invalidate cache after successful mutation
 */
export async function invalidateCacheAfterMutation(req: CachedRequest, pattern?: string) {
  const invalidationPattern = pattern || req.cacheKey;

  if (invalidationPattern && redisCache.isOnline()) {
    const count = await redisCache.invalidatePattern(invalidationPattern);
    console.log(
      `[CacheMiddleware] Invalidated ${count} cache entries matching: ${invalidationPattern}`
    );
  }
}

/**
 * Get or Set pattern - for caching query results
 */
export async function getCachedOrFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T & { cached?: boolean }> {
  if (!redisCache.isOnline()) {
    return (await fetcher()) as T & { cached?: boolean };
  }

  const fullKey = `query:${cacheKey}`;

  // Try cache first
  const cached = await redisCache.get<T>(fullKey);
  if (cached !== null) {
    return { ...cached, cached: true };
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  await redisCache.set(fullKey, data, { ttl });

  return { ...data, cached: false };
}

/**
 * Decorator for caching function results
 */
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    ttl?: number;
    keyGenerator?: (...args: any[]) => string;
  } = {}
): T {
  const memoCache = new Map<string, any>();

  return (async (...args: any[]) => {
    const keyGenerator = options.keyGenerator || ((...args: any[]) => JSON.stringify(args));

    const cacheKey = keyGenerator(...args);

    // Check memory cache first (for same instance)
    if (memoCache.has(cacheKey)) {
      return memoCache.get(cacheKey);
    }

    // Check Redis cache
    if (redisCache.isOnline()) {
      const cached = await redisCache.get(cacheKey);
      if (cached !== null) {
        memoCache.set(cacheKey, cached);
        return cached;
      }
    }

    // Execute function
    const result = await fn(...args);

    // Store in both caches
    memoCache.set(cacheKey, result);
    if (redisCache.isOnline()) {
      await redisCache.set(cacheKey, result, { ttl: options.ttl });
    }

    return result;
  }) as T;
}

/**
 * Cache statistics endpoint for admin
 */
export function cacheStatsEndpoint(app: any) {
  app.get('/api/admin/cache-stats', (req: CachedRequest, res: Response) => {
    const rediStats = redisCache.getStats();

    res.json({
      redis: rediStats,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/admin/cache-clear', async (req: CachedRequest, res: Response) => {
    try {
      await redisCache.clear();

      res.json({
        success: true,
        message: 'Cache cleared',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
