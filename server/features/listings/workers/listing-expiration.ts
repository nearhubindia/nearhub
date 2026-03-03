/**
 * Listing Expiration Worker
 * Automatically deactivates expired listings and handles cleanup
 */

import { db } from '../../../data/db';
import { listings } from '../../admin/models/admin-settings';
import { eq, and, lt, gt } from 'drizzle-orm';
import { redisCache } from '../../../shared/cache/redis-cache';

interface ExpirationResult {
  deactivatedCount: number;
  errors: number;
  duration: number;
}

/**
 * Check and deactivate listings that have passed their expiration date
 */
export async function checkAndDeactivateListings(): Promise<ExpirationResult> {
  const startTime = Date.now();
  const now = new Date();

  console.log('[ListingWorker] Starting expiration check...');

  try {
    // Find all active listings that have expired
    const expiredListings = await db
      .select()
      .from(listings)
      .where(
        and(eq(listings.isActive, true), eq(listings.status, 'active'), lt(listings.expiresAt, now))
      );

    if (expiredListings.length === 0) {
      console.log('[ListingWorker] No expired listings found');
      return {
        deactivatedCount: 0,
        errors: 0,
        duration: Date.now() - startTime,
      };
    }

    console.log(`[ListingWorker] Found ${expiredListings.length} expired listings`);

    // Batch update all expired listings
    const result = await db
      .update(listings)
      .set({
        isActive: false,
        status: 'expired',
        updatedAt: now,
      })
      .where(
        and(eq(listings.isActive, true), eq(listings.status, 'active'), lt(listings.expiresAt, now))
      )
      .returning();

    // Invalidate cache for affected listings and categories
    await invalidateListingCache(expiredListings.map((l) => l.id));

    // Invalidate category caches
    const affectedCategories = [...new Set(expiredListings.map((l) => l.category))];
    await invalidateCategoryCache(affectedCategories);

    const duration = Date.now() - startTime;
    console.log(`[ListingWorker] Deactivated ${result.length} listings in ${duration}ms`);

    return {
      deactivatedCount: result.length,
      errors: 0,
      duration,
    };
  } catch (error) {
    console.error('[ListingWorker] Error during expiration check:', error);
    return {
      deactivatedCount: 0,
      errors: 1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Invalidate listing cache
 */
async function invalidateListingCache(listingIds: string[]): Promise<void> {
  try {
    const cacheKeys = [
      'listings:active',
      'listings:all',
      ...listingIds.map((id) => `listing:${id}`),
    ];
    await Promise.all(cacheKeys.map((key) => redisCache.delete(key)));
    console.log(`[ListingWorker] Invalidated cache for ${listingIds.length} listings`);
  } catch (error) {
    console.error('[ListingWorker] Cache invalidation failed:', error);
  }
}

/**
 * Invalidate category cache
 */
async function invalidateCategoryCache(categories: string[]): Promise<void> {
  try {
    const cacheKeys = categories.map((cat) => `listings:category:${cat}`);
    await Promise.all(cacheKeys.map((key) => redisCache.delete(key)));
    console.log(`[ListingWorker] Invalidated cache for ${categories.length} categories`);
  } catch (error) {
    console.error('[ListingWorker] Category cache invalidation failed:', error);
  }
}

/**
 * Get listing expiration statistics
 */
export async function getListingExpirationStats(): Promise<{
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
      .from(listings)
      .where(
        and(eq(listings.isActive, true), eq(listings.status, 'active'), gt(listings.expiresAt, now))
      ),
    db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.isActive, true),
          eq(listings.status, 'active'),
          lt(listings.expiresAt, in24h),
          gt(listings.expiresAt, now)
        )
      ),
    db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.isActive, true),
          eq(listings.status, 'active'),
          lt(listings.expiresAt, in7d),
          gt(listings.expiresAt, now)
        )
      ),
    db.select().from(listings).where(eq(listings.status, 'expired')),
  ]);

  return {
    active: active.length,
    expiring24h: expiring24h.length,
    expiring7d: expiring7d.length,
    expired: expired.length,
  };
}
