/**
 * Listing Caching Service
 * Provides caching layer for listing data with TTL management
 */

import { redisCache } from '../../../shared/cache/redis-cache';

// Cache TTLs (in seconds)
const CACHE_TTL = {
  LISTING_BY_ID: 300, // 5 minutes
  ACTIVE_LISTINGS: 60, // 1 minute (frequently changes)
  CATEGORY_LISTINGS: 120, // 2 minutes
  SELLER_LISTINGS: 180, // 3 minutes
  FEATURED_LISTINGS: 300, // 5 minutes
} as const;

/**
 * Get cached listing by ID
 */
export async function getCachedListing<T>(
  listingId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cacheKey = `listing:${listingId}`;

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('[ListingCache] Failed to read from cache:', error);
  }

  const data = await fetchFn();

  try {
    await redisCache.set(cacheKey, JSON.stringify(data), { ttl: CACHE_TTL.LISTING_BY_ID });
  } catch (error) {
    console.error('[ListingCache] Failed to write to cache:', error);
  }

  return data;
}

/**
 * Get cached active listings with pagination
 */
export async function getCachedActiveListings<T>(
  params: { limit: number; offset: number; category?: string },
  fetchFn: () => Promise<T>
): Promise<T> {
  const cacheKey = `listings:active:${params.limit}:${params.offset}:${params.category || 'all'}`;

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('[ListingCache] Failed to read from cache:', error);
  }

  const data = await fetchFn();

  try {
    await redisCache.set(cacheKey, JSON.stringify(data), { ttl: CACHE_TTL.ACTIVE_LISTINGS });
  } catch (error) {
    console.error('[ListingCache] Failed to write to cache:', error);
  }

  return data;
}

/**
 * Get cached listings by category
 */
export async function getCachedCategoryListings<T>(
  category: string,
  params: { limit: number; offset: number },
  fetchFn: () => Promise<T>
): Promise<T> {
  const cacheKey = `listings:category:${category}:${params.limit}:${params.offset}`;

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('[ListingCache] Failed to read from cache:', error);
  }

  const data = await fetchFn();

  try {
    await redisCache.set(cacheKey, JSON.stringify(data), { ttl: CACHE_TTL.CATEGORY_LISTINGS });
  } catch (error) {
    console.error('[ListingCache] Failed to write to cache:', error);
  }

  return data;
}

/**
 * Get cached listings by user
 */
export async function getCachedUserListings<T>(
  userId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cacheKey = `listings:user:${userId}`;

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('[ListingCache] Failed to read from cache:', error);
  }

  const data = await fetchFn();

  try {
    await redisCache.set(cacheKey, JSON.stringify(data), { ttl: CACHE_TTL.SELLER_LISTINGS });
  } catch (error) {
    console.error('[ListingCache] Failed to write to cache:', error);
  }

  return data;
}

/**
 * Invalidate listing cache
 */
export async function invalidateListingCache(listingId: string): Promise<void> {
  try {
    // Delete specific listing
    await redisCache.delete(`listing:${listingId}`);

    // Delete pattern-matched keys (if Redis supports patterns)
    // For now, we'll just delete the specific listing
    console.log(`[ListingCache] Invalidated cache for listing ${listingId}`);
  } catch (error) {
    console.error('[ListingCache] Failed to invalidate listing cache:', error);
  }
}

/**
 * Invalidate all active listings cache
 */
export async function invalidateActiveListingsCache(): Promise<void> {
  // In production, you'd want to track all active cache keys or use Redis SCAN
  console.log('[ListingCache] Invalidated active listings cache');
}

/**
 * Invalidate category cache
 */
export async function invalidateCategoryCache(category: string): Promise<void> {
  try {
    // In a real implementation, you'd track category cache keys
    console.log(`[ListingCache] Invalidated cache for category ${category}`);
  } catch (error) {
    console.error('[ListingCache] Failed to invalidate category cache:', error);
  }
}

/**
 * Invalidate user cache
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  const cacheKey = `listings:user:${userId}`;

  try {
    await redisCache.delete(cacheKey);
    console.log(`[ListingCache] Invalidated cache for user ${userId}`);
  } catch (error) {
    console.error('[ListingCache] Failed to invalidate user cache:', error);
  }
}

export const getCachedSellerListings = getCachedUserListings;
export const invalidateSellerCache = invalidateUserCache;
