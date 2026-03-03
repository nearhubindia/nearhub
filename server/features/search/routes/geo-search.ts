/**
 * Geo-based Search Routes
 * Allows users to search listings by geographic proximity
 */

import type { Express, Request, Response } from 'express';
import {
  searchListingsByGeo,
  searchListingsByCategory,
  type GeoSearchOptions,
} from '../services/geo-search';

export function registerGeoSearchRoutes(app: Express) {
  /**
   * GET /api/search/nearby
   * Search listings within geographic radius
   * Query params:
   *   - latitude: user latitude
   *   - longitude: user longitude
   *   - radiusKm: search radius in km (optional, uses admin setting)
   *   - category: filter by category (optional)
   *   - sortBy: "distance" | "date" | "price" (default: distance)
   *   - limit: max results (default: 100)
   */
  app.get('/api/search/nearby', async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, radiusKm, category, sortBy, limit } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'latitude and longitude are required',
        });
      }

      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      const categoryFilter = category as string | undefined;
      const sortByParam = (sortBy as 'distance' | 'date' | 'price') || 'distance';
      const limitParam = limit ? parseInt(limit as string) : 100;
      const radiusKmParam = radiusKm ? parseInt(radiusKm as string) : undefined;

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid latitude or longitude',
        });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          error: 'Latitude must be -90 to 90, longitude -180 to 180',
        });
      }

      const options: GeoSearchOptions = {
        userLatitude: lat,
        userLongitude: lng,
        radiusKm: radiusKmParam,
        category: categoryFilter,
        sortBy: sortByParam,
        limit: limitParam,
      };

      console.log('[GeoSearch Route] Searching nearby listings:', {
        lat,
        lng,
        radiusKm: radiusKmParam,
        category: categoryFilter,
        sortBy: sortByParam,
        limit: limitParam,
      });

      const listings = await searchListingsByGeo(options);

      return res.json({
        success: true,
        data: {
          listings,
          count: listings.length,
          searchParams: {
            userLatitude: lat,
            userLongitude: lng,
            radiusKm: radiusKmParam || 'default',
            category: categoryFilter || 'all',
            sortBy: sortByParam,
          },
        },
      });
    } catch (error) {
      console.error('[GeoSearch Route] Error searching nearby listings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search listings',
      });
    }
  });

  /**
   * GET /api/search/category
   * Search listings by category (fallback when location not available)
   * Query params:
   *   - category: category name
   *   - limit: max results (default: 100)
   */
  app.get('/api/search/category', async (req: Request, res: Response) => {
    try {
      const { category, limit } = req.query;

      const categoryFilter = category as string | undefined;
      const limitParam = limit ? parseInt(limit as string) : 100;

      console.log('[Search Route] Searching by category:', {
        category: categoryFilter || 'all',
        limit: limitParam,
      });

      const listings = searchListingsByCategory(categoryFilter, limitParam);

      return res.json({
        success: true,
        data: {
          listings,
          count: listings.length,
          searchParams: {
            category: categoryFilter || 'all',
          },
        },
      });
    } catch (error) {
      console.error('[Search Route] Error searching by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search listings',
      });
    }
  });
}
