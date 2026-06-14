import type { Express, NextFunction, Request, Response } from 'express';
import { Readable } from 'node:stream';
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
  getListingConversationCountMap,
  getListingLikeCountMap,
  setListingLike,
} from '../services/analytics';
import {
  notifyViewMilestone,
  notifyAdminListingPendingReview,
} from '../../../shared/services/auto-notifications';
import { SERVER_CONFIG } from '../../../lib/config';
import { getRequestUserId } from '../../../lib/request-user';
import { db } from '../../../data/db';
import { redisCache } from '../../../shared/cache/redis-cache';
import { users } from '../../users/models/users';
import { resolveUserDisplayName } from '../../users/services/user-profiles';
import { eq, inArray, or } from 'drizzle-orm';
import { parseJsonArrayField } from '../../../shared/utils/json-fields';
import { calculateDistance } from '../../search/services/distance';

function normalizeOwnerId(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[\s-]/g, '').toLowerCase();
}

function normalizeOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : undefined;

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
  }

  return undefined;
}

function normalizeOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : undefined;
}

function dropUndefinedValues<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
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

const PHONE_PATH_SEGMENT = /\/(?:images|videos)\/\d{10,15}(?=\/)/i;

function hasPhoneInMediaPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return PHONE_PATH_SEGMENT.test(value);
}

function getPublicBaseUrl(req: Request): string {
  const forwardedProto = String(req.get('x-forwarded-proto') || '').trim();
  const proto = forwardedProto || req.protocol || 'https';
  const forwardedHost = String(req.get('x-forwarded-host') || '').trim();
  const host = forwardedHost || req.get('host') || '';
  return `${proto}://${host}`;
}

function buildMediaProxyUrl(
  req: Request,
  listingId: string,
  mediaType: 'images' | 'videos',
  index: number
): string {
  const base = getPublicBaseUrl(req);
  return `${base}/api/listings/${encodeURIComponent(listingId)}/media/${mediaType}/${index}`;
}

function sanitizeMediaForPublic(
  req: Request,
  listingId: string,
  mediaType: 'images' | 'videos',
  values: unknown[]
): unknown[] {
  return values.map((value, index) => {
    if (!hasPhoneInMediaPath(value)) return value;
    return buildMediaProxyUrl(req, listingId, mediaType, index);
  });
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

function normalizePurchaseLimitType(value: unknown): 'ONE_TIME' | 'UNLIMITED' | '' {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toUpperCase();
  return normalized === 'ONE_TIME' || normalized === 'UNLIMITED' ? normalized : '';
}

function isDirectBrowserNavigationRequest(req: Request): boolean {
  if (req.method !== 'GET') return false;

  const secFetchMode = String(req.get('sec-fetch-mode') || '')
    .trim()
    .toLowerCase();
  const secFetchDest = String(req.get('sec-fetch-dest') || '')
    .trim()
    .toLowerCase();
  const accept = String(req.get('accept') || '')
    .trim()
    .toLowerCase();

  if (secFetchMode === 'navigate' || secFetchDest === 'document') {
    return true;
  }

  if (!secFetchMode && accept.includes('text/html') && !accept.includes('application/json')) {
    return true;
  }

  return false;
}

function blockListingsBrowserNavigation(req: Request, res: Response, next: NextFunction): void {
  if (!isDirectBrowserNavigationRequest(req)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    error: 'Direct browser access is blocked for this API.',
  });
}

type SellerMeta = {
  isVerified: boolean;
  avatarUrl: string;
  displayName: string;
};

function selectPreferredSellerMeta(
  current: SellerMeta | undefined,
  incoming: SellerMeta
): SellerMeta {
  if (!current) return incoming;

  const currentScore =
    (current.avatarUrl ? 4 : 0) + (current.displayName ? 2 : 0) + (current.isVerified ? 1 : 0);
  const incomingScore =
    (incoming.avatarUrl ? 4 : 0) + (incoming.displayName ? 2 : 0) + (incoming.isVerified ? 1 : 0);

  return incomingScore > currentScore ? incoming : current;
}

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
    const meta: SellerMeta = {
      isVerified: Boolean(row.isVerified),
      avatarUrl: String(row.avatarUrl || ''),
      displayName: String(row.displayName || row.username || '').trim(),
    };
    if (row.id) {
      const key = String(row.id).trim();
      metaMap.set(key, selectPreferredSellerMeta(metaMap.get(key), meta));
    }
    if (row.mobile) {
      const key = String(row.mobile).trim();
      metaMap.set(key, selectPreferredSellerMeta(metaMap.get(key), meta));
    }
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

function normalizeContactPhoneCandidate(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

async function resolveContactPhone(rest: any): Promise<string> {
  const candidates = [rest?.contactPhone, rest?.sellerPhone];
  for (const value of candidates) {
    const phone = normalizeContactPhoneCandidate(value);
    if (phone) return phone;
  }

  const sellerId = String(rest?.sellerId || rest?.userId || '').trim();
  if (!sellerId) {
    return '';
  }

  const seller = await db.query.users.findFirst({
    where: or(eq(users.id, sellerId), eq(users.mobile, sellerId), eq(users.username, sellerId)),
    columns: {
      mobile: true,
      username: true,
    },
  });

  const fallbackCandidates = [seller?.mobile, seller?.username, sellerId];
  for (const value of fallbackCandidates) {
    const phone = normalizeContactPhoneCandidate(value);
    if (phone) return phone;
  }

  return '';
}

function toPublicListing(
  req: Request,
  listing: any,
  sellerMetaMap?: Map<string, SellerMeta>,
  options?: {
    includeSellerIdentity?: boolean;
    chatCountMap?: Map<string, number>;
    likeCountMap?: Map<string, number>;
  }
) {
  const { sellerId: rawSellerId, ...rest } = listing || {};
  const sellerId = typeof rawSellerId === 'string' ? rawSellerId : '';
  const listingId = String(listing?.id || '').trim();
  const sellerMeta = sellerMetaMap?.get(sellerId);
  const includeSellerIdentity = Boolean(options?.includeSellerIdentity);
  const chatCount = Number(options?.chatCountMap?.get(listingId) || 0);
  const likeCount = Number(options?.likeCountMap?.get(listingId) || 0);
  const images = parseJsonArrayField(listing?.images);
  const videos = parseJsonArrayField(listing?.videos);
  const publicImages = sanitizeMediaForPublic(req, listingId, 'images', images);
  const publicVideos = sanitizeMediaForPublic(req, listingId, 'videos', videos);
  const primaryImage = typeof publicImages[0] === 'string' ? publicImages[0] : '';

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
    chatCount,
    likeCount,
    saveCount: likeCount,
    image: primaryImage,
    imageUrl: primaryImage,
    listingImage: primaryImage,
    images: publicImages,
    listingImages: publicImages,
    videos: publicVideos,
  };
}

function toMutationListingResponse(listing: any) {
  if (!listing || typeof listing !== 'object') {
    return listing;
  }

  const sellerId = String(listing.sellerId || listing.seller_id || '').trim();
  const mainCategory = listing.mainCategory ?? listing.main_category ?? null;
  const subCategory =
    listing.subCategory ?? listing.sub_category ?? listing.category ?? null;
  const category = listing.category ?? subCategory ?? null;

  return {
    ...listing,
    sellerId,
    userId: sellerId,
    mainCategory,
    subCategory,
    category,
    listingType: listing.listingType ?? listing.listing_type ?? null,
    offerPrice: listing.offerPrice ?? listing.offer_price ?? null,
    priceUnit: listing.priceUnit ?? listing.price_unit ?? null,
    contactPhone: listing.contactPhone ?? listing.contact_phone ?? null,
    isActive: listing.isActive ?? listing.is_active ?? false,
    isPaid: listing.isPaid ?? listing.is_paid ?? false,
    durationDays: listing.durationDays ?? listing.duration_days ?? null,
    subscriptionTierId:
      listing.subscriptionTierId ?? listing.subscription_tier_id ?? null,
    userSubscriptionId:
      listing.userSubscriptionId ?? listing.user_subscription_id ?? null,
    couponId: listing.couponId ?? listing.coupon_id ?? null,
    boostedUntil: listing.boostedUntil ?? listing.boosted_until ?? null,
    boostCount: listing.boostCount ?? listing.boost_count ?? 0,
    isDeal: listing.isDeal ?? listing.is_deal ?? false,
    dealType: listing.dealType ?? listing.deal_type ?? null,
    dealStartAt: listing.dealStartAt ?? listing.deal_start_at ?? null,
    dealEndAt: listing.dealEndAt ?? listing.deal_end_at ?? null,
    dealRecurrence: listing.dealRecurrence ?? listing.deal_recurrence ?? 'none',
    dealRecurrenceUntil:
      listing.dealRecurrenceUntil ?? listing.deal_recurrence_until ?? null,
    dealCycleQuantity:
      listing.dealCycleQuantity ?? listing.deal_cycle_quantity ?? null,
    dealLastCycleKey: listing.dealLastCycleKey ?? listing.deal_last_cycle_key ?? null,
    maxDealBookings: listing.maxDealBookings ?? listing.max_deal_bookings ?? null,
    dealBookingsUsed: listing.dealBookingsUsed ?? listing.deal_bookings_used ?? 0,
    purchaseLimitType:
      listing.purchaseLimitType ?? listing.purchase_limit_type ?? null,
    comboItems: parseJsonArrayField(listing.comboItems ?? listing.combo_items),
    dealTerms: listing.dealTerms ?? listing.deal_terms ?? null,
    voucherEnabled: listing.voucherEnabled ?? listing.voucher_enabled ?? true,
    visibilityMode: listing.visibilityMode ?? listing.visibility_mode ?? 'local',
    visibilityRadiusKm:
      listing.visibilityRadiusKm ?? listing.visibility_radius_km ?? null,
    images: parseJsonArrayField(listing.images),
    videos: parseJsonArrayField(listing.videos),
    createdAt: listing.createdAt ?? listing.created_at ?? null,
    updatedAt: listing.updatedAt ?? listing.updated_at ?? null,
    expiresAt: listing.expiresAt ?? listing.expires_at ?? null,
  };
}

function attachDistanceKm<T extends { latitude?: unknown; longitude?: unknown }>(
  listing: T,
  latitude: number | undefined,
  longitude: number | undefined
): T & { distanceKm?: number } {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return listing;
  }

  const requestLatitude = Number(latitude);
  const requestLongitude = Number(longitude);
  if (!Number.isFinite(requestLatitude) || !Number.isFinite(requestLongitude)) {
    return listing;
  }

  const listingLatitude = Number(listing.latitude);
  const listingLongitude = Number(listing.longitude);
  if (!Number.isFinite(listingLatitude) || !Number.isFinite(listingLongitude)) {
    return listing;
  }

  const distanceKm = calculateDistance(
    listingLatitude,
    listingLongitude,
    requestLatitude,
    requestLongitude
  );
  return {
    ...listing,
    distanceKm: Number(distanceKm.toFixed(2)),
  };
}

async function resolveTrustedRequestUserId(req: Request): Promise<string> {
  return getRequestUserId(req);
}

export function registerListingRoutes(app: Express) {
  app.use('/api/listings', blockListingsBrowserNavigation);

  /**
   * GET /api/listings
   * Query: limit, offset, category, userId, latitude, longitude, radius
   */
  app.get('/api/listings', async (req: Request, res: Response) => {
    try {
      const requesterId = await resolveTrustedRequestUserId(req);
      const includeSellerIdentity = Boolean(requesterId);
      const cacheKey = `listings:v1:${includeSellerIdentity ? 'auth' : 'public'}:${JSON.stringify(req.query || {})}`;
      if (redisCache.isOnline()) {
        const cached = await redisCache.get<{
          success: boolean;
          data: unknown[];
          limit: number;
          offset: number;
        }>(cacheKey);
        if (cached) {
          return res.json(cached);
        }
      }
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
      const category = Array.isArray(req.query.category)
        ? (req.query.category[0] as string)
        : (req.query.category as string | undefined);
      const mainCategory = Array.isArray(req.query.mainCategory)
        ? (req.query.mainCategory[0] as string)
        : (req.query.mainCategory as string | undefined);
      const subCategory = Array.isArray(req.query.subCategory)
        ? (req.query.subCategory[0] as string)
        : Array.isArray(req.query.subcategory)
          ? (req.query.subcategory[0] as string)
          : (req.query.subCategory as string | undefined) ||
            (req.query.subcategory as string | undefined);
      const userId = Array.isArray(req.query.userId)
        ? (req.query.userId[0] as string)
        : (req.query.userId as string | undefined);
      const ownerId = userId;

      // Geo-filtering parameters
      const latitude = req.query.latitude ? parseFloat(req.query.latitude as string) : undefined;
      const longitude = req.query.longitude ? parseFloat(req.query.longitude as string) : undefined;
      const radiusKm = req.query.radius ? parseFloat(req.query.radius as string) : undefined;
      const dealsOnly = req.query.dealsOnly === '1' || req.query.dealsOnly === 'true';
      const includeExpiredDeals =
        req.query.includeExpiredDeals === '1' || req.query.includeExpiredDeals === 'true';

      const listings = await getActiveListing({
        limit,
        offset,
        category,
        mainCategory,
        subCategory,
        ownerId,
        latitude,
        longitude,
        radiusKm,
        dealsOnly,
        includeExpiredDeals,
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
      const chatCountMap = await getListingConversationCountMap(
        priceFilteredListings.map((l) => String(l.id || ''))
      );
      const likeCountMap = await getListingLikeCountMap(
        priceFilteredListings.map((l) => String(l.id || ''))
      );

      const listingsWithDistance = priceFilteredListings.map((listing) =>
        attachDistanceKm(listing, latitude, longitude)
      );

      const response = {
        success: true,
        data: listingsWithDistance.map((l) =>
          toPublicListing(req, l, sellerMetaMap, {
            includeSellerIdentity,
            chatCountMap,
            likeCountMap,
          })
        ),
        limit,
        offset,
      };
      if (redisCache.isOnline()) {
        await redisCache.set(cacheKey, response, { ttl: 30 });
      }
      return res.json(response);
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
      const chatCountMap = await getListingConversationCountMap(
        listings.map((l) => String(l.id || ''))
      );
      const likeCountMap = await getListingLikeCountMap(listings.map((l) => String(l.id || '')));

      return res.json({
        success: true,
        category,
        listings: listings.map((l) =>
          toPublicListing(req, l, sellerMetaMap, {
            includeSellerIdentity: Boolean(requesterId),
            chatCountMap,
            likeCountMap,
          })
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
      const includeSellerIdentity = Boolean(requesterId);
      const cacheKey = `listings-search:v1:${includeSellerIdentity ? 'auth' : 'public'}:${JSON.stringify(req.query || {})}`;
      if (redisCache.isOnline()) {
        const cached = await redisCache.get<any>(cacheKey);
        if (cached) {
          return res.json(cached);
        }
      }
      const query = String(req.query.q || '')
        .trim()
        .toLowerCase();
      const category = String(req.query.category || '').trim();
      const mainCategory = String(req.query.mainCategory || '').trim();
      const subCategory = String(req.query.subCategory || req.query.subcategory || '').trim();
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
        mainCategory: mainCategory || undefined,
        subCategory: subCategory || undefined,
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
          listing.mainCategory,
          listing.subCategory,
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
      const chatCountMap = await getListingConversationCountMap(
        page.map((listing) => String(listing.id || ''))
      );
      const likeCountMap = await getListingLikeCountMap(
        page.map((listing) => String(listing.id || ''))
      );
      const results = page.map((listing) =>
        toPublicListing(req, listing, sellerMetaMap, {
          includeSellerIdentity: Boolean(requesterId),
          chatCountMap,
          likeCountMap,
        })
      );

      const response = {
        success: true,
        data: results,
        results, // backward compatibility for older clients
        pagination: {
          limit,
          offset,
          total: filtered.length,
          hasMore: offset + results.length < filtered.length,
        },
      };
      if (redisCache.isOnline()) {
        await redisCache.set(cacheKey, response, { ttl: 30 });
      }
      return res.json(response);
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

      const contactPhone = await resolveContactPhone(listing);
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
   * GET /api/listings/:id/media/:mediaType/:index
   * Resolves a listing media URL by index to avoid exposing phone-based storage paths.
   */
  app.get('/api/listings/:id/media/:mediaType/:index', async (req: Request, res: Response) => {
    try {
      const listingId = String(req.params.id || '').trim();
      const mediaType = String(req.params.mediaType || '')
        .trim()
        .toLowerCase();
      const rawIndex = Number.parseInt(String(req.params.index || ''), 10);

      if (!listingId || !Number.isInteger(rawIndex) || rawIndex < 0) {
        return res.status(400).json({ success: false, error: 'Invalid media request' });
      }
      if (mediaType !== 'images' && mediaType !== 'videos') {
        return res.status(400).json({ success: false, error: 'Invalid media type' });
      }

      const listing = await getListingById(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }
      if (!listing.isActive || normalizeStatus(listing.status) !== 'active') {
        return res.status(404).json({ success: false, error: 'Listing is not available' });
      }

      const media =
        mediaType === 'images'
          ? parseJsonArrayField(listing.images)
          : parseJsonArrayField(listing.videos);
      const item = media[rawIndex];
      const targetUrl = typeof item === 'string' ? item.trim() : '';

      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return res.status(404).json({ success: false, error: 'Media not found' });
      }
      const parsed = new URL(targetUrl);
      const allowedHosts = getAllowedRemoteMediaHosts();
      const currentHost = (req.get('host') || '').split(':')[0].toLowerCase();
      if (currentHost) {
        allowedHosts.add(currentHost);
      }
      if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
        return res.status(400).json({ success: false, error: 'Unapproved media host' });
      }

      const range = req.get('range');
      const upstream = await fetch(targetUrl, {
        headers: range ? { Range: range } : undefined,
      });
      if (!upstream.ok && upstream.status !== 206) {
        return res.status(upstream.status).json({ success: false, error: 'Failed to load media' });
      }

      const contentType = upstream.headers.get('content-type');
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');
      const acceptRanges = upstream.headers.get('accept-ranges');
      const cacheControl = upstream.headers.get('cache-control');
      if (contentType) res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      if (cacheControl) res.setHeader('Cache-Control', cacheControl);
      else res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(upstream.status);

      if (!upstream.body) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        return res.send(buf);
      }

      const body = Readable.fromWeb(upstream.body as unknown as globalThis.ReadableStream);
      body.on('error', (streamError) => {
        console.error('[Listings] Media proxy stream error:', streamError);
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });
      body.pipe(res);
      return;
    } catch (error) {
      console.error('[Listings] Error resolving listing media URL:', error);
      return res.status(500).json({ success: false, error: 'Failed to resolve media URL' });
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
      const chatCountMap = await getListingConversationCountMap([String(listing.id || '')]);
      const likeCountMap = await getListingLikeCountMap([String(listing.id || '')]);
      return res.json({
        success: true,
        listing: toPublicListing(req, listing, sellerMetaMap, {
          includeSellerIdentity: Boolean(requesterId),
          chatCountMap,
          likeCountMap,
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
      const normalizedSubCategory =
        typeof sanitizedUpdates.subCategory === 'string' && sanitizedUpdates.subCategory.trim()
          ? sanitizedUpdates.subCategory.trim()
          : typeof sanitizedUpdates.subcategory === 'string' && sanitizedUpdates.subcategory.trim()
            ? sanitizedUpdates.subcategory.trim()
            : typeof sanitizedUpdates.category === 'string' && sanitizedUpdates.category.trim()
              ? sanitizedUpdates.category.trim()
              : '';
      if (normalizedSubCategory) {
        sanitizedUpdates.subCategory = normalizedSubCategory;
        sanitizedUpdates.category = normalizedSubCategory; // keep legacy category in sync
      }
      if (
        typeof sanitizedUpdates.mainCategory === 'string' &&
        !sanitizedUpdates.mainCategory.trim()
      ) {
        delete sanitizedUpdates.mainCategory;
      }
      delete sanitizedUpdates.subcategory;

      // If a seller edits an already approved listing, route it back to admin review.
      // Status-only actions (e.g. mark sold) should not trigger re-approval.
      const moderationSensitiveFields = new Set([
        // Re-approval should only happen for core listing media/content changes.
        'images',
        'videos',
        'attributes',
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

      sanitizedUpdates.price = normalizeOptionalNumber(sanitizedUpdates.price);
      sanitizedUpdates.offerPrice = normalizeOptionalNumber(sanitizedUpdates.offerPrice);
      sanitizedUpdates.latitude = normalizeOptionalNumber(sanitizedUpdates.latitude);
      sanitizedUpdates.longitude = normalizeOptionalNumber(sanitizedUpdates.longitude);
      sanitizedUpdates.dealStartAt = normalizeOptionalDate(sanitizedUpdates.dealStartAt);
      sanitizedUpdates.dealEndAt = normalizeOptionalDate(sanitizedUpdates.dealEndAt);
      sanitizedUpdates.dealRecurrenceUntil = normalizeOptionalDate(
        sanitizedUpdates.dealRecurrenceUntil
      );
      sanitizedUpdates.dealCycleQuantity = normalizeOptionalNumber(
        sanitizedUpdates.dealCycleQuantity
      );
      sanitizedUpdates.maxDealBookings = normalizeOptionalNumber(sanitizedUpdates.maxDealBookings);
      sanitizedUpdates.dealBookingsUsed = normalizeOptionalNumber(sanitizedUpdates.dealBookingsUsed);
      if (sanitizedUpdates.isDeal === true || (existingListing.isDeal && sanitizedUpdates.isDeal !== false)) {
        const nextPurchaseLimitType =
          sanitizedUpdates.purchaseLimitType !== undefined
            ? normalizePurchaseLimitType(sanitizedUpdates.purchaseLimitType)
            : normalizePurchaseLimitType((existingListing as any).purchaseLimitType);
        if (!nextPurchaseLimitType) {
          return res.status(400).json({
            success: false,
            error: 'Please select a purchase limit type.',
            code: 'PURCHASE_LIMIT_REQUIRED',
          });
        }
        sanitizedUpdates.purchaseLimitType = nextPurchaseLimitType;
      } else if (sanitizedUpdates.isDeal === false) {
        sanitizedUpdates.purchaseLimitType = null;
      }
      delete sanitizedUpdates.postDealPriceMode;
      delete sanitizedUpdates.postDealDiscountPrice;

      if (Array.isArray(sanitizedUpdates.comboItems)) {
        sanitizedUpdates.comboItems = JSON.stringify(sanitizedUpdates.comboItems);
      }

      dropUndefinedValues(sanitizedUpdates);

      const updated = await updateListing(listingId, sanitizedUpdates);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Failed to update listing' });
      }
      if (redisCache.isOnline()) {
        await Promise.all([
          redisCache.invalidatePattern('listings:v1:*'),
          redisCache.invalidatePattern('search:*'),
        ]).catch((cacheError) =>
          console.error('[Listings] Failed to invalidate listing caches:', cacheError)
        );
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
        listing: toMutationListingResponse(updated),
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
   * POST /api/listings/:id/like
   * Like/save a listing (authenticated)
   */
  app.post('/api/listings/:id/like', async (req: Request, res: Response) => {
    try {
      const userId = String(getRequestUserId(req) || '').trim();
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const listingId = String(req.params.id || '').trim();
      if (!listingId) {
        return res.status(400).json({ success: false, error: 'Invalid listing id' });
      }

      const listing = await getListingById(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }

      const result = await setListingLike(listingId, userId, true);
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('[Listings] Error liking listing:', error);
      return res.status(500).json({ success: false, error: 'Failed to like listing' });
    }
  });

  /**
   * DELETE /api/listings/:id/like
   * Unlike/unsave a listing (authenticated)
   */
  app.delete('/api/listings/:id/like', async (req: Request, res: Response) => {
    try {
      const userId = String(getRequestUserId(req) || '').trim();
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const listingId = String(req.params.id || '').trim();
      if (!listingId) {
        return res.status(400).json({ success: false, error: 'Invalid listing id' });
      }

      const listing = await getListingById(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }

      const result = await setListingLike(listingId, userId, false);
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('[Listings] Error unliking listing:', error);
      return res.status(500).json({ success: false, error: 'Failed to unlike listing' });
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
