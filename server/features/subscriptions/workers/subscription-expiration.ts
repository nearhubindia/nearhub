/**
 * Subscription Expiration Worker
 * Automatically expires subscriptions and handles cleanup
 */

import { db } from '../../../data/db';
import { userSubscriptions } from '../../admin/models/admin-settings';
import { eq, and, lt, gt } from 'drizzle-orm';
import { redisCache } from '../../../shared/cache/redis-cache';

interface ExpirationResult {
  expiredCount: number;
  errors: number;
  duration: number;
}

/**
 * Check and expire subscriptions that have passed their expiration date
 */
export async function checkAndExpireSubscriptions(): Promise<ExpirationResult> {
  const startTime = Date.now();
  const now = new Date();
  
  console.log('[SubscriptionWorker] Starting expiration check...');

  try {
    // Find all active subscriptions that have expired
    const expiredSubscriptions = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          lt(userSubscriptions.expiresAt, now)
        )
      );

    if (expiredSubscriptions.length === 0) {
      console.log('[SubscriptionWorker] No expired subscriptions found');
      return {
        expiredCount: 0,
        errors: 0,
        duration: Date.now() - startTime,
      };
    }

    console.log(`[SubscriptionWorker] Found ${expiredSubscriptions.length} expired subscriptions`);

    // Batch update all expired subscriptions
    const result = await db
      .update(userSubscriptions)
      .set({
        status: 'expired',
        updatedAt: now,
      })
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          lt(userSubscriptions.expiresAt, now)
        )
      )
      .returning();

    // Invalidate cache for affected users
    const affectedUserIds = [...new Set(expiredSubscriptions.map(s => s.userId))];
    await invalidateUserSubscriptionCache(affectedUserIds);

    const duration = Date.now() - startTime;
    console.log(
      `[SubscriptionWorker] Expired ${result.length} subscriptions in ${duration}ms`
    );

    return {
      expiredCount: result.length,
      errors: 0,
      duration,
    };
  } catch (error) {
    console.error('[SubscriptionWorker] Error during expiration check:', error);
    return {
      expiredCount: 0,
      errors: 1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Invalidate subscription cache for users
 */
async function invalidateUserSubscriptionCache(userIds: string[]): Promise<void> {
  try {
    const cacheKeys = userIds.map(id => `user:${id}:subscriptions`);
    await Promise.all(cacheKeys.map(key => redisCache.delete(key)));
    console.log(`[SubscriptionWorker] Invalidated cache for ${userIds.length} users`);
  } catch (error) {
    console.error('[SubscriptionWorker] Cache invalidation failed:', error);
    // Don't throw - cache invalidation failure shouldn't stop the worker
  }
}

/**
 * Get subscription expiration statistics
 */
export async function getSubscriptionExpirationStats(): Promise<{
  active: number;
  expiring24h: number;
  expiring7d: number;
  expired: number;
}> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [active, expiring24h, expiring7d, expired] = await Promise.all([
    db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          gt(userSubscriptions.expiresAt, now)
        )
      ),
    db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          lt(userSubscriptions.expiresAt, in24h),
          gt(userSubscriptions.expiresAt, now)
        )
      ),
    db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          lt(userSubscriptions.expiresAt, in7d),
          gt(userSubscriptions.expiresAt, now)
        )
      ),
    db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.status, 'expired')),
  ]);

  return {
    active: active.length,
    expiring24h: expiring24h.length,
    expiring7d: expiring7d.length,
    expired: expired.length,
  };
}
