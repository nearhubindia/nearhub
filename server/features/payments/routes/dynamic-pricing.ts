/**
 * Dynamic Pricing Routes
 * API endpoints for AI-based demand/supply pricing
 */

import type { Express, Request, Response } from 'express';
import {
  calculateDynamicPrice,
  getDemandSupplyMetrics,
  calculateBatchDynamicPrices,
  type ListingType,
  type DemandSupplyMetrics,
} from '../services/dynamic-pricing';

export function registerDynamicPricingRoutes(app: Express) {
  /**
   * GET /api/pricing/dynamic
   * Get dynamic pricing for a specific category and listing type
   * Query params: ?category=electronics&type=image
   */
  app.get('/api/pricing/dynamic', async (req: Request, res: Response) => {
    try {
      const { category, type } = req.query;

      if (!category || !type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: category, type',
        });
      }

      if (type !== 'image' && type !== 'video') {
        return res.status(400).json({
          success: false,
          error: "type must be 'image' or 'video'",
        });
      }

      const listingType = type as ListingType;
      const metrics = await getDemandSupplyMetrics(category as string, listingType);
      const pricing = await calculateDynamicPrice(listingType, metrics);

      return res.json({
        success: true,
        pricing,
        metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Dynamic Pricing] Error calculating price:', error);
      res.status(500).json({ success: false, error: 'Failed to calculate dynamic price' });
    }
  });

  /**
   * POST /api/pricing/dynamic/calculate
   * Calculate dynamic price with custom metrics
   * Body: { listingType, metrics }
   */
  app.post('/api/pricing/dynamic/calculate', async (req: Request, res: Response) => {
    try {
      const { listingType, metrics } = req.body;

      if (!listingType || !metrics) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: listingType, metrics',
        });
      }

      if (listingType !== 'image' && listingType !== 'video') {
        return res.status(400).json({
          success: false,
          error: "listingType must be 'image' or 'video'",
        });
      }

      // Validate metrics
      const requiredFields = [
        'totalActiveListings',
        'newListingsLast7Days',
        'viewsPerListing',
        'conversionRate',
        'seasonalityFactor',
        'categoryDemandScore',
      ];

      for (const field of requiredFields) {
        if (metrics[field] === undefined) {
          return res.status(400).json({
            success: false,
            error: `Missing metric field: ${field}`,
          });
        }
      }

      const pricing = await calculateDynamicPrice(
        listingType as ListingType,
        metrics as DemandSupplyMetrics
      );

      return res.json({
        success: true,
        pricing,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Dynamic Pricing] Error calculating custom price:', error);
      res.status(500).json({ success: false, error: 'Failed to calculate price' });
    }
  });

  /**
   * GET /api/pricing/dynamic/batch
   * Get dynamic pricing for multiple categories
   * Query params: ?categories=electronics,furniture&type=image
   */
  app.get('/api/pricing/dynamic/batch', async (req: Request, res: Response) => {
    try {
      const { categories, type } = req.query;

      if (!categories || !type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: categories, type',
        });
      }

      if (type !== 'image' && type !== 'video') {
        return res.status(400).json({
          success: false,
          error: "type must be 'image' or 'video'",
        });
      }

      const categoryList = (categories as string).split(',').map((c) => c.trim());
      const listingType = type as ListingType;

      const pricingMap = await calculateBatchDynamicPrices(categoryList, listingType);

      // Convert Map to object for JSON response
      const pricingObj: Record<string, any> = {};
      pricingMap.forEach((value, key) => {
        pricingObj[key] = value;
      });

      return res.json({
        success: true,
        pricing: pricingObj,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Dynamic Pricing] Error calculating batch prices:', error);
      res.status(500).json({ success: false, error: 'Failed to calculate batch prices' });
    }
  });

  /**
   * GET /api/pricing/dynamic/preview
   * Preview dynamic pricing for current market conditions
   * Query params: ?type=image
   */
  app.get('/api/pricing/dynamic/preview', async (req: Request, res: Response) => {
    try {
      const { type } = req.query;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: type',
        });
      }

      if (type !== 'image' && type !== 'video') {
        return res.status(400).json({
          success: false,
          error: "type must be 'image' or 'video'",
        });
      }

      const listingType = type as ListingType;

      // Calculate for multiple demand scenarios
      const scenarios = {
        low: {
          totalActiveListings: 1200,
          newListingsLast7Days: 20,
          viewsPerListing: 30,
          conversionRate: 1.5,
          seasonalityFactor: 0.8,
          categoryDemandScore: 30,
        },
        medium: {
          totalActiveListings: 600,
          newListingsLast7Days: 40,
          viewsPerListing: 80,
          conversionRate: 3.5,
          seasonalityFactor: 1.0,
          categoryDemandScore: 60,
        },
        high: {
          totalActiveListings: 200,
          newListingsLast7Days: 60,
          viewsPerListing: 150,
          conversionRate: 6.5,
          seasonalityFactor: 1.3,
          categoryDemandScore: 90,
        },
      };

      const results: Record<string, any> = {};
      for (const [scenario, metrics] of Object.entries(scenarios)) {
        results[scenario] = await calculateDynamicPrice(listingType, metrics);
      }

      return res.json({
        success: true,
        scenarios: results,
        explanation: {
          low: 'Low demand scenario - oversupply, slow growth',
          medium: 'Average market conditions - balanced supply/demand',
          high: 'High demand scenario - limited supply, strong growth',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Dynamic Pricing] Error generating preview:', error);
      res.status(500).json({ success: false, error: 'Failed to generate preview' });
    }
  });

  console.log('[Routes] Dynamic pricing routes registered');
}
