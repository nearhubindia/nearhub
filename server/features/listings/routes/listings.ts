import type { Express, Request, Response } from 'express';
import {
  createListing,
  getActiveListing,
  getListingById,
  updateListing,
  deleteListing,
} from '../services/listings';
import {
  trackListingView,
  getListingAnalytics,
  getSellerAnalytics,
  getViewMilestones,
} from '../services/analytics';
import { notifyNewListing, notifyViewMilestone } from '../../../shared/services/auto-notifications';
import { listingCreationLimiter } from '../../../lib/rate-limiter';

function parseJsonField(value: unknown): unknown[] {
  if (typeof value === 'string') return JSON.parse(value || '[]');
  return (value as unknown[]) || [];
}

function normalizeOwnerId(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[\s-]/g, '').toLowerCase();
}

export function registerListingRoutes(app: Express) {
  /**
   * POST /api/listings
   * Create a new listing (DEPRECATED - Use POST /api/subscriptions/create-listing instead)
   * 
   * ⚠️ WARNING: This endpoint bypasses subscription limits and coupon validation.
   * It should only be used for:
   * - Admin testing
   * - System-generated listings
   * - Migration scripts
   * 
   * For production listing creation, use /api/subscriptions/create-listing which:
   * - Validates subscription limits
   * - Supports coupon codes
   * - Enforces tier restrictions (video uploads, featured listings, etc.)
   * - Tracks subscription usage
   */
    app.post('/api/listings', listingCreationLimiter, async (req: Request, res: Response) => {
    try {
      const { title, description, category, price, condition, location, images, videos, durationDays, priceUnit, listingType, pincode, latitude, longitude } = req.body;
      const sellerId = (req as any).userId || 'unknown';

      // Log deprecation warning
      console.warn('[Listings] ⚠️ DEPRECATED: POST /api/listings was called. Use /api/subscriptions/create-listing instead.');
      console.warn('[Listings] Caller:', sellerId, 'IP:', req.ip);

      // Validate required fields
      if (!title || !description || !category || !location) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, description, category, location',
        });
      }

      // Parse and validate price
      const parsedPrice = parseFloat(price) || 0;
      if (parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          error: 'Price must be non-negative',
        });
      }

      try {
        // Use the createListing service to save to database
        const listing = await createListing({
          sellerId,
          title: title.trim(),
          description: description.trim(),
          category,
          price: parsedPrice.toString(), // Convert to string for decimal input
          condition: condition || 'good',
          location,
          priceUnit,
          listingType: listingType || 'mixed',
          pincode,
          latitude: latitude ? parseFloat(latitude).toString() : undefined,
          longitude: longitude ? parseFloat(longitude).toString() : undefined,
          images: images || [],
          videos: videos || [],
          status: 'active',
          isActive: true,
          durationDays: durationDays || 30, // Default 30 days
        } as any);

        // Send push notification for new listing (async, don't wait)
        notifyNewListing(listing).catch((error) => {
          console.error('[Listings] Failed to send new listing notification:', error);
        });

        return res.status(201).json({
          success: true,
          data: {
            id: listing.id,
            sellerId: listing.sellerId,
            title: listing.title,
            description: listing.description,
            category: listing.category,
            price: listing.price,
            condition: listing.condition,
            location: listing.location,
            status: listing.status,
            images: Array.isArray(listing.images) ? listing.images : JSON.parse(listing.images || '[]'),
            videos: Array.isArray(listing.videos) ? listing.videos : JSON.parse(listing.videos || '[]'),
            createdAt: listing.createdAt?.toISOString() || new Date().toISOString(),
            expiresAt: listing.expiresAt?.toISOString() || null,
          },
        });
      } catch (validationError) {
        console.error('[Listings] Validation error:', validationError);
        const errorMessage = validationError instanceof Error ? validationError.message : 'Validation failed';
        return res.status(400).json({ 
          success: false, 
          error: errorMessage.includes('validation') ? errorMessage : 'Invalid listing data' 
        });
      }
    } catch (error) {
      console.error('[Listings] Error creating listing:', error);
      if (error instanceof Error) {
        console.error('[Listings] Error details:', error.message);
      }
      return res.status(500).json({ success: false, error: 'Failed to create listing' });
    }
  });

  /**
   * GET /api/listings
   * Query: limit, offset, category, sellerId, latitude, longitude, radius
   */
  app.get('/api/listings', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const category = Array.isArray(req.query.category) ? req.query.category[0] as string : req.query.category as string | undefined;
      const sellerId = Array.isArray(req.query.sellerId) ? req.query.sellerId[0] as string : req.query.sellerId as string | undefined;
      
      // Geo-filtering parameters
      const latitude = req.query.latitude ? parseFloat(req.query.latitude as string) : undefined;
      const longitude = req.query.longitude ? parseFloat(req.query.longitude as string) : undefined;
      const radiusKm = req.query.radius ? parseFloat(req.query.radius as string) : undefined;

      const listings = await getActiveListing({ limit, offset, category, sellerId, latitude, longitude, radiusKm });

      return res.json({
        success: true,
        data: listings.map((l) => ({
          ...l,
          images: parseJsonField(l.images),
          videos: parseJsonField(l.videos),
        })),
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
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
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
        listings: listings.map((l) => ({
          ...l,
          images: parseJsonField(l.images),
          videos: parseJsonField(l.videos),
        })),
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
        listing: {
          ...listing,
          images: parseJsonField(listing.images),
          videos: parseJsonField(listing.videos),
        },
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
      const isOwner =
        normalizeOwnerId(existingListing.sellerId) === normalizeOwnerId(userId);

      if (!isOwner && !(req as any).isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Unauthorized: You can only edit your own listings' 
        });
      }

      // Prevent editing certain fields after approval
      const restrictedFields = ['id', 'sellerId', 'createdAt', 'viewCount'];
      const sanitizedUpdates = { ...req.body };
      restrictedFields.forEach((field) => delete sanitizedUpdates[field]);

      if (sanitizedUpdates.status === 'sold') {
        sanitizedUpdates.isActive = false;
      }

      if (sanitizedUpdates.status === 'active') {
        sanitizedUpdates.isActive = true;
      }

      const updated = await updateListing(listingId, sanitizedUpdates);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Failed to update listing' });
      }

      return res.json({ 
        success: true, 
        listing: updated,
        message: 'Listing updated successfully'
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
      const isOwner =
        normalizeOwnerId(existingListing.sellerId) === normalizeOwnerId(userId);

      if (!isOwner && !(req as any).isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Unauthorized: You can only delete your own listings' 
        });
      }

      const deleted = await deleteListing(listingId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Failed to delete listing' });
      }

      return res.json({ 
        success: true, 
        message: 'Listing deleted successfully' 
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
        message: result.isDuplicate
          ? 'View already counted recently'
          : 'View tracked successfully',
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

  /**
   * GET /api/sellers/:sellerId/analytics
   * Get comprehensive analytics for all seller's listings
   */
  app.get('/api/sellers/:sellerId/analytics', async (req: Request, res: Response) => {
    try {
      const sellerId = String(req.params.sellerId);

      // Optional: Add authorization check to ensure user can only access their own analytics
      // if ((req as any).userId !== sellerId) {
      //   return res.status(403).json({ success: false, error: 'Unauthorized' });
      // }

      const analytics = await getSellerAnalytics(sellerId);
      return res.json({ success: true, data: analytics });
    } catch (error) {
      console.error('[Listings] Error fetching seller analytics:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch seller analytics' });
    }
  });
}
