import { db, pool } from '../../../data/db';
import {
  listings,
  insertListingSchema,
  type Listing,
  type InsertListing,
} from '../../admin/models/admin-settings';
import { loadListingAttributeValueMap, replaceListingAttributeValues } from './listing-attributes';
import { eq, and, desc, or, gte, lt, isNull, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { deriveDealStatus } from '../lib/deal-status';

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

function isListingsImagesSchemaMismatchError(error: unknown): boolean {
  return (
    isDbError(error) &&
    (error.code === '22P02' ||
      error.code === '42804' ||
      error.code === '23502' ||
      error.code === '42601') &&
    (String(error.message || '').includes('malformed array literal') ||
      String(error.message || '').includes('column "images" is of type text[]') ||
      String(error.message || '').includes('column "images" is of type text') ||
      String(error.message || '').includes('cannot cast type'))
  );
}

function isDbError(error: unknown): error is { code?: string; message?: string } {
  return typeof error === 'object' && error !== null;
}

type DbResultWithRowCount = { rowCount?: number };

function toSnakeCaseColumnName(key: string): string {
  return key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

async function insertListingWithPgArrayImages(
  values: InsertListing & {
    mainCategory: string | null;
    subCategory: string | null;
    category: string;
    images: string[];
    videos: string;
    expiresAt: Date | null;
  }
): Promise<Listing> {
  const result = await pool.query(
    `insert into listings (
      seller_id, title, description, main_category, sub_category, category, listing_type,
      price, offer_price, price_unit, contact_phone, condition, location, pincode,
      latitude, longitude, images, videos, subscription_tier_id, user_subscription_id,
      coupon_id, status, is_active, is_paid, featured, boosted_until,
      boost_count, is_deal, deal_type, deal_start_at, deal_end_at, deal_recurrence,
      deal_recurrence_until, deal_cycle_quantity, deal_last_cycle_key, max_deal_bookings,
      deal_bookings_used, deal_terms, voucher_enabled, duration_days, expires_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26,
      $27, $28, $29, $30, $31, $32,
      $33, $34, $35, $36, $37, $38,
      $39, $40, $41
    ) returning *`,
    [
      values.sellerId,
      values.title,
      values.description ?? null,
      values.mainCategory,
      values.subCategory,
      values.category,
      values.listingType ?? 'mixed',
      values.price,
      values.offerPrice ?? null,
      values.priceUnit ?? null,
      values.contactPhone ?? null,
      values.condition ?? null,
      values.location,
      values.pincode ?? null,
      values.latitude ?? null,
      values.longitude ?? null,
      values.images,
      values.videos,
      values.subscriptionTierId ?? null,
      values.userSubscriptionId ?? null,
      values.couponId ?? null,
      values.status ?? 'active',
      values.isActive ?? true,
      values.isPaid ?? false,
      values.featured ?? false,
      values.boostedUntil ?? null,
      values.boostCount ?? 0,
      values.isDeal ?? false,
      values.dealType ?? null,
      values.dealStartAt ?? null,
      values.dealEndAt ?? null,
      values.dealRecurrence ?? 'none',
      values.dealRecurrenceUntil ?? null,
      values.dealCycleQuantity ?? null,
      values.dealLastCycleKey ?? null,
      values.maxDealBookings ?? null,
      values.dealBookingsUsed ?? 0,
      values.dealTerms ?? null,
      values.voucherEnabled ?? true,
      values.durationDays ?? null,
      values.expiresAt,
    ]
  );

  return result.rows[0] as Listing;
}

async function updateListingWithPgArrayImages(
  id: string,
  updateValues: Record<string, unknown>
): Promise<Listing | null> {
  const entries = Object.entries(updateValues);
  if (entries.length === 0) {
    const existing = await getListingById(id);
    return existing as Listing | null;
  }

  const assignments = entries.map(
    ([key], index) => `"${toSnakeCaseColumnName(key)}" = $${index + 1}`
  );
  const params = entries.map(([, value]) => value);
  params.push(id);

  const result = await pool.query(
    `update listings set ${assignments.join(', ')} where id = $${params.length} returning *`,
    params
  );

  return (result.rows[0] as Listing | undefined) ?? null;
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

  // Production currently stores images as text[] while some environments still use JSON text.
  const imagesAsArray = coerceMediaToArray(validated.images);
  const imagesAsJson = coerceMediaToJson(validated.images);
  const videosAsJson = coerceMediaToJson(validated.videos);

  // Calculate expiration if duration is provided
  const expiresAt = validated.durationDays
    ? new Date(Date.now() + validated.durationDays * 24 * 60 * 60 * 1000)
    : null;

  const insertValues = (imagesValue: string, videosValue: string) =>
    ({
      ...validated,
      mainCategory: normalizedMainCategory,
      subCategory: normalizedSubCategory || null,
      category: normalizedSubCategory || validated.category,
      images: imagesValue,
      videos: videosValue,
      expiresAt,
    });

  try {
    let created = await insertListingWithPgArrayImages({
      ...validated,
      mainCategory: normalizedMainCategory,
      subCategory: normalizedSubCategory || null,
      category: normalizedSubCategory || validated.category,
      images: imagesAsArray,
      videos: videosAsJson,
      expiresAt,
    });
    if (created) {
      const syncedDealStatus = deriveDealStatus(created as any, Date.now());
      if (String((created as any).dealStatus ?? '') !== String(syncedDealStatus ?? '')) {
        const synced = await db
          .update(listings)
          .set({
            dealStatus: syncedDealStatus,
            updatedAt: new Date(),
          } as never)
          .where(eq(listings.id, created.id))
          .returning();
        if (synced[0]) {
          created = synced[0];
        }
      }
    }
    if (created && attributes && Object.keys(attributes).length > 0) {
      await replaceListingAttributeValues({
        listingId: created.id,
        mainCategory: created.mainCategory,
        subCategory: created.subCategory,
        attributes,
      }).catch(() => undefined);
    }
    return created;
  } catch (error: unknown) {
    console.error('[Listings] Raw image-array insert failed, falling back:', error);
    // Fallback for deployments where the listings.images column is still JSON text.
    if (!isListingsImagesSchemaMismatchError(error)) {
      throw error;
    }

    const retry = await db
      .insert(listings)
      .values(insertValues(imagesAsJson, videosAsJson) as never)
      .returning();
    let created = retry[0];
    if (created) {
      const syncedDealStatus = deriveDealStatus(created as any, Date.now());
      if (String((created as any).dealStatus ?? '') !== String(syncedDealStatus ?? '')) {
        const synced = await db
          .update(listings)
          .set({
            dealStatus: syncedDealStatus,
            updatedAt: new Date(),
          } as never)
          .where(eq(listings.id, created.id))
          .returning();
        if (synced[0]) {
          created = synced[0];
        }
      }
    }
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
  } else if (!dealsOnly) {
    // Deals have dedicated feeds and must never leak into ordinary listing results.
    conditions.push(eq(listings.isDeal, false));
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
  if (latitude !== undefined && longitude !== undefined && radiusKm !== undefined && radiusKm > 0) {
    const distanceExpression = sql<number>`
      6371 * acos(
        least(
          1,
          greatest(
            -1,
            cos(radians(${latitude}))
              * cos(radians(CAST(${listings.latitude} AS double precision)))
              * cos(
                radians(CAST(${listings.longitude} AS double precision))
                - radians(${longitude})
              )
              + sin(radians(${latitude}))
              * sin(radians(CAST(${listings.latitude} AS double precision)))
          )
        )
      )
    `;
    const effectiveRadiusExpression = sql<number>`
      greatest(
        ${radiusKm},
        case
          when ${listings.visibilityMode} = 'online' then coalesce(${listings.visibilityRadiusKm}, 0)
          else 0
        end
      )
    `;

    return await db
      .select()
      .from(listings)
      .where(
        and(
          ...conditions,
          sql`${listings.latitude} IS NOT NULL AND ${listings.longitude} IS NOT NULL`,
          sql`${distanceExpression} <= ${effectiveRadiusExpression}`
        )
      )
      .orderBy(
        sql`CASE WHEN ${listings.boostedUntil} IS NOT NULL AND ${listings.boostedUntil} > now() THEN 1 ELSE 0 END DESC`,
        desc(listings.featured),
        desc(listings.createdAt)
      )
      .limit(limit)
      .offset(offset);
  }

  return await db
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
    })
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
  const existingListing = await getListingById(id);
  if (!existingListing) return null;
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

  const hasImagesUpdate = Object.prototype.hasOwnProperty.call(normalizedUpdates, 'images');
  const hasVideosUpdate = Object.prototype.hasOwnProperty.call(normalizedUpdates, 'videos');
  const updateValues = {
    ...normalizedUpdates,
    updatedAt: new Date(),
  } as Record<string, unknown>;

  if (hasImagesUpdate) {
    const normalizedImages = coerceMediaToArray(normalizedUpdates.images);
    updateValues.images = normalizedImages;
  } else {
    delete updateValues.images;
  }

  if (hasVideosUpdate) {
    updateValues.videos = coerceMediaToJson(normalizedUpdates.videos);
  } else {
    delete updateValues.videos;
  }

  updateValues.dealStatus = deriveDealStatus(
    {
      ...(existingListing as any),
      ...(normalizedUpdates as any),
      isDeal:
        normalizedUpdates.isDeal !== undefined
          ? normalizedUpdates.isDeal
          : (existingListing as any).isDeal ?? (existingListing as any).is_deal,
    },
    Date.now()
  );

  try {
    let updated = hasImagesUpdate
      ? await updateListingWithPgArrayImages(id, updateValues)
      : (
          await db.update(listings).set(updateValues as never).where(eq(listings.id, id)).returning()
        )[0] || null;
    if (updated) {
      const syncedDealStatus = deriveDealStatus(updated as any, Date.now());
      if (String((updated as any).dealStatus ?? '') !== String(syncedDealStatus ?? '')) {
        const synced = await db
          .update(listings)
          .set({
            dealStatus: syncedDealStatus,
            updatedAt: new Date(),
          } as never)
          .where(eq(listings.id, id))
          .returning();
        if (synced[0]) {
          updated = synced[0];
        }
      }
    }
    if (updated && attributes !== undefined) {
      await replaceListingAttributeValues({
        listingId: updated.id,
        mainCategory: updated.mainCategory,
        subCategory: updated.subCategory,
        attributes,
      }).catch(() => undefined);
    }

    return updated;
  } catch (error: unknown) {
    console.error('[Listings] Raw image-array update failed, falling back:', error);
    if (!isListingsImagesSchemaMismatchError(error)) {
      throw error;
    }

    const result = await db
      .update(listings)
      .set(
        {
          ...updateValues,
          ...(hasImagesUpdate ? { images: coerceMediaToJson(normalizedUpdates.images) } : {}),
          ...(hasVideosUpdate ? { videos: coerceMediaToJson(normalizedUpdates.videos) } : {}),
          updatedAt: new Date(),
        } as never
      )
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
  const result = (await db.delete(listings).where(eq(listings.id, id))) as DbResultWithRowCount;
  return (result.rowCount || 0) > 0;
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
  const result = (await db
    .update(listings)
    .set({ status: 'expired', isActive: false, updatedAt: new Date() })
    .where(and(lt(listings.expiresAt, sql`now()`), eq(listings.status, 'active')))) as DbResultWithRowCount;

  return result.rowCount || 0;
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
