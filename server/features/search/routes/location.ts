import type { Express, Request, Response } from 'express';
import { and, desc, eq, ilike, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings, locationIndex } from '../../admin/models/admin-settings';
import { geolocationService } from '../services/geolocation';
import {
  type LocationMetrics,
  calculateDistance,
  computeDemandScore,
  ensureLocationIndexAvailable,
  getLocationByPincode,
  getMetricsForPincode,
  searchLocationRecords,
  toLocationRecord,
  toNumber,
} from '../services/location';

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
            ? and(ilike(locationIndex.city, city), ilike(locationIndex.state, state))
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
        .where(
          and(
            eq(listings.isActive, true),
            eq(listings.status, 'active'),
            isNotNull(listings.pincode)
          )
        )
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
        .where(
          and(ilike(locationIndex.city, String(city)), ilike(locationIndex.state, String(state)))
        )
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
