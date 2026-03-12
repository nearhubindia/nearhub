import type { Express, NextFunction, Request, Response } from 'express';
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
import { SERVER_CONFIG } from '../../../lib/config';
import { getRequestUserId } from '../../../lib/request-user';
import { db } from '../../../data/db';
import { users } from '../../users/models/users';
import { resolveUserDisplayName } from '../../users/services/user-profiles';
import { eq, inArray, or } from 'drizzle-orm';

function parseJsonField(value: unknown): unknown[] {
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
    // Fallback for Postgres array literal format: {"a","b"} or {a,b}
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

function getAllowedRemoteMediaHosts(): Set<string> {
  const hosts = new Set<string>();
  const baseUrl = String(SERVER_CONFIG.CLOUDFLARE_R2_PUBLIC_BASE_URL || '').trim();
  if (!baseUrl) return hosts;
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname) {
      hosts.add(parsed.hostname.toLowerCase());
    }
  } catch {
    // Ignore invalid config URL and skip strict host checks.
  }
  return hosts;
}

function isHttpMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function findInvalidRemoteMediaUrls(values: unknown[], allowedHosts: Set<string>): string[] {
  if (allowedHosts.size === 0 || !SERVER_CONFIG.CLOUDFLARE_R2_ENABLED) {
    return [];
  }

  const invalid: string[] = [];
  for (const item of values) {
    if (!isHttpMediaUrl(item)) continue;
    try {
      const parsed = new URL(item);
      if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
        invalid.push(item);
      }
    } catch {
      invalid.push(String(item));
    }
  }
  return invalid;
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

type SellerMeta = {
  isVerified: boolean;
  avatarUrl: string;
  displayName: string;
};

async function getSellerMetaMap(sellerIds: string[]): Promise<Map<string, SellerMeta>> {
  const uniqueSellerIds = [
    ...new Set(sellerIds.map((id) => String(id || '').trim()).filter(Boolean)),
  ];
  if (uniqueSellerIds.length === 0) {
    return new Map();
  }

  const metaRows = await db
    .select({
      id: users.id,
      mobile: users.mobile,
      displayName: users.displayName,
      username: users.username,
      isVerified: users.isVerified,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(or(inArray(users.id, uniqueSellerIds), inArray(users.mobile, uniqueSellerIds))!);

  const metaMap = new Map<string, SellerMeta>();
  for (const row of metaRows) {
    const meta = {
      isVerified: Boolean(row.isVerified),
      avatarUrl: String(row.avatarUrl || ''),
      displayName: String(row.displayName || row.username || '').trim(),
    };
    if (row.id) metaMap.set(String(row.id).trim(), meta);
    if (row.mobile) metaMap.set(String(row.mobile).trim(), meta);
  }
  return metaMap;
}

function getSellerDisplayName(listing: any, sellerMeta?: SellerMeta): string {
  const hasValidDisplayName = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    const normalized = trimmed.toLowerCase();
    const digitsOnly = trimmed.replace(/\D/g, '');
    const lettersOnly = trimmed.replace(/[^a-z]/gi, '');
    if (
      normalized === 'seller' ||
      normalized === 'unknown' ||
      normalized === 'anonymous' ||
      /^seller\b/i.test(normalized)
    ) {
      return false;
    }
    if (digitsOnly.length >= 10 && lettersOnly.length === 0) {
      return false;
    }
    return true;
  };

  const listingName = typeof listing?.sellerName === 'string' ? listing.sellerName.trim() : '';
  if (hasValidDisplayName(listingName)) {
    return listingName;
  }

  const userName = typeof sellerMeta?.displayName === 'string' ? sellerMeta.displayName.trim() : '';
  if (hasValidDisplayName(userName)) return userName;

  const sellerId = typeof listing?.sellerId === 'string' ? listing.sellerId.trim() : '';
  if (sellerId && !sellerId.startsWith('admin')) {
    const profileName = resolveUserDisplayName(sellerId, 'Seller');
    if (hasValidDisplayName(profileName)) return profileName;
  }

  return 'Seller';
}

function resolveContactPhone(rest: any, sellerId: string): string {
  const candidates = [rest?.contactPhone, rest?.sellerPhone, sellerId];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
  }
  return '';
}

function toPublicListing(
  listing: any,
  sellerMetaMap?: Map<string, SellerMeta>,
  options?: { includeSellerIdentity?: boolean }
) {
  const { sellerId: rawSellerId, ...rest } = listing || {};
  const sellerId = typeof rawSellerId === 'string' ? rawSellerId : '';
  const sellerMeta = sellerMetaMap?.get(sellerId);
  const includeSellerIdentity = Boolean(options?.includeSellerIdentity);

  return {
    ...rest,
    sellerId: includeSellerIdentity ? sellerId : '',
    userId: includeSellerIdentity ? sellerId : '',
    sellerName: getSellerDisplayName(listing, sellerMeta),
    sellerVerified: Boolean(sellerMeta?.isVerified),
    sellerAvatar: sellerMeta?.avatarUrl || '',
    // Never expose raw phone numbers in public listing payloads.
    contactPhone: '',
    sellerPhone: '',
    images: parseJsonField(listing?.images),
    videos: parseJsonField(listing?.videos),
  };
}

async function resolveTrustedRequestUserId(req: Request): Promise<string> {
  const claimedUserId = getRequestUserId(req);
  if (!claimedUserId) return '';

  const claimedPhone =
    typeof req.get('x-user-phone') === 'string' ? String(req.get('x-user-phone') || '').trim() : '';
  const normalizedPhone = claimedPhone.replace(/\D/g, '').slice(-10);

  const matchedUser = await db.query.users.findFirst({
    where: eq(users.id, claimedUserId),
    columns: { id: true, mobile: true },
  });
  if (!matchedUser?.id) return '';

  if (normalizedPhone) {
    const matchedMobile = String(matchedUser.mobile || '')
      .replace(/\D/g, '')
      .slice(-10);
    if (!matchedMobile || matchedMobile !== normalizedPhone) return '';
  }

  return matchedUser.id;
}

export function registerListingRoutes(app: Express) {
  /**
   * GET /api/listings
   * Query: limit, offset, category, userId, latitude, longitude, radius
   */
  app.get('/api/listings', async (req: Request, res: Response) => {
    try {
      const requesterId = await resolveTrustedRequestUserId(req);
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
      const sellerMetaMap = await getSellerMetaMap(priceFilteredListings.map((l) => l.sellerId));

      return res.json({
        success: true,
        data: priceFilteredListings.map((l) =>
          toPublicListing(l, sellerMetaMap, { includeSellerIdentity: Boolean(requesterId) })
        ),
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
      const requesterId = await resolveTrustedRequestUserId(req);
      const category = req.params.category as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const listings = await getActiveListing({ limit, offset, category });
      const sellerMetaMap = await getSellerMetaMap(listings.map((l) => l.sellerId));

      return res.json({
        success: true,
        category,
        listings: listings.map((l) =>
          toPublicListing(l, sellerMetaMap, { includeSellerIdentity: Boolean(requesterId) })
        ),
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
   * GET /api/listings/search
   * Text + filter search for active listings.
   */
  app.get('/api/listings/search', async (req: Request, res: Response) => {
    try {
      const requesterId = await resolveTrustedRequestUserId(req);
      const query = String(req.query.q || '')
        .trim()
        .toLowerCase();
      const category = String(req.query.category || '').trim();
      const location = String(req.query.location || '')
        .trim()
        .toLowerCase();
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
      const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 500);
      const offset = parseInt(String(req.query.offset || '0'), 10) || 0;

      const candidates = await getActiveListing({
        limit: Math.min(limit + offset + 200, 500),
        offset: 0,
        category: category || undefined,
      });

      const filtered = candidates.filter((listing) => {
        const numericPrice =
          typeof listing.price === 'string' ? parseFloat(listing.price) : Number(listing.price);
        if (!Number.isFinite(numericPrice)) return false;
        if (typeof minPrice === 'number' && numericPrice < minPrice) return false;
        if (typeof maxPrice === 'number' && numericPrice > maxPrice) return false;
        if (
          location &&
          !String(listing.location || '')
            .toLowerCase()
            .includes(location)
        )
          return false;

        if (!query) return true;
        const haystack = [
          listing.title,
          listing.description,
          listing.category,
          listing.location,
          listing.condition,
        ]
          .map((value) => String(value || '').toLowerCase())
          .join(' ');
        return haystack.includes(query);
      });

      const page = filtered.slice(offset, offset + limit);
      const sellerMetaMap = await getSellerMetaMap(page.map((listing) => listing.sellerId));
      const results = page.map((listing) =>
        toPublicListing(listing, sellerMetaMap, { includeSellerIdentity: Boolean(requesterId) })
      );

      return res.json({
        success: true,
        data: results,
        results, // backward compatibility for older clients
        pagination: {
          limit,
          offset,
          total: filtered.length,
          hasMore: offset + results.length < filtered.length,
        },
      });
    } catch (error) {
      console.error('[Listings] Error searching listings:', error);
      return res.status(500).json({ success: false, error: 'Failed to search listings' });
    }
  });

  /**
   * GET /api/listings/:id/contact
   * Returns seller contact phone only for authenticated users.
   */
  app.get('/api/listings/:id/contact', async (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id === 'search') {
      return next();
    }

    try {
      const requesterId = await resolveTrustedRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const listing = await getListingById(req.params.id as string);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }

      const isOwner =
        normalizeOwnerId(requesterId) === normalizeOwnerId(String(listing.sellerId || ''));
      if (isOwner) {
        return res.status(400).json({
          success: false,
          error: 'Owner contact is not available for your own listing',
        });
      }

      const contactPhone = resolveContactPhone(listing, String(listing.sellerId || ''));
      if (!contactPhone) {
        return res.status(404).json({ success: false, error: 'Seller phone number not available' });
      }

      return res.json({
        success: true,
        contactPhone,
        sellerPhone: contactPhone,
      });
    } catch (error) {
      console.error('[Listings] Error fetching seller contact:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch seller contact' });
    }
  });

  /**
   * GET /api/listings/:id
   */
  app.get('/api/listings/:id', async (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id === 'search') {
      return next();
    }

    try {
      const requesterId = await resolveTrustedRequestUserId(req);
      const listing = await getListingById(req.params.id as string);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }
      const sellerMetaMap = await getSellerMetaMap([listing.sellerId]);
      return res.json({
        success: true,
        listing: toPublicListing(listing, sellerMetaMap, {
          includeSellerIdentity: Boolean(requesterId),
        }),
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
      const userId = getRequestUserId(req);

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

      const allowedRemoteMediaHosts = getAllowedRemoteMediaHosts();

      if (Array.isArray(sanitizedUpdates.images)) {
        const invalidImageUrls = findInvalidRemoteMediaUrls(
          sanitizedUpdates.images,
          allowedRemoteMediaHosts
        );
        if (invalidImageUrls.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'One or more image URLs are not from the approved Cloudflare R2 media domain.',
            code: 'INVALID_REMOTE_IMAGE_URL',
          });
        }
      }

      if (Array.isArray(sanitizedUpdates.videos)) {
        const invalidVideoUrls = findInvalidRemoteMediaUrls(
          sanitizedUpdates.videos,
          allowedRemoteMediaHosts
        );
        if (invalidVideoUrls.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'One or more video URLs are not from the approved Cloudflare R2 media domain.',
            code: 'INVALID_REMOTE_VIDEO_URL',
          });
        }
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
      const userId = getRequestUserId(req);

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
