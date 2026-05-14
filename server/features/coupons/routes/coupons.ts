/**
 * Admin Coupon Management Routes
 * Handles coupon creation, validation, and management
 */

import type { Express, Request, Response } from 'express';
import { adminAuthMiddleware } from '../../admin/routes/admin-auth';
import {
  validateCouponCode,
  applyCouponDiscount,
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  getCouponStats,
  deactivateCoupon,
  getRemainingFreeListings,
} from '../services/coupons';
import { createCouponAdminSchema } from '../../admin/models/admin-settings';
import { getRequestUserId } from '../../../lib/request-user';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeOptionalUuid(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return UUID_REGEX.test(trimmed) ? trimmed : undefined;
}

export function registerCouponRoutes(app: Express) {
  /**
   * GET /api/coupons/validate/:code
   * Validate a coupon code (public endpoint)
   * Query params: userId (optional), tierId (optional) - to check plan applicability
   */
  app.get('/api/coupons/validate/:code', async (req: Request, res: Response) => {
    try {
      const code = (req.params.code as string) || '';
      const userId = normalizeOptionalUuid(req.query.userId);
      const tierId = (req.query.tierId as string) || undefined;

      if (!code || code.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Coupon code is required',
        });
      }

      const result = await validateCouponCode(code, userId, tierId);

      return res.json({
        success: result.isValid,
        coupon: result.coupon,
        error: result.error,
      });
    } catch (error) {
      console.error('[Coupons] Error validating coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate coupon',
      });
    }
  });

  /**
   * GET /api/coupons/free-listings/:code
   * Check how many free listings remain for a user on a coupon
   * Query params: userId (required)
   */
  app.get('/api/coupons/free-listings/:code', async (req: Request, res: Response) => {
    try {
      const code = (req.params.code as string) || '';
      const userId = normalizeOptionalUuid(req.query.userId) || getRequestUserId(req);

      if (!code || code.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Coupon code is required',
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
      }

      const result = await getRemainingFreeListings(code, userId);

      if (result.error) {
        return res.json({
          success: false,
          error: result.error,
          remaining: 0,
          total: 0,
          used: 0,
        });
      }

      return res.json({
        success: true,
        remaining: result.remaining,
        total: result.total,
        used: result.used,
        durationDays: result.durationDays,
      });
    } catch (error) {
      console.error('[Coupons] Error checking free listings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check free listings',
      });
    }
  });

  /**
   * GET /api/coupons/calculate-discount
   * Calculate discount for a given coupon code and amount
   * Query params: code, amount, userId (optional), tierId (optional)
   */
  app.get('/api/coupons/calculate-discount', async (req: Request, res: Response) => {
    try {
      const { code, amount, userId, tierId } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Coupon code is required',
        });
      }

      if (!amount || isNaN(parseFloat(amount as string))) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }

      const result = await applyCouponDiscount(
        code,
        parseFloat(amount as string),
        normalizeOptionalUuid(userId),
        tierId as string | undefined
      );

      return res.json(result);
    } catch (error) {
      console.error('[Coupons] Error calculating discount:', error);
      res.status(500).json({
        success: false,
        discountPercentage: 0,
        discountAmount: 0,
        finalAmount: 0,
        error: 'Failed to calculate discount',
      });
    }
  });

  // ============= ADMIN ROUTES =============

  /**
   * GET /api/admin/coupons
   * Get all coupons (admin only)
   */
  app.get('/api/admin/coupons', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const allCoupons = await getAllCoupons();

      const couponsWithStats = await Promise.all(
        allCoupons.map(async (coupon) => {
          const stats = await getCouponStats(coupon.id);
          return {
            ...coupon,
            stats,
          };
        })
      );

      res.json({
        success: true,
        coupons: couponsWithStats,
        total: couponsWithStats.length,
      });
    } catch (error) {
      console.error('[Coupons] Error fetching coupons:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch coupons',
      });
    }
  });

  /**
   * POST /api/admin/coupons
   * Create a new coupon (admin only)
   * Body: { code, discountPercentage, applicableTiers?, maxUsageCount, expiresAt? }
   */
  app.post('/api/admin/coupons', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const {
        code,
        discountPercentage,
        applicableTiers,
        maxUsageCount,
        expiresAt,
        freeListings,
        freeListingDurationDays,
      } = req.body;
      const admin = (req as any).admin;

      // Validate request body
      const validation = createCouponAdminSchema.safeParse({
        code,
        discountPercentage,
        applicableTiers,
        maxUsageCount,
        freeListings,
        freeListingDurationDays,
        expiresAt,
      });

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          errors: validation.error.errors,
        });
      }

      if (!Array.isArray(applicableTiers) || applicableTiers.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one applicable subscription plan is required',
        });
      }

      const result = await createCoupon(
        code,
        discountPercentage,
        applicableTiers,
        maxUsageCount,
        admin.id,
        expiresAt,
        freeListings || 0,
        freeListingDurationDays || 30
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      const stats = await getCouponStats(result.coupon!.id);

      res.status(201).json({
        success: true,
        coupon: {
          ...result.coupon,
          stats,
        },
      });
    } catch (error) {
      console.error('[Coupons] Error creating coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create coupon',
      });
    }
  });

  /**
   * GET /api/admin/coupons/:id
   * Get coupon details (admin only)
   */
  app.get('/api/admin/coupons/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const coupon = await getCouponById(id);
      if (!coupon) {
        return res.status(404).json({
          success: false,
          error: 'Coupon not found',
        });
      }

      const stats = await getCouponStats(id);

      res.json({
        success: true,
        coupon: {
          ...coupon,
          stats,
        },
      });
    } catch (error) {
      console.error('[Coupons] Error fetching coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch coupon',
      });
    }
  });

  /**
   * PATCH /api/admin/coupons/:id
   * Update coupon details (admin only)
   * Body: { discountPercentage?, maxUsageCount?, isActive?, expiresAt? }
   */
  app.patch('/api/admin/coupons/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { discountPercentage, maxUsageCount, isActive, expiresAt, applicableTiers } = req.body;

      const updates: Parameters<typeof updateCoupon>[1] = {};

      if (discountPercentage !== undefined) {
        if (discountPercentage < 0 || discountPercentage > 100) {
          return res.status(400).json({
            success: false,
            error: 'Discount percentage must be between 0 and 100',
          });
        }
        updates.discountPercentage = discountPercentage;
      }

      if (maxUsageCount !== undefined) {
        if (maxUsageCount < 1) {
          return res.status(400).json({
            success: false,
            error: 'Max usage count must be at least 1',
          });
        }
        updates.maxUsageCount = maxUsageCount;
      }

      if (isActive !== undefined) {
        updates.isActive = isActive;
      }

      if (expiresAt !== undefined) {
        updates.expiresAt = expiresAt;
      }

      if (applicableTiers !== undefined) {
        if (!Array.isArray(applicableTiers)) {
          return res.status(400).json({
            success: false,
            error: 'applicableTiers must be an array of tier IDs',
          });
        }
        updates.applicableTiers = applicableTiers as string[];
      }

      const result = await updateCoupon(id, updates);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      const stats = await getCouponStats(id);

      res.json({
        success: true,
        coupon: {
          ...result.coupon,
          stats,
        },
      });
    } catch (error) {
      console.error('[Coupons] Error updating coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update coupon',
      });
    }
  });

  /**
   * DELETE /api/admin/coupons/:id
   * Delete coupon (admin only)
   */
  app.delete('/api/admin/coupons/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const result = await deleteCoupon(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      res.json({
        success: true,
        message: 'Coupon deleted successfully',
      });
    } catch (error) {
      console.error('[Coupons] Error deleting coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete coupon',
      });
    }
  });

  /**
   * POST /api/admin/coupons/:id/deactivate
   * Deactivate coupon (without deleting) (admin only)
   */
  app.post(
    '/api/admin/coupons/:id/deactivate',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;

        const result = await deactivateCoupon(id);

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: result.error,
          });
        }

        const coupon = await getCouponById(id);
        const stats = await getCouponStats(id);

        res.json({
          success: true,
          coupon: {
            ...coupon,
            stats,
          },
        });
      } catch (error) {
        console.error('[Coupons] Error deactivating coupon:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to deactivate coupon',
        });
      }
    }
  );
}
