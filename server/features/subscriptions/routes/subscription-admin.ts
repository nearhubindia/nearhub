/**
 * Subscription Plans Management Routes
 * Allows admins to create, update, and delete subscription plans
 */

import type { Express, Request, Response } from 'express';
import {
  getAllPlans,
  getPlansByType,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  clearPlansCache,
  type SubscriptionPlan,
} from '../services/subscription-plans';

export function registerSubscriptionPlansRoutes(app: Express) {
  /**
   * GET /api/plans
   * Get all subscription plans (public endpoint)
   */
  app.get('/api/plans', async (req: Request, res: Response) => {
    try {
      const plans = getAllPlans();
      res.json({
        success: true,
        plans,
      });
    } catch (error) {
      console.error('[Plans] Error fetching plans:', error);
      res.status(500).json({ error: 'Failed to fetch plans' });
    }
  });

  /**
   * GET /api/plans/type/:type
   * Get plans by type (image, video, general)
   */
  app.get('/api/plans/type/:type', async (req: Request, res: Response) => {
    try {
      const type = req.params.type as string;

      if (!['image', 'video', 'general'].includes(type)) {
        return res.status(400).json({ error: 'Invalid plan type' });
      }

      const plans = getPlansByType(type as 'image' | 'video' | 'general');
      res.json({
        success: true,
        type,
        plans,
      });
    } catch (error) {
      console.error('[Plans] Error fetching plans by type:', error);
      res.status(500).json({ error: 'Failed to fetch plans' });
    }
  });

  /**
   * GET /api/plans/:planId
   * Get a specific plan by ID
   */
  app.get('/api/plans/:planId', async (req: Request, res: Response) => {
    try {
      const planId = req.params.planId as string;
      const plan = getPlanById(planId);

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      res.json({
        success: true,
        plan,
      });
    } catch (error) {
      console.error('[Plans] Error fetching plan:', error);
      res.status(500).json({ error: 'Failed to fetch plan' });
    }
  });

  /**
   * POST /api/admin/plans
   * Create a new subscription plan (admin only)
   */
  app.post('/api/admin/plans', async (req: Request, res: Response) => {
    try {
      // TODO: Add authentication check
      // if (!req.user?.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

      const { name, type, price, offerPrice, days, features, highlight } = req.body;

      // Validate required fields
      if (!name || !type || price === undefined || !days || !features) {
        return res.status(400).json({
          error: 'Missing required fields: name, type, price, days, features',
        });
      }

      // Validate type
      if (!['image', 'video', 'general'].includes(type)) {
        return res.status(400).json({ error: 'Invalid plan type' });
      }

      // Validate price and days
      if (price < 0 || days < 1) {
        return res.status(400).json({ error: 'Price must be >= 0 and days must be >= 1' });
      }

      // Validate offerPrice if provided
      if (offerPrice !== undefined && offerPrice >= price) {
        return res.status(400).json({ error: 'Offer price must be less than original price' });
      }

      // Validate features
      const validFeatures = [
        'maxListings',
        'topSearchPlacement',
        'featuredBadge',
        'verifiedBadge',
        'priorityListing',
        'advancedAnalytics',
        'prioritySupport',
        'storageGb',
      ];

      const invalidFeatures = Object.keys(features).filter((f) => !validFeatures.includes(f));
      if (invalidFeatures.length > 0) {
        return res.status(400).json({
          error: `Invalid features: ${invalidFeatures.join(', ')}`,
        });
      }

      const newPlan = createPlan({
        name,
        type,
        price,
        offerPrice,
        days,
        features,
        highlight: highlight || false,
      });

      res.status(201).json({
        success: true,
        plan: newPlan,
      });
    } catch (error) {
      console.error('[Plans] Error creating plan:', error);
      res.status(500).json({ error: 'Failed to create plan' });
    }
  });

  /**
   * PUT /api/admin/plans/:planId
   * Update an existing subscription plan (admin only)
   */
  app.put('/api/admin/plans/:planId', async (req: Request, res: Response) => {
    try {
      // TODO: Add authentication check
      // if (!req.user?.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

      const planId = req.params.planId as string;
      const { name, price, offerPrice, days, features, highlight } = req.body;

      // Validate price and days if provided
      if (price !== undefined && price < 0) {
        return res.status(400).json({ error: 'Price must be >= 0' });
      }

      if (days !== undefined && days < 1) {
        return res.status(400).json({ error: 'Days must be >= 1' });
      }

      // Validate offerPrice if provided
      if (offerPrice !== undefined && price !== undefined && offerPrice >= price) {
        return res.status(400).json({ error: 'Offer price must be less than original price' });
      }

      const updates: Partial<SubscriptionPlan> = {};
      if (name !== undefined) updates.name = name;
      if (price !== undefined) updates.price = price;
      if (offerPrice !== undefined) updates.offerPrice = offerPrice;
      if (days !== undefined) updates.days = days;
      if (features !== undefined) updates.features = features;
      if (highlight !== undefined) updates.highlight = highlight;

      const updatedPlan = updatePlan(planId, updates);

      if (!updatedPlan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      res.json({
        success: true,
        plan: updatedPlan,
      });
    } catch (error) {
      console.error('[Plans] Error updating plan:', error);
      res.status(500).json({ error: 'Failed to update plan' });
    }
  });

  /**
   * DELETE /api/admin/plans/:planId
   * Delete a subscription plan (admin only)
   */
  app.delete('/api/admin/plans/:planId', async (req: Request, res: Response) => {
    try {
      // TODO: Add authentication check
      // if (!req.user?.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

      const planId = req.params.planId as string;

      const deleted = deletePlan(planId);

      if (!deleted) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      res.json({
        success: true,
        message: 'Plan deleted successfully',
      });
    } catch (error) {
      console.error('[Plans] Error deleting plan:', error);
      res.status(500).json({ error: 'Failed to delete plan' });
    }
  });
}
