/**
 * Geo-based Ad Search Service
 * Filters listings by distance from user's location
 * Uses DB-side geo distance calculation for scalability
 */

import { and, asc, desc, eq, gte, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings } from '../../admin/models/admin-settings';
import { getAdminSettings } from '../../admin/services/admin-settings';
import { getActiveListing } from '../../listings/services/listings';
import { parseJsonArrayField } from '../../../shared/utils/json-fields';

type DBListing = typeof listings.$inferSelect;

export interface GeoSearchOptions {
  userLatitude: number;
  userLongitude: number;
  radiusKm?: number;
  category?: string;
  sortBy?: 'distance' | 'date' | 'price';
  limit?: number;
}

export interface SearchResult
  extends Omit<DBListing, 'price' | 'offerPrice' | 'latitude' | 'longitude' | 'images' | 'videos'> {
  userId?: string | null;
  price: number;
  offerPrice?: number;
  latitude?: number;
  longitude?: number;
  images: string[];
  videos: string[];
  distanceKm?: number;
}

function normalizeSort(sortBy: unknown): 'distance' | 'date' | 'price' {
  return sortBy === 'date' || sortBy === 'price' ? sortBy : 'distance';
}

function toPositiveLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function mapListing(listing: DBListing): SearchResult {
  return {
    ...listing,
    userId: listing.sellerId,
    price: Number(listing.price),
    offerPrice:
      listing.offerPrice !== undefined && listing.offerPrice !== null
        ? Number(listing.offerPrice)
        : undefined,
    latitude: listing.latitude ? Number(listing.latitude) : undefined,
    longitude: listing.longitude ? Number(listing.longitude) : undefined,
    images: parseJsonArrayField(listing.images) as string[],
    videos: parseJsonArrayField(listing.videos) as string[],
  };
}

/**
 * Search listings within a geographic radius
 * Returns listings that:
 * 1. Have valid coordinates (pincode detected)
 * 2. Are within the specified radius
 * 3. Match category filter (if provided)
 * Sorted by distance or date
 */
export async function searchListingsByGeo(options: GeoSearchOptions): Promise<SearchResult[]> {
  const { category } = options;
  const sortBy = normalizeSort(options.sortBy);
  const limit = toPositiveLimit(options.limit, 100, 300);

  // Get admin settings for default radius
  const adminSettings = await getAdminSettings();
  const configuredRadius = Number(adminSettings.geoRadiusKm ?? 50);
  const requestedRadius = Number(options.radiusKm);
  const radiusKm =
    Number.isFinite(requestedRadius) && requestedRadius > 0
      ? requestedRadius
      : Number.isFinite(configuredRadius) && configuredRadius > 0
        ? configuredRadius
        : 50;

  // Validate user coordinates
  const userLatitude = Number(options.userLatitude);
  const userLongitude = Number(options.userLongitude);
  if (!Number.isFinite(userLatitude) || !Number.isFinite(userLongitude)) {
    console.error('[GeoSearch] Invalid user coordinates provided');
    return [];
  }
  if (userLatitude < -90 || userLatitude > 90 || userLongitude < -180 || userLongitude > 180) {
    return [];
  }

  const distanceExpression = sql<number>`
    6371 * acos(
      least(
        1,
        greatest(
          -1,
          cos(radians(${userLatitude}))
            * cos(radians(CAST(${listings.latitude} AS double precision)))
            * cos(
              radians(CAST(${listings.longitude} AS double precision))
              - radians(${userLongitude})
            )
            + sin(radians(${userLatitude}))
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

  const conditions = [
    eq(listings.isActive, true),
    eq(listings.status, 'active'),
    or(isNull(listings.expiresAt), gte(listings.expiresAt, sql`now()`)),
    sql`${listings.latitude} IS NOT NULL AND ${listings.longitude} IS NOT NULL`,
    sql`${distanceExpression} <= ${effectiveRadiusExpression}`,
  ];
  if (category) {
    conditions.push(eq(listings.category, category));
  }

  const baseQuery = db
    .select({
      listing: listings,
      distanceKm: distanceExpression,
    })
    .from(listings)
    .where(and(...conditions));

  let rows: Array<{ listing: DBListing; distanceKm: number | string }>;
  if (sortBy === 'distance') {
    rows = await baseQuery.orderBy(asc(distanceExpression), desc(listings.createdAt)).limit(limit);
  } else if (sortBy === 'date') {
    rows = await baseQuery.orderBy(desc(listings.createdAt)).limit(limit);
  } else {
    rows = await baseQuery.orderBy(asc(listings.price), desc(listings.createdAt)).limit(limit);
  }

  return rows.map((row) => {
    const mapped = mapListing(row.listing);
    const numericDistance = Number(row.distanceKm);
    return {
      ...mapped,
      distanceKm: Number.isFinite(numericDistance) ? Number(numericDistance.toFixed(2)) : undefined,
    };
  });
}

/**
 * Search listings by category (DB-only)
 */
export async function searchListingsByCategory(
  category?: string,
  limit: number = 100
): Promise<SearchResult[]> {
  const results = await getActiveListing({
    limit,
    offset: 0,
    category,
  });
  return results.map(mapListing);
}

/**
 * Get listings near a specific location (e.g., for seller's listings)
 */
export async function getListingsNearLocation(
  latitude: number,
  longitude: number,
  radiusKm?: number
): Promise<SearchResult[]> {
  const adminSettings = await getAdminSettings();
  const radius = radiusKm || (adminSettings.geoRadiusKm ?? 50);

  return searchListingsByGeo({
    userLatitude: latitude,
    userLongitude: longitude,
    radiusKm: radius,
  });
}
