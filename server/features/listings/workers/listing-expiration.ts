/**
 * Listing Expiration Worker
 * Automatically deactivates expired listings and handles cleanup
 */

import { db } from '../../../data/db';
import { listings } from '../../admin/models/admin-settings';
import { eq, and, lt, gt, or, isNotNull, inArray } from 'drizzle-orm';
import { redisCache } from '../../../shared/cache/redis-cache';
import { deriveDealStatus } from '../lib/deal-status';

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
  const nowMs = now.getTime();

  console.log('[ListingWorker] Starting expiration check...');

  try {
    // Find all active listings that have expired
    const expiredListings = await db
      .select()
      .from(listings)
      .where(
        and(eq(listings.isActive, true), eq(listings.status, 'active'), lt(listings.expiresAt, now))
      );

    let deactivatedCount = 0;

    if (expiredListings.length === 0) {
      console.log('[ListingWorker] No expired listings found');
    } else {
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
      deactivatedCount = result.length;

      const expiredDealIds = expiredListings
        .filter((listing) => Boolean(listing.isDeal))
        .map((listing) => listing.id);
      if (expiredDealIds.length > 0) {
        await db
          .update(listings)
          .set({
            dealStatus: 'expired',
            updatedAt: now,
          } as never)
          .where(inArray(listings.id, expiredDealIds));
      }

      // Invalidate cache for affected listings and categories
      await invalidateListingCache(expiredListings.map((l) => l.id));

      // Invalidate category caches
      const affectedCategories = [...new Set(expiredListings.map((l) => l.category))];
      await invalidateCategoryCache(affectedCategories);
    }

    const dealSyncResult = await syncDealStatuses(nowMs);

    const duration = Date.now() - startTime;
    console.log(
      `[ListingWorker] Deactivated ${deactivatedCount} listings and synced ${dealSyncResult.updatedCount} deal statuses in ${duration}ms`
    );

    return {
      deactivatedCount: deactivatedCount + dealSyncResult.updatedCount,
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

async function syncDealStatuses(nowMs: number): Promise<{ updatedCount: number }> {
  const candidates = await db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.isActive, true),
        eq(listings.status, 'active'),
        or(eq(listings.isDeal, true), isNotNull(listings.dealStatus))
      )
    );

  let updatedCount = 0;
  const affectedIds = new Set<string>();
  const affectedCategories = new Set<string>();

  for (const listing of candidates) {
    const nextStatus = deriveDealStatus(listing as any, nowMs);
    const currentStatus = String((listing as any).dealStatus || '').toLowerCase() || null;
    if (nextStatus === currentStatus) continue;

    await db
      .update(listings)
      .set({
        dealStatus: nextStatus,
        updatedAt: new Date(nowMs),
      } as never)
      .where(eq(listings.id, listing.id));
    updatedCount += 1;
    affectedIds.add(String(listing.id));
    affectedCategories.add(String(listing.category || ''));
  }

  if (updatedCount > 0) {
    await invalidateListingCache([...affectedIds]);
    await invalidateCategoryCache([...affectedCategories].filter(Boolean));
  }

  return { updatedCount };
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
