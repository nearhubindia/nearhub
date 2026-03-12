/**
 * Elasticsearch Search Routes
 * Full-text search endpoints for listings
 */

import type { Express, Request, Response } from 'express';
import {
  searchListings as elasticsearchSearch,
  getSearchSuggestions,
  getIndexStats,
  isElasticsearchHealthy,
  syncAllListings,
} from '../services/elasticsearch';
import { getActiveListing } from '../../listings/services/listings';

type SearchFilterInput = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  listingType?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
};

async function searchListingsFallback(
  query: string,
  filters: SearchFilterInput,
  limit: number,
  offset: number
) {
  const pool = await getActiveListing({
    category: filters.category,
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm: filters.radiusKm,
    // Fetch a bounded pool, then apply text/price filters in memory.
    limit: Math.min(limit + offset + 300, 500),
    offset: 0,
  });

  const q = query.trim().toLowerCase();
  const filtered = pool.filter((listing) => {
    const text = [listing.title, listing.description, listing.category, listing.location]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');
    if (q && !text.includes(q)) return false;

    const conditionValue = String(listing.condition || '').toLowerCase();
    if (filters.condition && conditionValue !== filters.condition.toLowerCase()) return false;

    const listingTypeValue = String((listing as any).listingType || '').toLowerCase();
    if (filters.listingType && listingTypeValue !== filters.listingType.toLowerCase()) return false;

    const numericPrice =
      typeof listing.price === 'string' ? parseFloat(listing.price) : Number(listing.price);
    if (!Number.isFinite(numericPrice)) return false;
    if (typeof filters.minPrice === 'number' && numericPrice < filters.minPrice) return false;
    if (typeof filters.maxPrice === 'number' && numericPrice > filters.maxPrice) return false;

    return true;
  });

  const page = filtered.slice(offset, offset + limit);
  return {
    success: true,
    data: {
      listings: page,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + page.length < filtered.length,
    },
    source: 'database-fallback',
  };
}

async function getSearchSuggestionsFallback(query: string, limit: number): Promise<string[]> {
  const pool = await getActiveListing({ limit: 200, offset: 0 });
  const q = query.trim().toLowerCase();
  const terms = new Set<string>();

  for (const listing of pool) {
    const candidates = [listing.title, listing.category, listing.location]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    for (const candidate of candidates) {
      if (candidate.toLowerCase().includes(q)) {
        terms.add(candidate);
      }
      if (terms.size >= limit) break;
    }
    if (terms.size >= limit) break;
  }

  return [...terms].slice(0, limit);
}

export function registerSearchRoutes(app: Express) {
  /**
   * GET /api/search
   * Full-text search across listings
   * Query params:
   *   - q: search query (required)
   *   - category: filter by category (optional)
   *   - minPrice: minimum price (optional)
   *   - maxPrice: maximum price (optional)
   *   - condition: listing condition (optional)
   *   - type: listing type - "image" or "video" (optional)
   *   - limit: max results (default: 50, max: 500)
   *   - offset: pagination offset (default: 0)
   */
  app.get('/api/search', async (req: Request, res: Response) => {
    try {
      const {
        q,
        category,
        minPrice,
        maxPrice,
        condition,
        type,
        latitude,
        longitude,
        radius,
        limit = '50',
        offset = '0',
      } = req.query;

      // Validate required parameters
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Search query (q) is required',
        });
      }

      // Parse and validate pagination
      let limitNum = parseInt(limit as string, 10);
      let offsetNum = parseInt(offset as string, 10);

      if (isNaN(limitNum) || limitNum < 1) limitNum = 50;
      if (limitNum > 500) limitNum = 500;
      if (isNaN(offsetNum) || offsetNum < 0) offsetNum = 0;

      // Parse price filters
      const minPriceNum = minPrice ? parseFloat(minPrice as string) : undefined;
      const maxPriceNum = maxPrice ? parseFloat(maxPrice as string) : undefined;

      // Parse geo filters
      const latNum = latitude ? parseFloat(latitude as string) : undefined;
      const lonNum = longitude ? parseFloat(longitude as string) : undefined;
      const radiusNum = radius ? parseFloat(radius as string) : undefined;

      const filters = {
        category: category ? (category as string) : undefined,
        condition: condition ? (condition as string) : undefined,
        listingType: type ? (type as string) : undefined,
        minPrice: !isNaN(minPriceNum!) ? minPriceNum : undefined,
        maxPrice: !isNaN(maxPriceNum!) ? maxPriceNum : undefined,
        latitude: !isNaN(latNum!) ? latNum : undefined,
        longitude: !isNaN(lonNum!) ? lonNum : undefined,
        radiusKm: !isNaN(radiusNum!) ? radiusNum : undefined,
      };

      console.log('[Search Route] Searching:', {
        query: q,
        ...filters,
        limit: limitNum,
        offset: offsetNum,
      });

      let results;
      if (isElasticsearchHealthy()) {
        results = await elasticsearchSearch(q as string, filters, limitNum, offsetNum);
        if (!results.success) {
          results = await searchListingsFallback(q as string, filters, limitNum, offsetNum);
        }
      } else {
        results = await searchListingsFallback(q as string, filters, limitNum, offsetNum);
      }

      return res.json(results);
    } catch (error) {
      console.error('[Search Route] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Search request failed',
      });
    }
  });

  /**
   * GET /api/search/suggestions
   * Get search suggestions/autocomplete
   * Query params:
   *   - q: partial query (required)
   *   - limit: max suggestions (default: 10, max: 20)
   */
  app.get('/api/search/suggestions', async (req: Request, res: Response) => {
    try {
      const { q, limit = '10' } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Query (q) is required',
        });
      }

      let limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1) limitNum = 10;
      if (limitNum > 20) limitNum = 20;

      const suggestions = isElasticsearchHealthy()
        ? await getSearchSuggestions(q as string, limitNum)
        : await getSearchSuggestionsFallback(q as string, limitNum);

      return res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      console.error('[Search Suggestions] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get suggestions',
      });
    }
  });

  /**
   * GET /api/admin/search/stats
   * Get search index statistics (admin only)
   */
  app.get('/api/admin/search/stats', async (req: Request, res: Response) => {
    try {
      const stats = await getIndexStats();

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[Search Stats] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get search stats',
      });
    }
  });

  /**
   * POST /api/admin/search/sync
   * Sync all listings to Elasticsearch (admin only)
   */
  app.post('/api/admin/search/sync', async (req: Request, res: Response) => {
    try {
      if (!isElasticsearchHealthy()) {
        return res.status(503).json({
          success: false,
          error: 'Elasticsearch is not available',
        });
      }

      console.log('[Search Sync] Starting full sync...');
      const result = await syncAllListings();

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[Search Sync] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Sync failed',
      });
    }
  });
}
