// Backend service for handling location data and demand metrics
// Pincode database loaded from JSON file (19,559+ Indian pincodes)
// Geolocation using GeoJSON polygon boundaries for reverse geocoding

import type { Express, Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { geolocationService } from './geolocation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

interface CitySearchResult {
  locationName: string;
  pincode: string;
  city: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  region: string;
}

interface PincodeGeoFeature {
  properties?: {
    Pincode?: string;
    Office_Name?: string;
    Division?: string;
    Region?: string;
    Circle?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: number[][][];
  };
}

interface PincodeGeoFeatureCollection {
  features?: PincodeGeoFeature[];
}

function normalizeCityName(rawCity: string): string {
  const inParens = rawCity.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (inParens) {
    return inParens.replace(/\s{2,}/g, ' ').trim();
  }

  return rawCity
    .replace(/\s+(S\.O|B\.O|H\.O|SO|BO|HO)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeLocationName(rawOfficeName: string): string {
  return rawOfficeName
    .replace(/\s+(S\.O|B\.O|H\.O|SO|BO|HO)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function deriveCityName(officeName: string, district: string): string {
  const inParens = officeName.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (inParens) {
    return inParens;
  }

  const normalized = normalizeCityName(officeName);
  if (!normalized) {
    return district;
  }

  return normalized;
}

// Lazy-loaded location data
let SCRUBBED_LOCATIONS: LocationRecord[] = [];
let CITY_SEARCH_INDEX: CitySearchResult[] = [];
let LOCATION_BY_PINCODE = new Map<string, LocationRecord>();
let isDataLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function loadLocationData(): Promise<void> {
  if (isDataLoaded) {
    return;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      console.log('[Location] Loading GeoJSON data (async)...');
      const startTime = Date.now();
      
      const geoJsonPath = path.resolve(__dirname, '../../../data/pincode_geo.geojson');
      
      // Check if file exists (using fs.access for async)
      try {
        await fs.access(geoJsonPath);
      } catch {
        console.warn('[Location] GeoJSON file not found, using empty dataset');
        isDataLoaded = true;
        return;
      }

      const raw = await fs.readFile(geoJsonPath, 'utf-8');
      const source = JSON.parse(raw) as PincodeGeoFeatureCollection;
      const features = Array.isArray(source.features) ? source.features : [];
      const index = new Map<string, LocationRecord>();

      for (const feature of features) {
        const pincode = feature.properties?.Pincode;
        const officeName = feature.properties?.Office_Name;
        if (!pincode || !officeName) {
          continue;
        }

        const district = (feature.properties?.Division || '').trim();
        const city = deriveCityName(officeName, district);
        const locationName = normalizeLocationName(officeName);
        if (!city) {
          continue;
        }

        const state = (feature.properties?.Circle || '').trim();
        const region = (feature.properties?.Region || '').trim();

        const ring = feature.geometry?.coordinates?.[0];
        if (!ring || ring.length === 0) {
          continue;
        }

        let minLon = Number.POSITIVE_INFINITY;
        let maxLon = Number.NEGATIVE_INFINITY;
        let minLat = Number.POSITIVE_INFINITY;
        let maxLat = Number.NEGATIVE_INFINITY;

        for (const pair of ring) {
          const lon = pair[0];
          const lat = pair[1];
          if (typeof lon !== 'number' || typeof lat !== 'number') {
            continue;
          }
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }

        if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) {
          continue;
        }

        const latitude = (minLat + maxLat) / 2;
        const longitude = (minLon + maxLon) / 2;
        const key = `${city.toLowerCase()}|${state.toLowerCase()}`;

        if (!index.has(key)) {
          index.set(key, {
            locationName,
            pincode,
            city,
            state,
            district,
            latitude,
            longitude,
            region,
          });
        }
      }

      SCRUBBED_LOCATIONS = Array.from(index.values());
      CITY_SEARCH_INDEX = SCRUBBED_LOCATIONS.map((location) => ({
        locationName: location.locationName,
        pincode: location.pincode,
        city: location.city,
        state: location.state,
        district: location.district,
        latitude: location.latitude,
        longitude: location.longitude,
        region: location.region,
      }));
      LOCATION_BY_PINCODE = new Map(
        SCRUBBED_LOCATIONS.map((location) => [location.pincode, location])
      );

      isDataLoaded = true;
      const loadTime = Date.now() - startTime;
      console.log(`[Location] ✅ Loaded ${SCRUBBED_LOCATIONS.length} locations in ${loadTime}ms (async)`);
    } catch (error) {
      console.error('[Location] Failed to load GeoJSON data:', error);
      isDataLoaded = true; // Mark as loaded to prevent infinite retries
    }
  })();

  return loadingPromise;
}

// In-memory cache of location metrics (could be replaced with database)
let locationMetrics: Map<string, LocationMetrics> = new Map();

// Initialize with demo data
export function initializeLocationData() {
  const demoData: LocationMetrics[] = [
    {
      pincode: '500001',
      city: 'Hyderabad',
      state: 'Telangana',
      latitude: 17.385,
      longitude: 78.4867,
      totalListings: 1250,
      totalViews: 45000,
      totalSaves: 3200,
      avgPrice: 45000,
      demandScore: 85,
    },
    {
      pincode: '400001',
      city: 'Mumbai',
      state: 'Maharashtra',
      latitude: 19.076,
      longitude: 72.8777,
      totalListings: 3450,
      totalViews: 125000,
      totalSaves: 8900,
      avgPrice: 75000,
      demandScore: 95,
    },
    {
      pincode: '560001',
      city: 'Bangalore',
      state: 'Karnataka',
      latitude: 12.9716,
      longitude: 77.5946,
      totalListings: 2800,
      totalViews: 98000,
      totalSaves: 6500,
      avgPrice: 65000,
      demandScore: 92,
    },
    {
      pincode: '700001',
      city: 'Kolkata',
      state: 'West Bengal',
      latitude: 22.5726,
      longitude: 88.3639,
      totalListings: 1100,
      totalViews: 38000,
      totalSaves: 2400,
      avgPrice: 38000,
      demandScore: 72,
    },
    {
      pincode: '110001',
      city: 'Delhi',
      state: 'Delhi',
      latitude: 28.7041,
      longitude: 77.1025,
      totalListings: 2200,
      totalViews: 87000,
      totalSaves: 5800,
      avgPrice: 55000,
      demandScore: 88,
    },
  ];

  demoData.forEach((data) => {
    locationMetrics.set(`${data.city}-${data.state}`, data);
  });
}

/**
 * Register location-based routes with the Express app
 */
export async function registerLocationRoutes(app: Express) {
  // Load location data asynchronously
  console.log('[Location] Initializing location data...');
  await loadLocationData();
  
  // Initialize demo data
  initializeLocationData();

  // Initialize geolocation service for reverse geocoding
  console.log('[Location] Initializing geolocation service...');
  await geolocationService.initialize();
  if (geolocationService.isInitialized()) {
    console.log(
      `[Location] ✅ Geolocation ready with ${geolocationService.getPolygonCount()} pincode boundaries`
    );
  }

  /**
   * GET /api/location/reverse-geocode
   * Reverse geocode coordinates to find pincode and location details
   * Query params: latitude, longitude
   */
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

      // Use geolocation service to find pincode from coordinates
      const result = await geolocationService.getPincodeByCoordinates(lat, lng);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'No pincode found for these coordinates',
        });
      }

      const location = LOCATION_BY_PINCODE.get(result.pincode);

      if (!location) {
        return res.status(404).json({
          success: false,
          error: 'Location data not found for pincode: ' + result.pincode,
        });
      }

      return res.json({
        success: true,
        data: {
          pincode: location.pincode,
          locationName: location.locationName,
          city: location.city,
          state: location.state,
          district: location.district,
          latitude: location.latitude,
          longitude: location.longitude,
          region: location.region,
          matchType: result.accuracy, // 'exact' or 'approximate'
          originalCoordinates: {
            latitude: lat,
            longitude: lng,
          },
        },
      });
    } catch (error) {
      console.error('[Location] Error reverse geocoding:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reverse geocode coordinates',
      });
    }
  });

  /**
   * GET /api/location/pincode/:pincode
   * Lookup location details by pincode
   */
  app.get('/api/location/pincode/:pincode', async (req, res) => {
    try {
      await loadLocationData(); // Ensure data is loaded
      
      const { pincode } = req.params;

      if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pincode. Please enter a valid 6-digit pincode.',
        });
      }

      const location = LOCATION_BY_PINCODE.get(pincode);

      if (!location) {
        return res.status(404).json({
          success: false,
          error: 'Pincode not found in our database. Coverage includes major Indian cities.',
        });
      }

      return res.json({
        success: true,
        data: {
          pincode: location.pincode,
          locationName: location.locationName,
          city: location.city,
          state: location.state,
          district: location.district,
          latitude: location.latitude,
          longitude: location.longitude,
          region: location.region,
        },
      });
    } catch (error) {
      console.error('[Location] Error looking up pincode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to lookup pincode',
      });
    }
  });

  /**
   * GET /api/location/cities/search
   * Query params: q (min 2 chars), limit (optional, max 20)
   */
  app.get('/api/location/cities/search', async (req: Request, res: Response) => {
    try {
      await loadLocationData(); // Ensure data is loaded
      
      const rawQuery = (req.query.q as string | undefined)?.trim() ?? '';
      const query = rawQuery.toLowerCase();

      if (query.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query must be at least 2 characters',
        });
      }

      const requestedLimit = Number.parseInt((req.query.limit as string) ?? '10', 10);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(20, requestedLimit))
        : 10;

      const ranked = CITY_SEARCH_INDEX.map((city) => {
        const locationNameLower = city.locationName.toLowerCase();
        const cityLower = city.city.toLowerCase();
        const districtLower = city.district.toLowerCase();

        let score = 0;
        if (locationNameLower === query || cityLower === query) {
          score = 120;
        } else if (locationNameLower.startsWith(query) || cityLower.startsWith(query)) {
          score = 100;
        } else if (locationNameLower.includes(query) || cityLower.includes(query)) {
          score = 80;
        } else if (districtLower.startsWith(query)) {
          score = 60;
        } else if (districtLower.includes(query)) {
          score = 40;
        }

        return { city, score };
      })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return a.city.city.length - b.city.city.length;
        })
        .slice(0, limit)
        .map((entry) => entry.city);

      return res.json({
        success: true,
        data: ranked,
      });
    } catch (error) {
      console.error('[Location] Error searching cities:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to search cities',
      });
    }
  });

  /**
   * GET /api/location/city/:city
   * Get location metrics for a specific city
   */
  app.get('/api/location/city/:city', (req, res) => {
    try {
      const { city } = req.params;
      const state = req.query.state as string;

      if (!city) {
        return res.status(400).json({ error: 'City is required' });
      }

      const key = state ? `${city}-${state}` : city;
      const metrics = locationMetrics.get(key);

      if (!metrics) {
        return res.status(404).json({ error: 'Location not found' });
      }

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching location metrics:', error);
      res.status(500).json({ error: 'Failed to fetch location metrics' });
    }
  });

  /**
   * GET /api/location/nearby
   * Find cities near given coordinates
   * Query params: latitude, longitude, radius (km)
   */
  app.get('/api/location/nearby', (req, res) => {
    try {
      const { latitude, longitude, radius = 50 } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }

      const lat = parseFloat(latitude as string);
      const lon = parseFloat(longitude as string);
      const radiusKm = parseFloat(radius as string);

      const nearby: LocationMetrics[] = [];

      for (const metrics of locationMetrics.values()) {
        const distance = calculateDistance(lat, lon, metrics.latitude, metrics.longitude);
        if (distance <= radiusKm) {
          nearby.push(metrics);
        }
      }

      // Sort by distance
      nearby.sort(
        (a, b) =>
          calculateDistance(lat, lon, a.latitude, a.longitude) -
          calculateDistance(lat, lon, b.latitude, b.longitude)
      );

      res.json(nearby);
    } catch (error) {
      console.error('Error fetching nearby locations:', error);
      res.status(500).json({ error: 'Failed to fetch nearby locations' });
    }
  });

  /**
   * GET /api/location/trending
   * Get top trending cities by demand score
   * Query params: limit (default: 5)
   */
  app.get('/api/location/trending', (req, res) => {
    try {
      const { limit = 5 } = req.query;
      const limitNum = Math.min(parseInt(limit as string) || 5, 20);

      const sorted = Array.from(locationMetrics.values())
        .sort((a, b) => b.demandScore - a.demandScore)
        .slice(0, limitNum);

      res.json(sorted);
    } catch (error) {
      console.error('Error fetching trending locations:', error);
      res.status(500).json({ error: 'Failed to fetch trending locations' });
    }
  });

  /**
   * POST /api/location/update-demand
   * Update demand metrics for a location (called after listing activity)
   */
  app.post('/api/location/update-demand', (req, res) => {
    try {
      const { city, state, views = 0, saves = 0, pricePoint = 0 } = req.body;

      if (!city || !state) {
        return res.status(400).json({ error: 'City and state are required' });
      }

      const key = `${city}-${state}`;
      const metrics = locationMetrics.get(key);

      if (!metrics) {
        return res.status(404).json({ error: 'Location not found' });
      }

      // Update metrics
      metrics.totalViews += views;
      metrics.totalSaves += saves;

      if (pricePoint > 0) {
        metrics.avgPrice = (metrics.avgPrice + pricePoint) / 2; // Simple average
      }

      // Recalculate demand score
      // Based on: listings (20%), views (40%), saves (40%)
      const baseScore = Math.min((metrics.totalListings / 100) * 20, 20);
      const viewsScore = Math.min((metrics.totalViews / 10000) * 40, 40);
      const savesScore = Math.min((metrics.totalSaves / 1000) * 40, 40);
      metrics.demandScore = Math.round(baseScore + viewsScore + savesScore);

      res.json(metrics);
    } catch (error) {
      console.error('Error updating demand metrics:', error);
      res.status(500).json({ error: 'Failed to update demand metrics' });
    }
  });

  /**
   * GET /api/pricing/dynamic
   * Get dynamic price multiplier for a location
   * Based on demand (0.8 to 1.2)
   */
  app.get('/api/pricing/dynamic', (req, res) => {
    try {
      const { city, state } = req.query;

      if (!city || !state) {
        return res.status(400).json({ error: 'City and state are required' });
      }

      const key = `${city}-${state}`;
      const metrics = locationMetrics.get(key);

      if (!metrics) {
        return res.status(404).json({ error: 'Location not found' });
      }

      // Multiplier based on demand score (50-100 score → 0.8-1.2 multiplier)
      const multiplier = 0.8 + (metrics.demandScore / 100) * 0.4;

      res.json({
        city,
        state,
        demandScore: metrics.demandScore,
        priceMultiplier: parseFloat(multiplier.toFixed(2)),
        baselinePrice: 199, // Standard plan base price
        adjustedPrice: Math.round(199 * multiplier),
        explanation:
          metrics.demandScore > 85
            ? 'High demand in this location - prices adjusted upward'
            : metrics.demandScore < 70
              ? 'Lower demand in this location - lower prices available'
              : 'Standard pricing for this location',
      });
    } catch (error) {
      console.error('Error calculating dynamic pricing:', error);
      res.status(500).json({ error: 'Failed to calculate dynamic pricing' });
    }
  });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

export { calculateDistance, loadLocationData };
