import type { Express, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings } from '../../admin/models/admin-settings';
import type { AuthRequest } from '../../../lib/types';
import { handleError, notFound } from '../../../lib/error-handler';

export function registerAdminListingsRoutes(app: Express) {
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
      const sellerId = req.query.sellerId as string | undefined;

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

      if (sellerId) {
        filtered = filtered.filter((l) => l.sellerId === sellerId);
      }

      // Get total count
      const totalResult = await db.select({ count: listings.id }).from(listings);
      const total = typeof totalResult[0]?.count === 'number' ? totalResult[0].count : allListings.length;

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
          sellerId: listing.sellerId,
          isActive: listing.isActive,
          createdAt: listing.createdAt?.toISOString(),
          expiresAt: listing.expiresAt?.toISOString(),
          images: typeof listing.images === 'string' ? JSON.parse(listing.images || '[]') : listing.images || [],
          videos: typeof listing.videos === 'string' ? JSON.parse(listing.videos || '[]') : listing.videos || [],
        })),
        total,
      });
    } catch (error) {
      console.error('[Admin Listings] Error fetching listings:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to fetch listings');
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
          sellerId: listing.sellerId,
          isActive: listing.isActive,
          createdAt: listing.createdAt?.toISOString(),
          expiresAt: listing.expiresAt?.toISOString(),
          images: typeof listing.images === 'string' ? JSON.parse(listing.images || '[]') : listing.images || [],
          videos: typeof listing.videos === 'string' ? JSON.parse(listing.videos || '[]') : listing.videos || [],
        },
      });
    } catch (error) {
      console.error('[Admin Listings] Error fetching listing:', error);
      handleError(res, error, '[Admin Listings]', 'Failed to fetch listing');
    }
  });

  /**
   * PATCH /api/admin/listings/:id
   * Update listing (admin only)
   */
  app.patch('/api/admin/listings/:id', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const { title, description, category, price, condition, location, status, isActive } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (price !== undefined) updateData.price = price;
      if (condition !== undefined) updateData.condition = condition;
      if (location !== undefined) updateData.location = location;
      if (status !== undefined) updateData.status = status;
      if (isActive !== undefined) updateData.isActive = isActive;

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
          sellerId: listing.sellerId,
          isActive: listing.isActive,
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
