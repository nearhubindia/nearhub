import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings, locationIndex } from '../../admin/models/admin-settings';
import { calculateDistance } from './distance';

export interface LocationMetrics {
  pincode: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  totalListings: number;
  totalViews: number;
  totalSaves: number;
  avgPrice: number;
  demandScore: number;
}

export interface LocationRecord {
  locationName: string;
  pincode: string;
  city: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  region: string;
}

export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeLocationLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';

  const withoutBrackets = raw.replace(/\s*\([^)]*\)\s*/g, ' ');
  const withoutPostalSuffix = withoutBrackets.replace(
    /\b(?:S\s*\.?\s*O|B\s*\.?\s*O|H\s*\.?\s*O)\b\.?/gi,
    ' '
  );

  return withoutPostalSuffix
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^[,.\-\s]+|[,.\-\s]+$/g, '')
    .trim();
}

export function toLocationRecord(row: typeof locationIndex.$inferSelect): LocationRecord {
  const cleanLocationName = sanitizeLocationLabel(row.locationName);
  const cleanCity = sanitizeLocationLabel(row.city);
  return {
    locationName: cleanLocationName || cleanCity || row.locationName,
    pincode: row.pincode,
    city: cleanCity || row.city,
    state: row.state,
    district: row.district,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    region: row.region,
  };
}

export { calculateDistance };

export function computeDemandScore(
  totalListings: number,
  totalViews: number,
  totalSaves: number
): number {
  const baseScore = Math.min((totalListings / 100) * 20, 20);
  const viewsScore = Math.min((totalViews / 10000) * 40, 40);
  const savesScore = Math.min((totalSaves / 1000) * 40, 40);
  return Math.round(baseScore + viewsScore + savesScore);
}

export async function getLocationByPincode(pincode: string): Promise<LocationRecord | null> {
  const rows = await db
    .select()
    .from(locationIndex)
    .where(eq(locationIndex.pincode, pincode))
    .limit(1);

  if (!rows.length) {
    return null;
  }

  return toLocationRecord(rows[0]);
}

export async function searchLocationRecords(
  query: string,
  limit: number
): Promise<LocationRecord[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) {
    return [];
  }

  const exact = cleanQuery;
  const startsWith = `${cleanQuery}%`;
  const contains = `%${cleanQuery}%`;

  const rows = await db
    .select()
    .from(locationIndex)
    .where(
      sql`(
        lower(${locationIndex.locationName}) LIKE lower(${contains})
        OR lower(${locationIndex.city}) LIKE lower(${contains})
        OR lower(${locationIndex.district}) LIKE lower(${contains})
        OR lower(${locationIndex.searchText}) LIKE lower(${contains})
      )`
    )
    .orderBy(
      sql`CASE
      WHEN lower(${locationIndex.locationName}) = lower(${exact}) OR lower(${locationIndex.city}) = lower(${exact}) THEN 120
      WHEN lower(${locationIndex.locationName}) LIKE lower(${startsWith}) OR lower(${locationIndex.city}) LIKE lower(${startsWith}) THEN 100
      WHEN lower(${locationIndex.locationName}) LIKE lower(${contains}) OR lower(${locationIndex.city}) LIKE lower(${contains}) THEN 80
      WHEN lower(${locationIndex.district}) LIKE lower(${startsWith}) THEN 60
      WHEN lower(${locationIndex.district}) LIKE lower(${contains}) THEN 40
      ELSE 0
    END DESC`,
      sql`length(${locationIndex.city}) ASC`
    )
    .limit(limit);

  return rows.map(toLocationRecord);
}

export async function getMetricsForPincode(
  pincode: string
): Promise<Pick<LocationMetrics, 'totalListings' | 'totalViews' | 'avgPrice'>> {
  const result = await db
    .select({
      totalListings: sql<number>`count(*)`,
      totalViews: sql<number>`coalesce(sum(${listings.viewCount}), 0)`,
      avgPrice: sql<number>`coalesce(avg(cast(${listings.price} as numeric)), 0)`,
    })
    .from(listings)
    .where(
      and(eq(listings.pincode, pincode), eq(listings.isActive, true), eq(listings.status, 'active'))
    )
    .limit(1);

  return {
    totalListings: result.length ? toNumber(result[0].totalListings) : 0,
    totalViews: result.length ? toNumber(result[0].totalViews) : 0,
    avgPrice: result.length ? toNumber(result[0].avgPrice) : 0,
  };
}

export async function ensureLocationIndexAvailable(): Promise<void> {
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(locationIndex)
    .limit(1);
  const count = countResult.length ? toNumber(countResult[0].count) : 0;

  if (count === 0) {
    console.warn('[Location] location_index is empty. Run: npm run location:import');
  }
}
