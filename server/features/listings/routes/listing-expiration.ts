/**
 * Listing Expiration & Reactivation Routes
 * Handles listing lifecycle: active → expired → reactivation
 */

import type { Express, Request, Response } from 'express';
import {
  getAdminSettings,
  isListingVisible,
  isInGracePeriod,
  getGracePeriodEndDate,
  calculatePriceWithDiscount,
} from '../../admin/services/admin-settings';
import { getActiveListing } from '../services/listings';
import { parseJsonArrayField } from '../../../shared/utils/json-fields';

export function registerListingExpirationRoutes(app: Express) {
  /**
   * GET /api/listings/:listingId/status
   * Get listing expiration status
   */
  app.get('/api/listings/:listingId/status', async (req: Request, res: Response) => {
    try {
      const { listingId } = req.params;

      // TODO: Fetch listing from database
      // For now, return mock data structure

      const mockListing = {
        id: listingId,
        title: 'Sample Listing',
        isPaid: true,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        durationDays: 45,
      };

      const isVisible = await isListingVisible(mockListing.expiresAt, mockListing.isActive);
      const inGracePeriod = await isInGracePeriod(mockListing.expiresAt);
      const gracePeriodEnd = await getGracePeriodEndDate(mockListing.expiresAt);

      const now = new Date();
      const daysRemaining = Math.ceil(
        (mockListing.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      return res.json({
        success: true,
        listing: {
          id: mockListing.id,
          title: mockListing.title,
          status: {
            isActive: mockListing.isActive,
            isVisible,
            isExpired: !isVisible && mockListing.expiresAt < now,
            inGracePeriod,
            daysRemaining: Math.max(daysRemaining, 0),
          },
          dates: {
            expiresAt: mockListing.expiresAt,
            gracePeriodEnds: gracePeriodEnd,
          },
        },
      });
    } catch (error) {
      console.error('[Listing Expiration] Error fetching listing status:', error);
      res.status(500).json({ error: 'Failed to fetch listing status' });
    }
  });

  /**
   * POST /api/listings/:listingId/deactivate
   * Manually deactivate a listing (seller or admin)
   */
  app.post('/api/listings/:listingId/deactivate', async (req: Request, res: Response) => {
    try {
      const { listingId } = req.params;
      // const userId = req.user?.id;

      // TODO: Verify ownership/admin rights

      // TODO: Update listing in database
      // await db.update(listings)
      //   .set({ isActive: false })
      //   .where(eq(listings.id, listingId));

      return res.json({
        success: true,
        message: 'Listing deactivated successfully',
        listingId,
      });
    } catch (error) {
      console.error('[Listing Expiration] Error deactivating listing:', error);
      res.status(500).json({ error: 'Failed to deactivate listing' });
    }
  });

  /**
   * POST /api/listings/:listingId/check-expiration
   * Check and auto-deactivate if expired (can be called by cron job)
   */
  app.post('/api/listings/:listingId/check-expiration', async (req: Request, res: Response) => {
    try {
      const { listingId } = req.params;

      // TODO: Fetch listing
      // TODO: Check expiration
      // TODO: Auto-deactivate if needed and configured

      const settings = await getAdminSettings();

      return res.json({
        success: true,
        message: 'Listing expiration checked',
        listingId,
        autoDeactivateEnabled: settings.autoDeactivateOnExpiry,
      });
    } catch (error) {
      console.error('[Listing Expiration] Error checking expiration:', error);
      res.status(500).json({ error: 'Failed to check expiration' });
    }
  });

  /**
   * POST /api/listings/:listingId/reactivate
   * Reactivate an expired or manually deactivated listing
   * Body: { duration: 15 | 45 | 90 | 180 }
   */
  app.post('/api/listings/:listingId/reactivate', async (req: Request, res: Response) => {
    try {
      const { listingId } = req.params;
      const { duration } = req.body;
      // const userId = req.user?.id;

      // Validate duration
      if (!duration || ![15, 45, 90, 180].includes(duration)) {
        return res.status(400).json({
          error: 'Invalid duration. Must be 15, 45, 90, or 180 days',
        });
      }

      const settings = await getAdminSettings();

      // Check if reactivation is allowed
      if (!settings.allowReactivation) {
        return res.status(403).json({
          error: 'Reactivation is not allowed by admin',
        });
      }

      // TODO: Fetch listing from database
      const mockListing = {
        id: listingId,
        userId: 'user-1',
        price: 75000,
        title: 'Sample Listing',
      };

      // TODO: Verify ownership

      // Get current pricing
      const durations: Record<number, string> = {
        15: settings.imageDuration15Days ?? '1485',
        45: settings.imageDuration45Days ?? '4455',
        90: settings.imageDuration90Days ?? '8910',
        180: settings.imageDuration180Days ?? '17820',
      };

      const baseFee = parseFloat(durations[duration] || '0');

      // Apply reactivation price multiplier
      const reactivationPrice = baseFee * parseFloat(settings.reactivationPricingMultiplier ?? '1');

      // Apply discount if configured
      const priceWithDiscount = await calculatePriceWithDiscount(
        reactivationPrice,
        duration as 15 | 45 | 90 | 180
      );

      return res.json({
        success: true,
        message: 'Reactivation initiated',
        reactivation: {
          listingId,
          title: mockListing.title,
          duration,
          originalPrice: baseFee,
          reactivationMultiplier: parseFloat(settings.reactivationPricingMultiplier ?? '1'),
          pricing: {
            basePrice: priceWithDiscount.basePrice,
            discount: priceWithDiscount.discount,
            discountPercent: priceWithDiscount.discountPercent,
            finalPrice: priceWithDiscount.finalPrice,
          },
          nextStep: 'Proceed to payment to reactivate listing',
        },
      });
    } catch (error) {
      console.error('[Listing Reactivation] Error reactivating listing:', error);
      res.status(500).json({ error: 'Failed to reactivate listing' });
    }
  });

  /**
   * GET /api/listings/user/:userId/expiring-soon
   * Get listings expiring in next N days (for user notification)
   * Query: ?daysWindow=7
   */
  app.get('/api/listings/user/:userId/expiring-soon', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { daysWindow = 7 } = req.query;

      // TODO: Fetch listings expiring within the window
      // SELECT * FROM listings
      // WHERE seller_id = ? AND is_paid = true
      // AND expires_at BETWEEN NOW() AND NOW() + interval '? days'
      // ORDER BY expires_at ASC

      const mockResults: any[] = [];

      return res.json({
        success: true,
        userId,
        daysWindow: parseInt(daysWindow as string),
        expiringListings: mockResults,
        message: mockResults.length === 0 ? 'No listings expiring soon' : undefined,
      });
    } catch (error) {
      console.error('[Listings] Error fetching expiring listings:', error);
      res.status(500).json({ error: 'Failed to fetch expiring listings' });
    }
  });

  /**
   * POST /api/cron/check-and-deactivate-expired
   * Cron job: Check all listings and deactivate expired ones
   * Should be called from a cron service (e.g., once per hour)
   */
  app.post('/api/cron/check-and-deactivate-expired', async (req: Request, res: Response) => {
    try {
      // TODO: Verify cron job secret/token in headers

      const settings = await getAdminSettings();

      if (!settings.autoDeactivateOnExpiry) {
        return res.json({
          success: true,
          message: 'Auto-deactivation disabled in settings',
          updated: 0,
        });
      }

      // TODO: Run cron logic
      // const updated = await db
      //   .update(listings)
      //   .set({ isActive: false })
      //   .where(
      //     and(
      //       eq(listings.isPaid, true),
      //       lt(listings.expiresAt, new Date()),
      //       eq(listings.isActive, true)
      //     )
      //   );

      console.log('[Cron] Checked and deactivated expired listings');

      return res.json({
        success: true,
        message: 'Cron job completed',
        updated: 0, // TODO: return actual count
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[Cron] Error in expiration check:', error);
      res.status(500).json({ error: 'Cron job failed' });
    }
  });

  console.log('[Routes] Listing expiration routes registered');
}
