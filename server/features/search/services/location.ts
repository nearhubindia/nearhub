import type { Express, Request, Response } from 'express';
import { and, desc, eq, ilike, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings, locationIndex } from '../../admin/models/admin-settings';
import { geolocationService } from './geolocation';

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

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toLocationRecord(row: typeof locationIndex.$inferSelect): LocationRecord {
  return {
    locationName: row.locationName,
    pincode: row.pincode,
    city: row.city,
    state: row.state,
    district: row.district,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    region: row.region,
  };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeDemandScore(totalListings: number, totalViews: number, totalSaves: number): number {
  const baseScore = Math.min((totalListings / 100) * 20, 20);
  const viewsScore = Math.min((totalViews / 10000) * 40, 40);
  const savesScore = Math.min((totalSaves / 1000) * 40, 40);
  return Math.round(baseScore + viewsScore + savesScore);
}

async function getLocationByPincode(pincode: string): Promise<LocationRecord | null> {
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

async function searchLocationRecords(query: string, limit: number): Promise<LocationRecord[]> {
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
    .orderBy(sql`CASE
      WHEN lower(${locationIndex.locationName}) = lower(${exact}) OR lower(${locationIndex.city}) = lower(${exact}) THEN 120
      WHEN lower(${locationIndex.locationName}) LIKE lower(${startsWith}) OR lower(${locationIndex.city}) LIKE lower(${startsWith}) THEN 100
      WHEN lower(${locationIndex.locationName}) LIKE lower(${contains}) OR lower(${locationIndex.city}) LIKE lower(${contains}) THEN 80
      WHEN lower(${locationIndex.district}) LIKE lower(${startsWith}) THEN 60
      WHEN lower(${locationIndex.district}) LIKE lower(${contains}) THEN 40
      ELSE 0
    END DESC`, sql`length(${locationIndex.city}) ASC`)
    .limit(limit);

  return rows.map(toLocationRecord);
}

async function getMetricsForPincode(pincode: string): Promise<Pick<LocationMetrics, 'totalListings' | 'totalViews' | 'avgPrice'>> {
  const result = await db
    .select({
      totalListings: sql<number>`count(*)`,
      totalViews: sql<number>`coalesce(sum(${listings.viewCount}), 0)`,
      avgPrice: sql<number>`coalesce(avg(cast(${listings.price} as numeric)), 0)`,
    })
    .from(listings)
    .where(and(eq(listings.pincode, pincode), eq(listings.isActive, true), eq(listings.status, 'active')))
    .limit(1);

  return {
    totalListings: result.length ? toNumber(result[0].totalListings) : 0,
    totalViews: result.length ? toNumber(result[0].totalViews) : 0,
    avgPrice: result.length ? toNumber(result[0].avgPrice) : 0,
  };
}

async function ensureLocationIndexAvailable(): Promise<void> {
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(locationIndex).limit(1);
  const count = countResult.length ? toNumber(countResult[0].count) : 0;

  if (count === 0) {
    console.warn('[Location] location_index is empty. Run: npm run location:import');
  }
}

/**
 * Register location-based routes with the Express app
 */
export async function registerLocationRoutes(app: Express) {
  console.log('[Location] Initializing location routes (DB-backed index)...');
  await ensureLocationIndexAvailable();

  console.log('[Location] Initializing geolocation service...');
  await geolocationService.initialize();
  if (geolocationService.isInitialized()) {
    console.log(
      `[Location] ✅ Geolocation ready with ${geolocationService.getPolygonCount()} pincode boundaries`
    );
  }

  app.get('/api/location/reverse-geocode', async (req: Request, res: Response) => {
    try {
      const { latitude, longitude } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'latitude and longitude are required',
        });
      }

      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid latitude or longitude. Must be numbers.',
        });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          error: 'Latitude must be -90 to 90, longitude -180 to 180',
        });
      }

      const pincodeResult = await geolocationService.getPincodeByCoordinates(lat, lng);
      if (!pincodeResult) {
        return res.status(404).json({
          success: false,
          error: 'No pincode found for these coordinates',
        });
      }

      const location = await getLocationByPincode(pincodeResult.pincode);
      if (!location) {
        return res.status(404).json({
          success: false,
          error: `Location data not found for pincode: ${pincodeResult.pincode}`,
        });
      }

      return res.json({
        success: true,
        data: {
          ...location,
          matchType: pincodeResult.accuracy,
          originalCoordinates: {
            latitude: lat,
            longitude: lng,
          },
        },
      });
    } catch (error) {
      console.error('[Location] Error reverse geocoding:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to reverse geocode coordinates',
      });
    }
  });

  app.get('/api/location/pincode/:pincode', async (req, res) => {
    try {
      const { pincode } = req.params;

      if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pincode. Please enter a valid 6-digit pincode.',
        });
      }

      const location = await getLocationByPincode(pincode);
      if (!location) {
        return res.status(404).json({
          success: false,
          error: 'Pincode not found in our database.',
        });
      }

      return res.json({
        success: true,
        data: location,
      });
    } catch (error) {
      console.error('[Location] Error looking up pincode:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to lookup pincode',
      });
    }
  });

  app.get('/api/location/cities/search', async (req: Request, res: Response) => {
    try {
      const rawQuery = (req.query.q as string | undefined)?.trim() ?? '';
      if (rawQuery.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query must be at least 2 characters',
        });
      }

      const requestedLimit = Number.parseInt((req.query.limit as string) ?? '10', 10);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(20, requestedLimit))
        : 10;

      const records = await searchLocationRecords(rawQuery, limit);

      return res.json({
        success: true,
        data: records,
      });
    } catch (error) {
      console.error('[Location] Error searching cities:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to search cities',
      });
    }
  });

  app.get('/api/location/city/:city', async (req, res) => {
    try {
      const { city } = req.params;
      const state = String(req.query.state || '').trim();

      if (!city) {
        return res.status(400).json({ error: 'City is required' });
      }

      const locations = await db
        .select()
        .from(locationIndex)
        .where(
          state
            ? and(
                ilike(locationIndex.city, city),
                ilike(locationIndex.state, state)
              )
            : ilike(locationIndex.city, city)
        )
        .limit(1);

      if (!locations.length) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const location = toLocationRecord(locations[0]);
      const metrics = await getMetricsForPincode(location.pincode);
      const demandScore = computeDemandScore(metrics.totalListings, metrics.totalViews, 0);

      return res.json({
        pincode: location.pincode,
        city: location.city,
        state: location.state,
        latitude: location.latitude,
        longitude: location.longitude,
        totalListings: metrics.totalListings,
        totalViews: metrics.totalViews,
        totalSaves: 0,
        avgPrice: metrics.avgPrice,
        demandScore,
      });
    } catch (error) {
      console.error('Error fetching location metrics:', error);
      return res.status(500).json({ error: 'Failed to fetch location metrics' });
    }
  });

  app.get('/api/location/nearby', async (req, res) => {
    try {
      const { latitude, longitude, radius = 50 } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }

      const lat = parseFloat(latitude as string);
      const lon = parseFloat(longitude as string);
      const radiusKm = parseFloat(radius as string);

      if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(radiusKm)) {
        return res.status(400).json({ error: 'Invalid latitude, longitude or radius' });
      }

      const latDelta = radiusKm / 111;
      const lonDelta = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));

      const candidates = await db
        .select()
        .from(locationIndex)
        .where(
          sql`cast(${locationIndex.latitude} as numeric) between ${lat - latDelta} and ${lat + latDelta}
            and cast(${locationIndex.longitude} as numeric) between ${lon - lonDelta} and ${lon + lonDelta}`
        )
        .limit(500);

      const nearby = candidates
        .map((row) => {
          const location = toLocationRecord(row);
          const distance = calculateDistance(lat, lon, location.latitude, location.longitude);
          return { ...location, distanceKm: Number(distance.toFixed(2)) };
        })
        .filter((row) => row.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      return res.json(nearby);
    } catch (error) {
      console.error('Error fetching nearby locations:', error);
      return res.status(500).json({ error: 'Failed to fetch nearby locations' });
    }
  });

  app.get('/api/location/trending', async (req, res) => {
    try {
      const { limit = 5 } = req.query;
      const limitNum = Math.min(parseInt(limit as string, 10) || 5, 20);

      const topPincodes = await db
        .select({
          pincode: listings.pincode,
          totalListings: sql<number>`count(*)`,
          totalViews: sql<number>`coalesce(sum(${listings.viewCount}), 0)`,
          avgPrice: sql<number>`coalesce(avg(cast(${listings.price} as numeric)), 0)`,
        })
        .from(listings)
        .where(and(eq(listings.isActive, true), eq(listings.status, 'active'), isNotNull(listings.pincode)))
        .groupBy(listings.pincode)
        .orderBy(desc(sql`coalesce(sum(${listings.viewCount}), 0)`), desc(sql`count(*)`))
        .limit(limitNum * 2);

      const metrics: LocationMetrics[] = [];

      for (const row of topPincodes) {
        const pincode = row.pincode;
        if (!pincode) {
          continue;
        }

        const location = await getLocationByPincode(pincode);
        if (!location) {
          continue;
        }

        const totalListings = toNumber(row.totalListings);
        const totalViews = toNumber(row.totalViews);
        const totalSaves = 0;

        metrics.push({
          pincode,
          city: location.city,
          state: location.state,
          latitude: location.latitude,
          longitude: location.longitude,
          totalListings,
          totalViews,
          totalSaves,
          avgPrice: toNumber(row.avgPrice),
          demandScore: computeDemandScore(totalListings, totalViews, totalSaves),
        });
      }

      metrics.sort((a, b) => b.demandScore - a.demandScore);
      return res.json(metrics.slice(0, limitNum));
    } catch (error) {
      console.error('Error fetching trending locations:', error);
      return res.status(500).json({ error: 'Failed to fetch trending locations' });
    }
  });

  app.post('/api/location/update-demand', (_req, res) => {
    return res.status(501).json({
      success: false,
      error: 'Demand update endpoint is deprecated. Metrics are now derived from listing data.',
    });
  });

  app.get('/api/location/pricing/dynamic', async (req, res) => {
    try {
      const { city, state } = req.query;

      if (!city || !state) {
        return res.status(400).json({ error: 'City and state are required' });
      }

      const locations = await db
        .select()
        .from(locationIndex)
        .where(and(ilike(locationIndex.city, String(city)), ilike(locationIndex.state, String(state))))
        .limit(1);

      if (!locations.length) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const location = toLocationRecord(locations[0]);
      const metrics = await getMetricsForPincode(location.pincode);
      const demandScore = computeDemandScore(metrics.totalListings, metrics.totalViews, 0);
      const multiplier = 0.8 + (demandScore / 100) * 0.4;

      return res.json({
        city: location.city,
        state: location.state,
        demandScore,
        priceMultiplier: parseFloat(multiplier.toFixed(2)),
        baselinePrice: 199,
        adjustedPrice: Math.round(199 * multiplier),
        explanation:
          demandScore > 85
            ? 'High demand in this location - prices adjusted upward'
            : demandScore < 70
              ? 'Lower demand in this location - lower prices available'
              : 'Standard pricing for this location',
      });
    } catch (error) {
      console.error('Error calculating dynamic pricing:', error);
      return res.status(500).json({ error: 'Failed to calculate dynamic pricing' });
    }
  });
}

export { calculateDistance, ensureLocationIndexAvailable };
