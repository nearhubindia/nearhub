import type { Express, Response } from 'express';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings } from '../../admin/models/admin-settings';
import type { InsertListing } from '../../admin/models/admin-settings';
import { users } from '../../users/models/users';
import type { AuthRequest } from '../../../lib/types';
import { handleError, notFound } from '../../../lib/error-handler';
import { createListing, getListingById } from '../../listings/services/listings';
import { getUserById, getUserByPhone } from '../../users/services/user-profiles';
import { adminAuthMiddleware } from './admin-auth';
import {
  notifyListingApproved,
  notifyListingRejected,
} from '../../../shared/services/auto-notifications';
import { createInAppNotification } from '../../../shared/services/in-app-notifications';

export function registerAdminListingsRoutes(app: Express) {
  type AdminAuthRequest = AuthRequest & { admin?: { id?: string } };

  app.use('/api/admin/listings', adminAuthMiddleware);

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
          .map((item) =>
            item
              .trim()
              .replace(/^"(.*)"$/, '$1')
              .replace(/\\"/g, '"')
          )
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

  const normalizeUserLookupPhone = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.replace(/\D/g, '').slice(-10);
  };

  const normalizeOptionalText = (value: unknown): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const raw = String(value).trim();
    return raw ? raw : undefined;
  };

  const normalizeCategoryHierarchy = (input: {
    mainCategory?: unknown;
    subCategory?: unknown;
    subcategory?: unknown;
    category?: unknown;
  }): { mainCategory?: string; subCategory?: string; category?: string } => {
    const normalizedSubCategory =
      normalizeOptionalText(input.subCategory) ||
      normalizeOptionalText(input.subcategory) ||
      normalizeOptionalText(input.category);
    const normalizedMainCategory =
      normalizeOptionalText(input.mainCategory) || normalizedSubCategory;

    return {
      mainCategory: normalizedMainCategory,
      subCategory: normalizedSubCategory,
      category: normalizedSubCategory,
    };
  };

  const parseCoordinateInput = (
    value: unknown,
    fieldName: 'latitude' | 'longitude',
    min: number,
    max: number
  ): { value?: number; error?: string } => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return { value: undefined };
    }

    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      return {
        error: `${fieldName} must be a valid number between ${min} and ${max}`,
      };
    }
    return { value: parsed };
  };

  const looksLikePhone = (value: string): boolean => /^\d{10,15}$/.test(value.replace(/\D/g, ''));

  const resolveListingOwnerId = async (value: unknown): Promise<string | null> => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return null;

    const normalizedPhone = normalizeUserLookupPhone(raw);
    const ownerFilters = [eq(users.id, raw), eq(users.username, raw)];
    if (normalizedPhone) ownerFilters.push(eq(users.mobile, normalizedPhone));

    const dbUser = await db.query.users.findFirst({
      where: or(...ownerFilters),
      columns: { id: true },
    });
    if (dbUser?.id) return String(dbUser.id);

    const profileUser = getUserById(raw) || getUserByPhone(raw);
    return profileUser?.id ? String(profileUser.id) : null;
  };

  /**
   * GET /api/admin/listings
   * Get all listings (admin only) - includes inactive listings
   */
  app.get('/api/admin/listings', async (req: AuthRequest, res: Response) => {
    try {
      const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
      const parsedOffset = Number.parseInt(String(req.query.offset ?? ''), 10);
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 100;
      const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
      const category =
        typeof req.query.category === 'string' && req.query.category.trim()
          ? req.query.category.trim()
          : undefined;
      const status =
        typeof req.query.status === 'string' && req.query.status.trim()
          ? req.query.status.trim()
          : undefined;
      const ownerId =
        typeof req.query.userId === 'string' && req.query.userId.trim()
          ? req.query.userId.trim()
          : undefined;

      const filters = [];
      if (category) filters.push(eq(listings.category, category));
      if (status) filters.push(eq(listings.status, status));
      if (ownerId) filters.push(eq(listings.sellerId, ownerId));
      const whereClause = filters.length > 0 ? and(...filters) : undefined;

      const baseListingQuery = db.select().from(listings);
      const scopedListingQuery = whereClause
        ? baseListingQuery.where(whereClause)
        : baseListingQuery;
      const filteredListings = await scopedListingQuery
        .orderBy(desc(listings.createdAt))
        .limit(limit)
        .offset(offset);

      const sellerIds = [
        ...new Set(filteredListings.map((l) => String(l.sellerId || '').trim())),
      ].filter(Boolean);
      const dbUsers =
        sellerIds.length > 0
          ? await db
              .select({
                id: users.id,
                username: users.username,
                displayName: users.displayName,
                mobile: users.mobile,
              })
              .from(users)
              .where(inArray(users.id, sellerIds))
          : [];
      const dbUserById = new Map(dbUsers.map((u) => [String(u.id), u]));

      const totalResult = whereClause
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(listings)
            .where(whereClause)
        : await db.select({ count: sql<number>`count(*)` }).from(listings);
      const total = Number(totalResult[0]?.count || 0);

      res.json({
        success: true,
        data: filteredListings.map((listing) => {
          const sellerId = String(listing.sellerId || '').trim();
          const dbUser = dbUserById.get(sellerId);
          const profileUser = getUserById(sellerId) || getUserByPhone(sellerId);

          const displayName =
            (typeof dbUser?.displayName === 'string' && dbUser.displayName.trim()) ||
            (typeof dbUser?.username === 'string' && dbUser.username.trim()) ||
            (typeof profileUser?.name === 'string' && profileUser.name.trim()) ||
            null;

          const mobileNumber =
            normalizeContactPhone(listing.contactPhone) ||
            normalizeContactPhone(dbUser?.mobile) ||
            normalizeContactPhone(profileUser?.phone) ||
            (looksLikePhone(sellerId) ? sellerId : null);

          return {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            mainCategory: listing.mainCategory,
            subCategory: listing.subCategory || listing.category,
            category: listing.category,
            price: listing.price,
            condition: listing.condition,
            location: listing.location,
            pincode: listing.pincode,
            latitude: listing.latitude,
            longitude: listing.longitude,
            status: listing.status,
            userId: listing.sellerId,
            displayName,
            mobileNumber,
            contactPhone: mobileNumber,
            isActive: listing.isActive,
            featured: listing.featured,
            sponsored: listing.sponsored,
            createdAt: listing.createdAt?.toISOString(),
            expiresAt: listing.expiresAt?.toISOString(),
            images: parseJsonField(listing.images),
            videos: parseJsonField(listing.videos),
          };
        }),
        total,
        limit,
        offset,
        hasMore: offset + filteredListings.length < total,
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
        mainCategory,
        subCategory,
        subcategory,
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
      const normalizedCategory = normalizeCategoryHierarchy({
        mainCategory,
        subCategory,
        subcategory,
        category,
      });

      if (!title || !description || !normalizedCategory.subCategory || !location) {
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

      const ownerId = await resolveListingOwnerId(userId);
      if (!ownerId) {
        return res.status(400).json({
          success: false,
          error: 'Seller user ID, username, or phone is required',
        });
      }

      const normalizedPincode = normalizeOptionalText(pincode);
      const parsedLatitude = parseCoordinateInput(latitude, 'latitude', -90, 90);
      const parsedLongitude = parseCoordinateInput(longitude, 'longitude', -180, 180);

      if (parsedLatitude.error || parsedLongitude.error) {
        return res.status(400).json({
          success: false,
          error: parsedLatitude.error || parsedLongitude.error,
        });
      }

      const hasLatitude = parsedLatitude.value !== undefined;
      const hasLongitude = parsedLongitude.value !== undefined;
      if (hasLatitude !== hasLongitude) {
        return res.status(400).json({
          success: false,
          error: 'Both latitude and longitude are required together',
        });
      }

      const created = await createListing({
        sellerId: ownerId,
        title: String(title).trim(),
        description: String(description).trim(),
        mainCategory: normalizedCategory.mainCategory,
        subCategory: normalizedCategory.subCategory,
        category: normalizedCategory.category || String(category || ''),
        price: parsedPrice.toString(),
        condition: condition || 'good',
        location: String(location),
        contactPhone: normalizeContactPhone(contactPhone),
        priceUnit,
        listingType: listingType || 'mixed',
        pincode: normalizedPincode,
        latitude: parsedLatitude.value !== undefined ? parsedLatitude.value.toString() : undefined,
        longitude:
          parsedLongitude.value !== undefined ? parsedLongitude.value.toString() : undefined,
        images: Array.isArray(images) ? images : [],
        videos: Array.isArray(videos) ? videos : [],
        status: status || 'active',
        isActive: typeof isActive === 'boolean' ? isActive : true,
        featured: typeof featured === 'boolean' ? featured : false,
        sponsored: typeof sponsored === 'boolean' ? sponsored : false,
        durationDays: Number(durationDays) > 0 ? Number(durationDays) : 30,
      } as InsertListing);

      return res.status(201).json({
        success: true,
        data: {
          ...created,
          mainCategory: created.mainCategory,
          subCategory: created.subCategory || created.category,
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
          mainCategory: listing.mainCategory,
          subCategory: listing.subCategory || listing.category,
          category: listing.category,
          price: listing.price,
          condition: listing.condition,
          location: listing.location,
          pincode: listing.pincode,
          latitude: listing.latitude,
          longitude: listing.longitude,
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
          createdBy: (req as AdminAuthRequest).admin?.id || 'admin',
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
        mainCategory,
        subCategory,
        subcategory,
        category,
        price,
        condition,
        location,
        pincode,
        latitude,
        longitude,
        status,
        isActive,
        featured,
        sponsored,
        contactPhone,
      } = req.body;

      const updateData: Partial<typeof listings.$inferInsert> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      const hasSubCategoryInput =
        subCategory !== undefined || subcategory !== undefined || category !== undefined;
      if (hasSubCategoryInput) {
        const normalizedCategory = normalizeCategoryHierarchy({
          mainCategory,
          subCategory,
          subcategory,
          category,
        });
        if (!normalizedCategory.subCategory) {
          return res.status(400).json({
            success: false,
            error: 'Category cannot be empty',
          });
        }
        updateData.subCategory = normalizedCategory.subCategory;
        updateData.category = normalizedCategory.category || normalizedCategory.subCategory;
        if (mainCategory === undefined) {
          updateData.mainCategory = normalizedCategory.mainCategory || normalizedCategory.subCategory;
        }
      }
      if (mainCategory !== undefined) {
        const normalizedMainCategory = normalizeOptionalText(mainCategory);
        updateData.mainCategory = normalizedMainCategory ?? null;
      }
      if (price !== undefined) updateData.price = price;
      if (condition !== undefined) updateData.condition = condition;
      if (location !== undefined) updateData.location = location;
      if (pincode !== undefined) {
        const normalizedPincode = normalizeOptionalText(pincode);
        updateData.pincode = normalizedPincode ?? null;
      }

      const latitudeProvided = latitude !== undefined;
      const longitudeProvided = longitude !== undefined;
      if (latitudeProvided !== longitudeProvided) {
        return res.status(400).json({
          success: false,
          error: 'Both latitude and longitude are required together',
        });
      }

      if (latitudeProvided && longitudeProvided) {
        const parsedLatitude = parseCoordinateInput(latitude, 'latitude', -90, 90);
        const parsedLongitude = parseCoordinateInput(longitude, 'longitude', -180, 180);

        if (parsedLatitude.error || parsedLongitude.error) {
          return res.status(400).json({
            success: false,
            error: parsedLatitude.error || parsedLongitude.error,
          });
        }

        updateData.latitude =
          parsedLatitude.value !== undefined ? parsedLatitude.value.toString() : null;
        updateData.longitude =
          parsedLongitude.value !== undefined ? parsedLongitude.value.toString() : null;
      }
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
          mainCategory: listing.mainCategory,
          subCategory: listing.subCategory || listing.category,
          category: listing.category,
          price: listing.price,
          condition: listing.condition,
          location: listing.location,
          pincode: listing.pincode,
          latitude: listing.latitude,
          longitude: listing.longitude,
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
