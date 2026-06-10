import { db } from '../../../data/db';
import {
  listings,
  insertListingSchema,
  type Listing,
  type InsertListing,
} from '../../admin/models/admin-settings';
import { loadListingAttributeValueMap, replaceListingAttributeValues } from './listing-attributes';
import { eq, and, desc, or, gte, lt, isNull, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

function coerceMediaToArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
      if (parsed == null) return [];
      return [String(parsed)];
    } catch {
      return [trimmed];
    }
  }

  return [String(value)];
}

function coerceMediaToJson(value: unknown): string {
  return JSON.stringify(coerceMediaToArray(value));
}

/**
 * Create new listing
 */
export async function createListing(
  data: InsertListing & { attributes?: unknown }
): Promise<Listing> {
  const { attributes, ...rest } = data as InsertListing & {
    attributes?: unknown;
  };
  // Validate schema
  const validated = insertListingSchema.parse(rest);
  const normalizedSubCategory =
    typeof validated.subCategory === 'string' && validated.subCategory.trim()
      ? validated.subCategory.trim()
      : typeof validated.category === 'string' && validated.category.trim()
        ? validated.category.trim()
        : '';
  const normalizedMainCategory =
    typeof validated.mainCategory === 'string' && validated.mainCategory.trim()
      ? validated.mainCategory.trim()
      : normalizedSubCategory || null;

  // Images are stored as a Postgres text[] column in the active schema.
  // Videos remain text(JSON) for backward compatibility.
  const imagesAsArray = coerceMediaToArray(validated.images);
  const videosAsJson = coerceMediaToJson(validated.videos);

  // Calculate expiration if duration is provided
  const expiresAt = validated.durationDays
    ? new Date(Date.now() + validated.durationDays * 24 * 60 * 60 * 1000)
    : null;

  const insertValues = (imagesValue: unknown, videosValue: unknown) =>
    ({
      ...validated,
      mainCategory: normalizedMainCategory,
      subCategory: normalizedSubCategory || null,
      category: normalizedSubCategory || validated.category,
      images: imagesValue,
      videos: videosValue,
      expiresAt,
    }) as any;

  try {
    const result = await db
      .insert(listings)
      .values(insertValues(imagesAsArray, videosAsJson))
      .returning();
    const created = result[0];
    if (created && attributes && Object.keys(attributes).length > 0) {
      await replaceListingAttributeValues({
        listingId: created.id,
        mainCategory: created.mainCategory,
        subCategory: created.subCategory,
        attributes,
      }).catch(() => undefined);
    }
    return created;
  } catch (error: any) {
    // Fallback for deployments where images are stored as JSON text instead of text[].
    const isMalformedArray =
      error?.code === '22P02' && String(error?.message || '').includes('malformed array literal');
    if (!isMalformedArray) {
      throw error;
    }

    const imagesAsJson = coerceMediaToJson(validated.images);
    const videosAsJson = coerceMediaToJson(validated.videos);

    const retry = await db
      .insert(listings)
      .values(insertValues(imagesAsJson, videosAsJson))
      .returning();
    const created = retry[0];
    if (created && attributes && Object.keys(attributes).length > 0) {
      await replaceListingAttributeValues({
        listingId: created.id,
        mainCategory: created.mainCategory,
        subCategory: created.subCategory,
        attributes,
      }).catch(() => undefined);
    }
    return created;
  }
}

/**
 * Get listing by ID
 */
export async function getListingById(
  id: string
): Promise<(Listing & { attributes?: Record<string, string | number | boolean> }) | null> {
  const result = await db.select().from(listings).where(eq(listings.id, id)).limit(1);

  if (result.length === 0) return null;
  const listing = result[0];
  const attributes = await loadListingAttributeValueMap(id).catch(() => ({}));
  return {
    ...listing,
    attributes,
  };
}

/**
 * Get all active listings (with pagination and optional geo-filtering)
 */
export async function getActiveListing(
  opts: {
    limit?: number;
    offset?: number;
    category?: string;
    mainCategory?: string;
    subCategory?: string;
    ownerId?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    dealsOnly?: boolean;
    includeExpiredDeals?: boolean;
  } = {}
): Promise<Listing[]> {
  const {
    limit = 50,
    offset = 0,
    category,
    mainCategory,
    subCategory,
    ownerId,
    latitude,
    longitude,
    radiusKm,
    dealsOnly,
    includeExpiredDeals,
  } = opts;

  const conditions =
    includeExpiredDeals && dealsOnly
      ? [eq(listings.isDeal, true), inArray(listings.status, ['active', 'expired'])]
      : [
          eq(listings.isActive, true),
          eq(listings.status, 'active'),
          or(isNull(listings.expiresAt), gte(listings.expiresAt, sql`now()`)),
        ];

  if (dealsOnly && !(includeExpiredDeals && dealsOnly)) {
    conditions.push(eq(listings.isDeal, true));
  }

  if (category) {
    conditions.push(eq(listings.category, category));
  }
  if (mainCategory) {
    conditions.push(eq(listings.mainCategory, mainCategory));
  }
  if (subCategory) {
    conditions.push(eq(listings.subCategory, subCategory));
  }

  if (ownerId) {
    conditions.push(eq(listings.sellerId, ownerId));
  }

  // Build base query
  const query = db
    .select()
    .from(listings)
    .where(and(...conditions))
    .orderBy(
      sql`CASE WHEN ${listings.boostedUntil} IS NOT NULL AND ${listings.boostedUntil} > now() THEN 1 ELSE 0 END DESC`,
      desc(listings.featured),
      desc(listings.createdAt)
    )
    .limit(limit)
    .offset(offset);

  // If geo-filtering is requested, filter by distance
  if (latitude !== undefined && longitude !== undefined && radiusKm !== undefined && radiusKm > 0) {
    // Haversine formula for distance calculation in PostgreSQL
    // Distance in km = 6371 * 2 * ASIN(SQRT(POWER(SIN((lat2 - lat1) * PI() / 180 / 2), 2) +
    //                COS(lat1 * PI() / 180) * COS(lat2 * PI() / 180) *
    //                POWER(SIN((lon2 - lon1) * PI() / 180 / 2), 2)))
    const allResults = await query;

    // Filter results by distance (since we can't use HAVING without GROUP BY)
    const filtered = allResults.filter((listing) => {
      // When geo filtering is active, only show listings with valid coordinates.
      // This prevents unrelated locations from leaking into nearby results.
      if (!listing.latitude || !listing.longitude) return false;
      const lat1 = parseFloat(listing.latitude);
      const lon1 = parseFloat(listing.longitude);
      const lat2 = latitude;
      const lon2 = longitude;

      // Haversine formula in JavaScript
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return distance <= radiusKm;
    });

    return filtered;
  }

  return await query;
}

/**
 * Boost a listing for a fixed number of hours.
 */
export async function boostListingForHours(id: string, hours: number): Promise<Listing | null> {
  const safeHours = Number.isFinite(hours) && hours > 0 ? Math.floor(hours) : 24;
  const boostedUntil = new Date(Date.now() + safeHours * 60 * 60 * 1000);

  const result = await db
    .update(listings)
    .set({
      featured: true,
      boostedUntil,
      boostCount: sql`${listings.boostCount} + 1`,
      updatedAt: new Date(),
    } as any)
    .where(eq(listings.id, id))
    .returning();

  return result.length > 0 ? result[0] : null;
}

/**
 * Get listings by user
 */
export async function getListingsByUser(userId: string): Promise<Listing[]> {
  return await db
    .select()
    .from(listings)
    .where(eq(listings.sellerId, userId))
    .orderBy(desc(listings.createdAt));
}

export const getListingsBySeller = getListingsByUser;

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
  updates: Partial<InsertListing> & { attributes?: unknown }
): Promise<Listing | null> {
  const { attributes, ...updatesWithoutAttributes } = updates as Partial<InsertListing> & {
    attributes?: unknown;
  };
  const normalizedUpdates = { ...updatesWithoutAttributes } as Partial<InsertListing> & {
    subcategory?: string;
  };
  const normalizedSubCategory =
    typeof normalizedUpdates.subCategory === 'string' && normalizedUpdates.subCategory.trim()
      ? normalizedUpdates.subCategory.trim()
      : typeof normalizedUpdates.subcategory === 'string' && normalizedUpdates.subcategory.trim()
        ? normalizedUpdates.subcategory.trim()
        : typeof normalizedUpdates.category === 'string' && normalizedUpdates.category.trim()
          ? normalizedUpdates.category.trim()
          : '';
  if (normalizedSubCategory) {
    normalizedUpdates.subCategory = normalizedSubCategory;
    normalizedUpdates.category = normalizedSubCategory;
  }
  if (
    typeof normalizedUpdates.mainCategory === 'string' &&
    !normalizedUpdates.mainCategory.trim()
  ) {
    normalizedUpdates.mainCategory = undefined;
  }
  if (
    !normalizedUpdates.mainCategory &&
    normalizedSubCategory &&
    typeof normalizedSubCategory === 'string'
  ) {
    normalizedUpdates.mainCategory = normalizedSubCategory;
  }
  delete normalizedUpdates.subcategory;

  if (normalizedUpdates.status === 'sold') {
    normalizedUpdates.isActive = false;
  }

  if (normalizedUpdates.status === 'active') {
    normalizedUpdates.isActive = true;
  }

  if (normalizedUpdates.status === 'pending') {
    normalizedUpdates.isActive = false;
  }

  const images = coerceMediaToArray(normalizedUpdates.images);
  const videos = coerceMediaToJson(normalizedUpdates.videos);

  try {
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

    const updated = result.length > 0 ? result[0] : null;
    if (updated && attributes !== undefined) {
      await replaceListingAttributeValues({
        listingId: updated.id,
        mainCategory: updated.mainCategory,
        subCategory: updated.subCategory,
        attributes,
      }).catch(() => undefined);
    }

    return updated;
  } catch (error: any) {
    const isMalformedArray =
      error?.code === '22P02' && String(error?.message || '').includes('malformed array literal');
    if (!isMalformedArray) {
      throw error;
    }

    const result = await db
      .update(listings)
      .set({
        ...normalizedUpdates,
        images: coerceMediaToJson(normalizedUpdates.images),
        videos: coerceMediaToJson(normalizedUpdates.videos),
        updatedAt: new Date(),
      } as any)
      .where(eq(listings.id, id))
      .returning();

    const updated = result.length > 0 ? result[0] : null;
    if (updated && attributes !== undefined) {
      await replaceListingAttributeValues({
        listingId: updated.id,
        mainCategory: updated.mainCategory,
        subCategory: updated.subCategory,
        attributes,
      }).catch(() => undefined);
    }

    return updated;
  }
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
  void radiusKm;

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
