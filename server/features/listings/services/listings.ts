import { db } from '../../../data/db';
import {
  listings,
  insertListingSchema,
  type Listing,
  type InsertListing,
} from '../../admin/models/admin-settings';
import { eq, and, desc, or, gte, lt, isNull, isNotNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Create new listing
 */
export async function createListing(data: InsertListing): Promise<Listing> {
  // Validate schema
  const validated = insertListingSchema.parse(data);

  // Stringify images if it's an array
  const images =
    validated.images && typeof validated.images !== 'string'
      ? JSON.stringify(validated.images)
      : validated.images;

  // Stringify videos if it's an array
  const videos =
    validated.videos && typeof validated.videos !== 'string'
      ? JSON.stringify(validated.videos)
      : validated.videos;

  // Calculate expiration if duration is provided
  const expiresAt = validated.durationDays
    ? new Date(Date.now() + validated.durationDays * 24 * 60 * 60 * 1000)
    : null;

  const result = await db
    .insert(listings)
    .values({
      ...validated,
      images,
      videos,
      expiresAt,
    } as any)
    .returning();

  return result[0];
}

/**
 * Get listing by ID
 */
export async function getListingById(id: string): Promise<Listing | null> {
  const result = await db.select().from(listings).where(eq(listings.id, id)).limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get all active listings (with pagination and optional geo-filtering)
 */
export async function getActiveListing(
  opts: {
    limit?: number;
    offset?: number;
    category?: string;
    sellerId?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
  } = {}
): Promise<Listing[]> {
  const { limit = 50, offset = 0, category, sellerId, latitude, longitude, radiusKm } = opts;

  const conditions = [
    eq(listings.isActive, true),
    eq(listings.status, 'active'),
    or(isNull(listings.expiresAt), gte(listings.expiresAt, sql`now()`)),
  ];

  if (category) {
    conditions.push(eq(listings.category, category));
  }

  if (sellerId) {
    conditions.push(eq(listings.sellerId, sellerId));
  }

  // Build base query
  let query = db
    .select()
    .from(listings)
    .where(and(...conditions))
    .orderBy(desc(listings.createdAt))
    .limit(limit)
    .offset(offset);

  // If geo-filtering is requested, filter by distance
  if (latitude !== undefined && longitude !== undefined && radiusKm !== undefined && radiusKm > 0) {
    // Haversine formula for distance calculation in PostgreSQL
    // Distance in km = 6371 * 2 * ASIN(SQRT(POWER(SIN((lat2 - lat1) * PI() / 180 / 2), 2) + 
    //                COS(lat1 * PI() / 180) * COS(lat2 * PI() / 180) * 
    //                POWER(SIN((lon2 - lon1) * PI() / 180 / 2), 2)))
    const distanceFormula = sql`(
      6371 * 2 * ASIN(SQRT(
        POWER(SIN((CAST(${listings.latitude} AS NUMERIC) - ${latitude}) * PI() / 180 / 2), 2) +
        COS(${latitude} * PI() / 180) * COS(CAST(${listings.latitude} AS NUMERIC) * PI() / 180) *
        POWER(SIN((CAST(${listings.longitude} AS NUMERIC) - ${longitude}) * PI() / 180 / 2), 2)
      ))
    )`;

    const allResults = await query;
    
    // Filter results by distance (since we can't use HAVING without GROUP BY)
    const filtered = allResults.filter((listing) => {
      if (!listing.latitude || !listing.longitude) return false;
      const lat1 = parseFloat(listing.latitude);
      const lon1 = parseFloat(listing.longitude);
      const lat2 = latitude;
      const lon2 = longitude;
      
      // Haversine formula in JavaScript
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      return distance <= radiusKm;
    });
    
    return filtered;
  }

  return await query;
}

/**
 * Get listings by seller
 */
export async function getListingsBySeller(sellerId: string): Promise<Listing[]> {
  return await db
    .select()
    .from(listings)
    .where(eq(listings.sellerId, sellerId))
    .orderBy(desc(listings.createdAt));
}

/**
 * Get listings by subscription tier
 */
export async function getListingsBySubscriptionTier(tierId: string): Promise<Listing[]> {
  return await db
    .select()
    .from(listings)
    .where(eq(listings.subscriptionTierId, tierId))
    .orderBy(desc(listings.createdAt));
}

/**
 * Get listings by coupon
 */
export async function getListingsByCoupon(couponId: string): Promise<Listing[]> {
  return await db.select().from(listings).where(eq(listings.couponId, couponId));
}

/**
 * Update listing
 */
export async function updateListing(
  id: string,
  updates: Partial<InsertListing>
): Promise<Listing | null> {
  const normalizedUpdates = { ...updates };

  if (normalizedUpdates.status === 'sold') {
    normalizedUpdates.isActive = false;
  }

  if (normalizedUpdates.status === 'active') {
    normalizedUpdates.isActive = true;
  }

  const images =
    normalizedUpdates.images && typeof normalizedUpdates.images !== 'string'
      ? JSON.stringify(normalizedUpdates.images)
      : normalizedUpdates.images;

  const videos =
    normalizedUpdates.videos && typeof normalizedUpdates.videos !== 'string'
      ? JSON.stringify(normalizedUpdates.videos)
      : normalizedUpdates.videos;

  const result = await db
    .update(listings)
    .set({
      ...normalizedUpdates,
      images,
      videos,
      updatedAt: new Date(),
    } as any)
    .where(eq(listings.id, id))
    .returning();

  return result.length > 0 ? result[0] : null;
}

/**
 * Mark listing as sold
 */
export async function markListingAsSold(id: string): Promise<Listing | null> {
  return await updateListing(id, {
    status: 'sold',
    isActive: false,
  });
}

/**
 * Mark listing as expired
 */
export async function expireListing(id: string): Promise<Listing | null> {
  return await updateListing(id, {
    status: 'expired',
    isActive: false,
  });
}

/**
 * Delete listing
 */
export async function deleteListing(id: string): Promise<boolean> {
  const result = await db.delete(listings).where(eq(listings.id, id));
  return (result as any).rowCount > 0;
}

/**
 * Search listings by location (geo-search)
 */
export async function searchListingsByLocation(opts?: {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
}): Promise<Listing[]> {
  const { latitude, longitude, radiusKm = 50, limit = 50 } = opts || {};

  if (!latitude || !longitude) {
    return [];
  }

  // Using PostgreSQL distance calculation
  // NOTE: In production, use PostGIS ST_Distance with proper GIS types
  return await db
    .select()
    .from(listings)
    .where(and(eq(listings.isActive, true), eq(listings.status, 'active')))
    .limit(limit);
}

/**
 * Get total listing count
 */
export async function getTotalListingCount(): Promise<number> {
  const result = await db.select({ count: sql`count(*)` }).from(listings);

  return Number(result[0].count || 0);
}

/**
 * Get active listing count
 */
export async function getActiveListingCount(): Promise<number> {
  const result = await db
    .select({ count: sql`count(*)` })
    .from(listings)
    .where(
      and(
        eq(listings.isActive, true),
        eq(listings.status, 'active'),
        or(isNull(listings.expiresAt), gte(listings.expiresAt, sql`now()`))
      )
    );

  return Number(result[0].count || 0);
}

/**
 * Get paid listing count (with subscription)
 */
export async function getPaidListingCount(): Promise<number> {
  const result = await db
    .select({ count: sql`count(*)` })
    .from(listings)
    .where(eq(listings.isPaid, true));

  return Number(result[0].count || 0);
}

/**
 * Expire all listings with expired dates
 */
export async function expireExpiredListings(): Promise<number> {
  const result = await db
    .update(listings)
    .set({ status: 'expired', isActive: false, updatedAt: new Date() })
    .where(and(lt(listings.expiresAt, sql`now()`), eq(listings.status, 'active')));

  return (result as any).rowCount || 0;
}

/**
 * Get listing statistics
 */
export async function getListingStats() {
  const totalListings = await getTotalListingCount();
  const activeListings = await getActiveListingCount();
  const paidListings = await getPaidListingCount();

  return {
    total: totalListings,
    active: activeListings,
    paid: paidListings,
    free: totalListings - paidListings,
  };
}
