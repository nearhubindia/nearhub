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
        sellerId: 'seller-1',
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

      let baseFee = parseFloat(durations[duration] || '0');

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
   * GET /api/listings/search
   * Search active listings (filters expired listings automatically)
   * Query: ?category=electronics&location=mumbai&minPrice=1000&maxPrice=100000
   */
  app.get('/api/listings/search', async (req: Request, res: Response) => {
    try {
      const { category, location, minPrice, maxPrice } = req.query;

      const settings = await getAdminSettings();

      // TODO: Build query with filters
      // Query should include:
      // - is_active = true
      // - If hideFromSearchOnExpiry is true:
      //     (is_paid = false) OR (is_paid = true AND expires_at > NOW())

      // Mock results
      const mockResults = [
        {
          id: 'list-1',
          title: 'Active Listing',
          price: 50000,
          category: 'Electronics',
          isPaid: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        {
          id: 'list-2',
          title: 'Free Listing',
          price: 2000,
          category: 'Fashion',
          isPaid: false,
          isActive: true,
        },
      ];

      return res.json({
        success: true,
        config: {
          hideExpiredFromSearch: settings.hideFromSearchOnExpiry,
          resultsCount: mockResults.length,
        },
        results: mockResults,
      });
    } catch (error) {
      console.error('[Listings Search] Error searching listings:', error);
      res.status(500).json({ error: 'Failed to search listings' });
    }
  });

  /**
   * GET /api/shorts
   * Get active shorts (video listings with geo-filtering)
   * Query: ?limit=10&offset=0&latitude=12.34&longitude=56.78&radius=50
   */
  app.get('/api/shorts', async (req: Request, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || '10');
      const offset = parseInt((req.query.offset as string) || '0');
      const latitude = req.query.latitude ? parseFloat(req.query.latitude as string) : undefined;
      const longitude = req.query.longitude ? parseFloat(req.query.longitude as string) : undefined;
      const radiusKm = req.query.radius ? parseFloat(req.query.radius as string) : undefined;

      const settings = await getAdminSettings();

      // Get active video listings with geo-filtering
      const videoListings = await getActiveListing({
        limit: limit * 2, // Fetch more to account for filtering
        offset,
        latitude,
        longitude,
        radiusKm,
      });

      // Filter for listings with videos only
      const shortsListings = videoListings.filter((listing) => {
        const videos = Array.isArray(listing.videos) 
          ? listing.videos 
          : JSON.parse(listing.videos || '[]');
        return videos.length > 0;
      }).slice(0, limit); // Limit to requested count

      return res.json({
        success: true,
        data: shortsListings.map((listing) => ({
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          price: listing.price,
          location: listing.location,
          videos: Array.isArray(listing.videos) ? listing.videos : JSON.parse(listing.videos || '[]'),
          images: Array.isArray(listing.images) ? listing.images : JSON.parse(listing.images || '[]'),
          sellerId: listing.sellerId,
          createdAt: listing.createdAt,
          latitude: listing.latitude,
          longitude: listing.longitude,
        })),
        config: {
          hideExpiredFromShorts: settings.hideFromShortsOnExpiry,
          geoFiltering: latitude !== undefined && longitude !== undefined ? {
            latitude,
            longitude,
            radius: radiusKm,
          } : null,
        },
        pagination: {
          limit,
          offset,
          total: shortsListings.length,
        },
      });
    } catch (error) {
      console.error('[Shorts] Error fetching shorts:', error);
      res.status(500).json({ error: 'Failed to fetch shorts' });
    }
  });

  /**
   * GET /api/listings/seller/:sellerId/expiring-soon
   * Get listings expiring in next N days (for seller notification)
   * Query: ?daysWindow=7
   */
  app.get('/api/listings/seller/:sellerId/expiring-soon', async (req: Request, res: Response) => {
    try {
      const { sellerId } = req.params;
      const { daysWindow = 7 } = req.query;

      // TODO: Fetch listings expiring within the window
      // SELECT * FROM listings
      // WHERE seller_id = ? AND is_paid = true
      // AND expires_at BETWEEN NOW() AND NOW() + interval '? days'
      // ORDER BY expires_at ASC

      const mockResults: any[] = [];

      return res.json({
        success: true,
        sellerId,
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
