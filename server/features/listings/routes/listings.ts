import type { Express, Request, Response } from 'express';
import {
  getActiveListing,
  getListingById,
  updateListing,
  deleteListing,
} from '../services/listings';
import {
  trackListingView,
  getListingAnalytics,
  getUserAnalytics,
  getViewMilestones,
} from '../services/analytics';
import {
  notifyViewMilestone,
  notifyAdminListingPendingReview,
} from '../../../shared/services/auto-notifications';

function parseJsonField(value: unknown): unknown[] {
  if (typeof value === 'string') return JSON.parse(value || '[]');
  return (value as unknown[]) || [];
}

function normalizeOwnerId(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[\s-]/g, '').toLowerCase();
}

function hasLocalDeviceUri(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const uri = value.trim().toLowerCase();
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://')
  );
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function registerListingRoutes(app: Express) {
  /**
   * GET /api/listings
   * Query: limit, offset, category, userId, latitude, longitude, radius
   */
  app.get('/api/listings', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
      const category = Array.isArray(req.query.category)
        ? (req.query.category[0] as string)
        : (req.query.category as string | undefined);
      const userId = Array.isArray(req.query.userId)
        ? (req.query.userId[0] as string)
        : (req.query.userId as string | undefined);
      const ownerId = userId;

      // Geo-filtering parameters
      const latitude = req.query.latitude ? parseFloat(req.query.latitude as string) : undefined;
      const longitude = req.query.longitude ? parseFloat(req.query.longitude as string) : undefined;
      const radiusKm = req.query.radius ? parseFloat(req.query.radius as string) : undefined;

      const listings = await getActiveListing({
        limit,
        offset,
        category,
        ownerId,
        latitude,
        longitude,
        radiusKm,
      });

      const priceFilteredListings = listings.filter((listing) => {
        const numericPrice =
          typeof listing.price === 'string' ? parseFloat(listing.price) : Number(listing.price);
        if (Number.isNaN(numericPrice)) return false;
        if (typeof minPrice === 'number' && numericPrice < minPrice) return false;
        if (typeof maxPrice === 'number' && numericPrice > maxPrice) return false;
        return true;
      });

      return res.json({
        success: true,
        data: priceFilteredListings.map((l) => {
          const { sellerId: _sellerId, ...listingWithoutSellerId } = l as any;
          return {
            ...listingWithoutSellerId,
            userId: l.sellerId,
            images: parseJsonField(l.images),
            videos: parseJsonField(l.videos),
          };
        }),
        limit,
        offset,
      });
    } catch (error) {
      console.error('[Listings] Error fetching listings:', error);
      // Log the actual error for debugging
      if (error instanceof Error) {
        console.error('[Listings] Error details:', error.message, error.stack);
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch listings',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      });
    }
  });

  /**
   * GET /api/listings/category/:category
   */
  app.get('/api/listings/category/:category', async (req: Request, res: Response) => {
    try {
      const category = req.params.category as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const listings = await getActiveListing({ limit, offset, category });

      return res.json({
        success: true,
        category,
        listings: listings.map((l) => {
          const { sellerId: _sellerId, ...listingWithoutSellerId } = l as any;
          return {
            ...listingWithoutSellerId,
            userId: l.sellerId,
            images: parseJsonField(l.images),
            videos: parseJsonField(l.videos),
          };
        }),
        pagination: { limit, offset, total: listings.length },
      });
    } catch (error) {
      console.error('[Listings] Error fetching category listings:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch listings' });
    }
  });

  /**
   * POST /api/listings/upload-images
   * Pass-through: returns base64 images as-is
   */
  app.post('/api/listings/upload-images', (req: Request, res: Response) => {
    try {
      const { images } = req.body;
      if (!images || !Array.isArray(images)) {
        return res.status(400).json({ error: 'Images array required' });
      }
      return res.json({
        success: true,
        imageUrls: images,
        message: `Uploaded ${images.length} image(s)`,
      });
    } catch (error) {
      console.error('[Listings] Error uploading images:', error);
      return res.status(500).json({ error: 'Failed to upload images' });
    }
  });

  /**
   * GET /api/listings/:id
   */
  app.get('/api/listings/:id', async (req: Request, res: Response) => {
    try {
      const listing = await getListingById(req.params.id as string);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }
      return res.json({
        success: true,
        listing: (() => {
          const { sellerId: _sellerId, ...listingWithoutSellerId } = listing as any;
          return {
            ...listingWithoutSellerId,
            userId: listing.sellerId,
            images: parseJsonField(listing.images),
            videos: parseJsonField(listing.videos),
          };
        })(),
      });
    } catch (error) {
      console.error('[Listings] Error fetching listing:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch listing' });
    }
  });

  /**
   * PATCH /api/listings/:id
   * Update a listing (only by owner)
   */
  app.patch('/api/listings/:id', async (req: Request, res: Response) => {
    try {
      const listingId = String(req.params.id);
      const userId = (req as any).userId || req.get('x-user-id');

      // Get the listing to check ownership
      const existingListing = await getListingById(listingId);
      if (!existingListing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }

      // Verify seller ownership (unless admin)
      const isOwner = normalizeOwnerId(existingListing.sellerId) === normalizeOwnerId(userId);

      if (!isOwner && !(req as any).isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: You can only edit your own listings',
        });
      }

      // Prevent editing certain fields after approval
      const restrictedFields = ['id', 'userId', 'createdAt', 'viewCount'];
      const sanitizedUpdates = { ...req.body };
      restrictedFields.forEach((field) => delete sanitizedUpdates[field]);

      // If a seller edits an already approved listing, route it back to admin review.
      // Status-only actions (e.g. mark sold) should not trigger re-approval.
      const moderationSensitiveFields = new Set([
        // Re-approval should only happen for core listing media/content changes.
        'images',
        'videos',
      ]);
      const hasModerationSensitiveChanges = Object.keys(sanitizedUpdates).some((field) =>
        moderationSensitiveFields.has(field)
      );
      const currentStatus = normalizeStatus(existingListing.status);
      const isApprovedLiveListing =
        Boolean(existingListing.isActive) &&
        currentStatus !== 'pending' &&
        currentStatus !== 'rejected';
      const shouldReapproveAfterEdit =
        isApprovedLiveListing && !(req as any).isAdmin && hasModerationSensitiveChanges;

      if (shouldReapproveAfterEdit) {
        sanitizedUpdates.status = 'pending';
        sanitizedUpdates.isActive = false;
      }

      if (
        Array.isArray(sanitizedUpdates.images) &&
        sanitizedUpdates.images.some((item: unknown) => hasLocalDeviceUri(item))
      ) {
        return res.status(400).json({
          success: false,
          error:
            'One or more images are local device paths. Please reselect images and upload again.',
          code: 'INVALID_IMAGE_URI',
        });
      }

      if (
        Array.isArray(sanitizedUpdates.videos) &&
        sanitizedUpdates.videos.some((item: unknown) => hasLocalDeviceUri(item))
      ) {
        return res.status(400).json({
          success: false,
          error:
            'One or more videos are local device paths. Please re-upload videos and try again.',
          code: 'INVALID_VIDEO_URI',
        });
      }

      if (sanitizedUpdates.status === 'sold') {
        sanitizedUpdates.isActive = false;
      }

      if (sanitizedUpdates.status === 'active') {
        sanitizedUpdates.isActive = true;
      }

      if (sanitizedUpdates.status === 'pending') {
        sanitizedUpdates.isActive = false;
      }

      const updated = await updateListing(listingId, sanitizedUpdates);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Failed to update listing' });
      }

      // If seller resubmits a rejected listing, or edits an approved listing, notify admins again.
      if (
        (existingListing.status === 'rejected' && sanitizedUpdates.status === 'pending') ||
        shouldReapproveAfterEdit
      ) {
        notifyAdminListingPendingReview({
          listingId: updated.id,
          listingTitle: updated.title,
          userId: updated.sellerId,
          location: updated.location || undefined,
          category: updated.category || undefined,
        }).catch((error) =>
          console.error('[Listings] Failed to notify admins for resubmitted listing:', error)
        );
      }

      return res.json({
        success: true,
        listing: updated,
        message: 'Listing updated successfully',
      });
    } catch (error) {
      console.error('[Listings] Error updating listing:', error);
      return res.status(500).json({ success: false, error: 'Failed to update listing' });
    }
  });

  /**
   * DELETE /api/listings/:id
   * Delete a listing (only by owner)
   */
  app.delete('/api/listings/:id', async (req: Request, res: Response) => {
    try {
      const listingId = String(req.params.id);
      const userId = (req as any).userId || req.get('x-user-id');

      // Get the listing to check ownership
      const existingListing = await getListingById(listingId);
      if (!existingListing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }

      // Verify seller ownership (unless admin)
      const isOwner = normalizeOwnerId(existingListing.sellerId) === normalizeOwnerId(userId);

      if (!isOwner && !(req as any).isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: You can only delete your own listings',
        });
      }

      const deleted = await deleteListing(listingId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Failed to delete listing' });
      }

      return res.json({
        success: true,
        message: 'Listing deleted successfully',
      });
    } catch (error) {
      console.error('[Listings] Error deleting listing:', error);
      return res.status(500).json({ success: false, error: 'Failed to delete listing' });
    }
  });

  /**
   * POST /api/listings/:id/view
   * Track a listing view (with IP-based deduplication)
   */
  app.post('/api/listings/:id/view', async (req: Request, res: Response) => {
    try {
      const listingId = String(req.params.id);
      const viewerId = (req as any).userId || null; // Optional: logged-in user
      const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '');
      const userAgent = req.headers['user-agent'] || '';

      // Get current view count before tracking
      const listing = await getListingById(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }

      const previousCount = listing.viewCount || 0;

      // Track the view
      const result = await trackListingView(listingId, viewerId, ipAddress, userAgent);

      // If it's a new (non-duplicate) view, check for milestones
      if (!result.isDuplicate) {
        const currentCount = previousCount + 1;
        const milestones = getViewMilestones(previousCount, currentCount);

        // Send milestone notifications
        if (milestones.length > 0 && listing.sellerId) {
          for (const milestone of milestones) {
            notifyViewMilestone(listing.sellerId, listingId, listing.title, milestone).catch(
              (error) => {
                console.error('[Listings] Failed to send view milestone notification:', error);
              }
            );
          }
        }
      }

      return res.json({
        success: true,
        viewTracked: !result.isDuplicate,
        message: result.isDuplicate ? 'View already counted recently' : 'View tracked successfully',
      });
    } catch (error) {
      console.error('[Listings] Error tracking view:', error);
      return res.status(500).json({ success: false, error: 'Failed to track view' });
    }
  });

  /**
   * GET /api/listings/:id/analytics
   * Get analytics for a specific listing
   */
  app.get('/api/listings/:id/analytics', async (req: Request, res: Response) => {
    try {
      const analytics = await getListingAnalytics(String(req.params.id));
      if (!analytics) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }
      return res.json({ success: true, data: analytics });
    } catch (error) {
      console.error('[Listings] Error fetching listing analytics:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
    }
  });

  const getUserAnalyticsHandler = async (req: Request, res: Response, ownerId: string) => {
    try {
      // Optional: Add authorization check to ensure user can only access their own analytics
      // if ((req as any).userId !== ownerId) {
      //   return res.status(403).json({ success: false, error: 'Unauthorized' });
      // }

      const analytics = await getUserAnalytics(ownerId);
      return res.json({ success: true, data: analytics });
    } catch (error) {
      console.error('[Listings] Error fetching user analytics:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch user analytics' });
    }
  };

  /**
   * GET /api/users/:userId/analytics
   * Get comprehensive analytics for all user listings
   */
  app.get('/api/users/:userId/analytics', async (req: Request, res: Response) => {
    return getUserAnalyticsHandler(req, res, String(req.params.userId));
  });
}
