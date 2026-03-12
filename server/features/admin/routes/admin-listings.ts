import type { Express, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings } from '../../admin/models/admin-settings';
import type { AuthRequest } from '../../../lib/types';
import { handleError, notFound } from '../../../lib/error-handler';
import { createListing, getListingById } from '../../listings/services/listings';
import {
  notifyListingApproved,
  notifyListingRejected,
} from '../../../shared/services/auto-notifications';
import { createInAppNotification } from '../../../shared/services/in-app-notifications';

export function registerAdminListingsRoutes(app: Express) {
  const parseJsonField = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    if (typeof value !== 'string') return [];

    const raw = value.trim();
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed == null) return [];
      return [parsed];
    } catch {
      // Accept Postgres array literal format as well.
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const inner = raw.slice(1, -1).trim();
        if (!inner) return [];
        return inner
          .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((item) => item.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"'))
          .filter(Boolean);
      }
      return [raw];
    }
  };

  const normalizeContactPhone = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    return raw;
  };

  /**
   * GET /api/admin/listings
   * Get all listings (admin only) - includes inactive listings
   */
  app.get('/api/admin/listings', async (req: AuthRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const category = req.query.category as string | undefined;
      const status = req.query.status as string | undefined;
      const userId = req.query.userId as string | undefined;
      const ownerId = userId;

      const allListings = await db
        .select()
        .from(listings)
        .orderBy(desc(listings.createdAt))
        .limit(limit)
        .offset(offset);

      // Filter on the application side if needed
      let filtered = allListings;

      if (category) {
        filtered = filtered.filter((l) => l.category === category);
      }

      if (status) {
        filtered = filtered.filter((l) => l.status === status);
      }

      if (ownerId) {
        filtered = filtered.filter((l) => l.sellerId === ownerId);
      }

      // Get total count
      const totalResult = await db.select({ count: listings.id }).from(listings);
      const total =
        typeof totalResult[0]?.count === 'number' ? totalResult[0].count : allListings.length;

      res.json({
        success: true,
        data: filtered.map((listing) => ({
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          price: listing.price,
          condition: listing.condition,
          location: listing.location,
          status: listing.status,
          userId: listing.sellerId,
          contactPhone: listing.contactPhone,
          isActive: listing.isActive,
          featured: listing.featured,
          sponsored: listing.sponsored,
          createdAt: listing.createdAt?.toISOString(),
          expiresAt: listing.expiresAt?.toISOString(),
          images: parseJsonField(listing.images),
          videos: parseJsonField(listing.videos),
        })),
        total,
      });
    } catch (error) {
      console.error('[Admin Listings] Error fetching listings:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to fetch listings');
    }
  });

  /**
   * POST /api/admin/listings
   * Create listing (admin only)
   */
  app.post('/api/admin/listings', async (req: AuthRequest, res: Response) => {
    try {
      const {
        userId,
        title,
        description,
        category,
        price,
        condition,
        location,
        images,
        videos,
        durationDays,
        priceUnit,
        listingType,
        pincode,
        latitude,
        longitude,
        status,
        isActive,
        featured,
        sponsored,
        contactPhone,
      } = req.body;

      if (!title || !description || !category || !location) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, description, category, location',
        });
      }

      const parsedPrice = parseFloat(String(price ?? 0));
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          error: 'Price must be a non-negative number',
        });
      }

      const ownerId = typeof userId === 'string' && userId.trim() ? userId.trim() : 'admin';

      const created = await createListing({
        sellerId: ownerId,
        title: String(title).trim(),
        description: String(description).trim(),
        category: String(category),
        price: parsedPrice.toString(),
        condition: condition || 'good',
        location: String(location),
        contactPhone: normalizeContactPhone(contactPhone),
        priceUnit,
        listingType: listingType || 'mixed',
        pincode,
        latitude: latitude ? parseFloat(String(latitude)).toString() : undefined,
        longitude: longitude ? parseFloat(String(longitude)).toString() : undefined,
        images: Array.isArray(images) ? images : [],
        videos: Array.isArray(videos) ? videos : [],
        status: status || 'active',
        isActive: typeof isActive === 'boolean' ? isActive : true,
        featured: typeof featured === 'boolean' ? featured : false,
        sponsored: typeof sponsored === 'boolean' ? sponsored : false,
        durationDays: Number(durationDays) > 0 ? Number(durationDays) : 30,
      } as any);

      return res.status(201).json({
        success: true,
        data: {
          ...created,
          userId: created.sellerId,
          createdAt: created.createdAt?.toISOString() || null,
          expiresAt: created.expiresAt?.toISOString() || null,
          images: parseJsonField(created.images),
          videos: parseJsonField(created.videos),
        },
        message: 'Listing created successfully',
      });
    } catch (error) {
      console.error('[Admin Listings] Error creating listing:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to create listing');
    }
  });

  /**
   * GET /api/admin/listings/:id
   * Get listing details (admin only)
   */
  app.get('/api/admin/listings/:id', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

      const [listing] = await db.select().from(listings).where(eq(listings.id, id));

      if (!listing) {
        return notFound(res, 'Listing');
      }

      res.json({
        success: true,
        data: {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          price: listing.price,
          condition: listing.condition,
          location: listing.location,
          status: listing.status,
          userId: listing.sellerId,
          contactPhone: listing.contactPhone,
          isActive: listing.isActive,
          featured: listing.featured,
          sponsored: listing.sponsored,
          createdAt: listing.createdAt?.toISOString(),
          expiresAt: listing.expiresAt?.toISOString(),
          images: parseJsonField(listing.images),
          videos: parseJsonField(listing.videos),
        },
      });
    } catch (error) {
      console.error('[Admin Listings] Error fetching listing:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to fetch listing');
    }
  });

  /**
   * PATCH /api/admin/listings/:id/review
   * Approve or reject a pending listing (admin only)
   * Body: { action: 'approve' | 'reject', reason?: string }
   */
  app.patch('/api/admin/listings/:id/review', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const action = req.body?.action;
      const reasonRaw = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      if (action !== 'approve' && action !== 'reject') {
        return res.status(400).json({
          success: false,
          error: "Invalid action. Use 'approve' or 'reject'.",
        });
      }

      if (action === 'reject' && !reasonRaw) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required when rejecting a listing.',
        });
      }

      const existing = await getListingById(id);
      if (!existing) {
        return notFound(res, 'Listing');
      }

      const nextStatus = action === 'approve' ? 'active' : 'rejected';
      const nextIsActive = action === 'approve';

      const result = await db
        .update(listings)
        .set({
          status: nextStatus,
          isActive: nextIsActive,
          updatedAt: new Date(),
        })
        .where(eq(listings.id, id))
        .returning();

      const listing = result[0];
      if (!listing) {
        return notFound(res, 'Listing');
      }

      // Seller-facing notifications for moderation result
      if (action === 'approve') {
        notifyListingApproved(listing.sellerId, listing.title, listing.id).catch((error) =>
          console.error('[Admin Listings] Failed to send listing approved notification:', error)
        );
      } else {
        notifyListingRejected(listing.sellerId, listing.title, reasonRaw).catch((error) =>
          console.error('[Admin Listings] Failed to send listing rejected notification:', error)
        );

        // Persist rejection reason in in-app notification feed to surface on seller "My Listings"
        createInAppNotification({
          userId: listing.sellerId,
          userType: 'all',
          title: 'Listing Rejected',
          message: reasonRaw,
          type: 'error',
          category: 'listing_rejection',
          referenceId: listing.id,
          priority: 'high',
          actionLabel: 'Edit Listing',
          actionUrl: `/listings/edit?id=${listing.id}`,
          createdBy: ((req as any).admin?.id as string | undefined) || 'admin',
        }).catch((error) =>
          console.error('[Admin Listings] Failed to create in-app rejection notification:', error)
        );
      }

      return res.json({
        success: true,
        data: {
          id: listing.id,
          status: listing.status,
          isActive: listing.isActive,
          reason: action === 'reject' ? reasonRaw : undefined,
        },
        message: `Listing ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });
    } catch (error) {
      console.error('[Admin Listings] Error reviewing listing:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to review listing');
    }
  });

  /**
   * PATCH /api/admin/listings/:id/toggle-status
   * Toggle listing active status (admin only)
   */
  app.patch('/api/admin/listings/:id/toggle-status', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

      const existing = await getListingById(id);
      if (!existing) {
        return notFound(res, 'Listing');
      }

      const nextIsActive = !existing.isActive;
      const nextStatus = nextIsActive ? 'active' : 'inactive';

      const result = await db
        .update(listings)
        .set({ isActive: nextIsActive, status: nextStatus })
        .where(eq(listings.id, id))
        .returning();

      const listing = result[0];
      if (!listing) {
        return notFound(res, 'Listing');
      }

      return res.json({
        success: true,
        data: {
          id: listing.id,
          isActive: listing.isActive,
          status: listing.status,
        },
        message: `Listing ${nextIsActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      console.error('[Admin Listings] Error toggling listing status:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to toggle listing status');
    }
  });

  /**
   * PATCH /api/admin/listings/:id
   * Update listing (admin only)
   */
  app.patch('/api/admin/listings/:id', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const {
        title,
        description,
        category,
        price,
        condition,
        location,
        status,
        isActive,
        featured,
        sponsored,
        contactPhone,
      } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (price !== undefined) updateData.price = price;
      if (condition !== undefined) updateData.condition = condition;
      if (location !== undefined) updateData.location = location;
      if (status !== undefined) updateData.status = status;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (featured !== undefined) updateData.featured = featured;
      if (sponsored !== undefined) updateData.sponsored = sponsored;
      if (contactPhone !== undefined) updateData.contactPhone = normalizeContactPhone(contactPhone);

      const result = await db
        .update(listings)
        .set(updateData)
        .where(eq(listings.id, id))
        .returning();

      if (result.length === 0) {
        return notFound(res, 'Listing');
      }

      const listing = result[0];
      res.json({
        success: true,
        data: {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          price: listing.price,
          condition: listing.condition,
          location: listing.location,
          status: listing.status,
          userId: listing.sellerId,
          contactPhone: listing.contactPhone,
          isActive: listing.isActive,
          featured: listing.featured,
          sponsored: listing.sponsored,
          createdAt: listing.createdAt?.toISOString(),
          expiresAt: listing.expiresAt?.toISOString(),
        },
        message: 'Listing updated successfully',
      });
    } catch (error) {
      console.error('[Admin Listings] Error updating listing:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to update listing');
    }
  });

  /**
   * DELETE /api/admin/listings/:id
   * Delete listing (admin only)
   */
  app.delete('/api/admin/listings/:id', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

      const result = await db.delete(listings).where(eq(listings.id, id)).returning();

      if (result.length === 0) {
        return notFound(res, 'Listing');
      }

      res.json({
        success: true,
        message: 'Listing deleted successfully',
      });
    } catch (error) {
      console.error('[Admin Listings] Error deleting listing:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to delete listing');
    }
  });
}
