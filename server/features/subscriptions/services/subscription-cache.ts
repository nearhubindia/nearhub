/**
 * Subscription Caching Service
 * Provides caching layer for subscription data with TTL management
 */

import { redisCache } from '../../../shared/cache/redis-cache';
import type { SubscriptionTier, UserSubscription } from '../../admin/models/admin-settings';

// Cache TTLs (in seconds)
const CACHE_TTL = {
  SUBSCRIPTION_TIERS: 3600, // 1 hour
  USER_SUBSCRIPTIONS: 300, // 5 minutes
  ACTIVE_TIERS: 3600, // 1 hour
  TIER_BY_ID: 1800, // 30 minutes
} as const;

/**
 * Get cached subscription tiers or fetch from database
 */
export async function getCachedSubscriptionTiers<T>(fetchFn: () => Promise<T>): Promise<T> {
  const cacheKey = 'subscription:tiers:all';

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('[SubscriptionCache] Failed to read from cache:', error);
  }

  const data = await fetchFn();

  try {
    await redisCache.set(cacheKey, JSON.stringify(data), { ttl: CACHE_TTL.SUBSCRIPTION_TIERS });
  } catch (error) {
    console.error('[SubscriptionCache] Failed to write to cache:', error);
  }

  return data;
}

/**
 * Get cached active subscription tiers
 */
export async function getCachedActiveTiers<T>(fetchFn: () => Promise<T>): Promise<T> {
  const cacheKey = 'subscription:tiers:active';

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('[SubscriptionCache] Failed to read from cache:', error);
  }

  const data = await fetchFn();

  try {
    await redisCache.set(cacheKey, JSON.stringify(data), { ttl: CACHE_TTL.ACTIVE_TIERS });
  } catch (error) {
    console.error('[SubscriptionCache] Failed to write to cache:', error);
  }

  return data;
}

/**
 * Get cached tier by ID
 */
export async function getCachedTierById<T>(tierId: string, fetchFn: () => Promise<T>): Promise<T> {
  const cacheKey = `subscription:tier:${tierId}`;

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('[SubscriptionCache] Failed to read from cache:', error);
  }

  const data = await fetchFn();

  try {
    await redisCache.set(cacheKey, JSON.stringify(data), { ttl: CACHE_TTL.TIER_BY_ID });
  } catch (error) {
    console.error('[SubscriptionCache] Failed to write to cache:', error);
  }

  return data;
}

/**
 * Get cached user subscriptions
 */
export async function getCachedUserSubscriptions<T>(
  userId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cacheKey = `user:${userId}:subscriptions`;

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('[SubscriptionCache] Failed to read from cache:', error);
  }

  const data = await fetchFn();

  try {
    await redisCache.set(cacheKey, JSON.stringify(data), { ttl: CACHE_TTL.USER_SUBSCRIPTIONS });
  } catch (error) {
    console.error('[SubscriptionCache] Failed to write to cache:', error);
  }

  return data;
}

/**
 * Invalidate all subscription tier caches
 */
export async function invalidateSubscriptionTierCache(): Promise<void> {
  const keys = ['subscription:tiers:all', 'subscription:tiers:active'];

  try {
    await Promise.all(keys.map((key) => redisCache.delete(key)));
    console.log('[SubscriptionCache] Invalidated tier cache');
  } catch (error) {
    console.error('[SubscriptionCache] Failed to invalidate tier cache:', error);
  }
}

/**
 * Invalidate specific tier cache
 */
export async function invalidateTierCache(tierId: string): Promise<void> {
  const keys = [
    `subscription:tier:${tierId}`,
    'subscription:tiers:all',
    'subscription:tiers:active',
  ];

  try {
    await Promise.all(keys.map((key) => redisCache.delete(key)));
    console.log(`[SubscriptionCache] Invalidated cache for tier ${tierId}`);
  } catch (error) {
    console.error('[SubscriptionCache] Failed to invalidate tier cache:', error);
  }
}

/**
 * Invalidate user subscription cache
 */
export async function invalidateUserSubscriptionCache(userId: string): Promise<void> {
  const cacheKey = `user:${userId}:subscriptions`;

  try {
    await redisCache.delete(cacheKey);
    console.log(`[SubscriptionCache] Invalidated cache for user ${userId}`);
  } catch (error) {
    console.error('[SubscriptionCache] Failed to invalidate user cache:', error);
  }
}
