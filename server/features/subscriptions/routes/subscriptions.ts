/**
 * Subscription & Payment API Routes
 * Handles listing creation with optional payment
 * Integrates with database-backed listings
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { db } from '../../../data/db';
import { users } from '../../users/models/users';
import { inArray, or } from 'drizzle-orm';
import {
  calculateCheckout,
  getListingCheckoutSummary,
  initiatePayment,
  verifyPayment,
  generatePaymentSummary,
  isPaymentRequired,
  getAvailableDurations,
  getAvailableDurationsWithAdminPricing,
  type CreateListingRequest,
  type CheckoutRequest,
} from '../services/subscription';
import { verifyAdminToken } from '../../admin/services/admin-auth';
import { isListingFree, getPricingForDuration, type DurationOption } from '../services/pricing';
import { getRazorpayService } from '../../payments/services/razorpay';
import { getRequestUserId } from '../../../lib/request-user';
import {
  createListing,
  updateListing,
  boostListingForHours,
} from '../../listings/services/listings';
import {
  applyCouponDiscount,
  recordCouponUsage,
  validateCouponCode,
  getRemainingFreeListings,
  useFreeListingFromCoupon,
} from '../../coupons/services/coupons';
import {
  getActiveListing,
  getListingById,
  getListingsByUser,
} from '../../listings/services/listings';
import {
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyInvoiceGenerated,
  notifyCouponApplied,
  notifyAdminListingPendingReview,
} from '../../../shared/services/auto-notifications';
import {
  getActiveSubscriptionTiers,
  getSubscriptionTierById,
  createSubscriptionTier,
  updateSubscriptionTier,
  deleteSubscriptionTier,
  createUserSubscription,
  canUserCreateListing,
  getTotalAllowedListings,
  SubscriptionTierInUseError,
  getUserBoostCreditsSummary,
  consumeUserBoostCredit,
  addBoostCreditsToSubscription,
} from '../services/subscription-tiers';
import {
  consumeStarterBoostCredit,
  consumeStarterListingCredit,
  getStarterCreditsSummary,
  releaseStarterListingCredit,
} from '../services/starter-credits';
import { getActiveListingCount, getSubscriptionById } from '../services/subscription-tiers';
import { listingCreationLimiter } from '../../../lib/rate-limiter';
import { SERVER_CONFIG } from '../../../lib/config';

function getAuthenticatedUserId(req: Request): string {
  const userId = getRequestUserId(req);
  return typeof userId === 'string' ? userId.trim() : '';
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
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

function parseMediaField(value: unknown): unknown[] {
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

type SellerMeta = {
  avatarUrl: string;
  isVerified: boolean;
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
      username: users.username,
      avatarUrl: users.avatarUrl,
      isVerified: users.isVerified,
    })
    .from(users)
    .where(or(inArray(users.id, uniqueSellerIds), inArray(users.mobile, uniqueSellerIds))!);

  const metaMap = new Map<string, SellerMeta>();
  for (const row of metaRows) {
    const meta = {
      avatarUrl: String(row.avatarUrl || ''),
      isVerified: Boolean(row.isVerified),
      displayName: String(row.username || '').trim(),
    };
    if (row.id) metaMap.set(String(row.id).trim(), meta);
    if (row.mobile) metaMap.set(String(row.mobile).trim(), meta);
  }
  return metaMap;
}

function getSellerDisplayName(listing: any, sellerMeta?: SellerMeta): string {
  const listingName = typeof listing?.sellerName === 'string' ? listing.sellerName.trim() : '';
  if (listingName && listingName.toLowerCase() !== 'seller') {
    return listingName;
  }

  const userName = typeof sellerMeta?.displayName === 'string' ? sellerMeta.displayName.trim() : '';
  if (userName) return userName;

  return listingName || 'Seller';
}

function toPublicListing(listing: any, sellerMetaMap?: Map<string, SellerMeta>) {
  const { sellerId: rawSellerId, ...rest } = listing || {};
  const sellerId = typeof rawSellerId === 'string' ? rawSellerId : '';
  const contactPhone = resolveContactPhone(rest, sellerId);
  const sellerMeta = sellerMetaMap?.get(sellerId);

  return {
    ...rest,
    sellerId,
    userId: sellerId, // Backward compatibility for clients still reading userId.
    sellerName: getSellerDisplayName(listing, sellerMeta),
    sellerAvatar: sellerMeta?.avatarUrl || '',
    sellerVerified: Boolean(sellerMeta?.isVerified),
    contactPhone,
    sellerPhone: contactPhone,
    images: parseMediaField(listing?.images),
    videos: parseMediaField(listing?.videos),
  };
}

export function registerSubscriptionRoutes(app: Express) {
  /**
   * NOTE: GET /api/listings and GET /api/listings/:id endpoints
   * are handled by the listings feature (features/listings/routes/listings.ts)
   * to avoid duplication and maintain single source of truth.
   */

  /**
   * GET /api/subscriptions
   * Get user's subscriptions (requires authentication)
   */
  app.get('/api/subscriptions', async (req: Request, res: Response) => {
    try {
      // Prevent caching to ensure fresh subscription data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Get userId from request context (set by middleware) or x-user-id header
      const userId = getRequestUserId(req);

      console.log('[GET /api/subscriptions] Fetching subscriptions for user:', userId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      // Get user's subscriptions from database
      const { db } = await import('../../../data/db');
      const { userSubscriptions, subscriptionTiers } =
        await import('../../admin/models/admin-settings');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId));

      console.log(
        `[GET /api/subscriptions] Found ${result.length} subscriptions for user ${userId}:`,
        result.map((s) => ({ id: s.id, status: s.status, tierId: s.subscriptionTierId }))
      );

      // Get user's total listing count for backward compatibility
      const userListings = await getListingsByUser(userId);

      const totalListingsCount = userListings.length;

      // Enrich with tier details + PER-SUBSCRIPTION listing stats
      const { listings } = await import('../../admin/models/admin-settings');
      const { sql, and, isNull } = await import('drizzle-orm');

      // DEBUG: Check for listings without userSubscriptionId
      const orphanedListingsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(listings)
        .where(
          and(
            eq(listings.sellerId, userId),
            isNull(listings.userSubscriptionId),
            eq(listings.isActive, true),
            eq(listings.status, 'active')
          )
        );
      const orphanedCount = Number(orphanedListingsResult[0]?.count || 0);
      if (orphanedCount > 0) {
        console.warn(
          `[GET /api/subscriptions] Found ${orphanedCount} active listings WITHOUT userSubscriptionId for user ${userId}`
        );
      }

      const enriched = await Promise.all(
        result.map(async (sub) => {
          const tier = await getSubscriptionTierById(sub.subscriptionTierId);

          // Count active listings FOR THIS SPECIFIC SUBSCRIPTION
          const listingCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(listings)
            .where(
              and(
                eq(listings.userSubscriptionId, sub.id),
                eq(listings.isActive, true),
                eq(listings.status, 'active')
              )
            );

          const listingsUsedForThisSubscription = Number(listingCountResult[0]?.count || 0);

          // DEBUG: Get actual listing IDs for this subscription
          const listingRecords = await db
            .select({
              id: listings.id,
              title: listings.title,
              userSubscriptionId: listings.userSubscriptionId,
              isActive: listings.isActive,
              status: listings.status,
            })
            .from(listings)
            .where(
              and(
                eq(listings.userSubscriptionId, sub.id),
                eq(listings.isActive, true),
                eq(listings.status, 'active')
              )
            );

          console.log(
            `[GET /api/subscriptions] Subscription ${sub.id} (${tier?.name}) - Listed count: ${listingsUsedForThisSubscription}`,
            {
              subscriptionStatus: sub.status,
              listings: listingRecords.map((l) => ({ id: l.id, title: l.title })),
            }
          );

          return {
            ...sub,
            boostsRemaining: Number((sub as any).boostsRemaining || 0),
            tier: tier
              ? {
                  id: tier.id,
                  name: tier.name,
                  type: (tier as any).type || 'bundle',
                  price: tier.price,
                  durationDays: tier.durationDays,
                  maxListings: tier.maxListings,
                  featuredListingsPerMonth: tier.featuredListingsPerMonth,
                  boostCredits: Number((tier as any).boostCredits || 0),
                  features:
                    typeof tier.features === 'string' ? JSON.parse(tier.features) : tier.features,
                }
              : null,
            listingsUsed: listingsUsedForThisSubscription, // Per-subscription count
            totalListingsCreated: totalListingsCount, // Global count for reference
          };
        })
      );

      console.log('[GET /api/subscriptions] Returning subscriptions:', {
        count: enriched.length,
        subscriptions: enriched.map((s) => ({
          id: s.id,
          status: s.status,
          tierName: s.tier?.name,
          listingsUsed: s.listingsUsed,
          maxListings: s.tier?.maxListings,
          boostsRemaining: s.boostsRemaining,
        })),
      });

      const starterCredits = await getStarterCreditsSummary(String(userId));

      return res.json({
        success: true,
        data: enriched,
        starterCredits,
      });
    } catch (error) {
      console.error('[Subscriptions] Error fetching user subscriptions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch subscriptions',
      });
    }
  });

  /**
   * POST /api/subscriptions
   * Create a new subscription (requires authentication)
   */
  app.post('/api/subscriptions', async (req: Request, res: Response) => {
    try {
      // Get userId from request context (set by middleware) or x-user-id header
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const { tierId, duration } = req.body;

      if (!tierId) {
        return res.status(400).json({
          success: false,
          error: 'Tier ID is required',
        });
      }

      // Verify tier exists
      const tier = await getSubscriptionTierById(tierId);
      if (!tier) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tier ID',
        });
      }

      const effectiveDuration = Number(duration || tier.durationDays || 30);

      // Create subscription
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + effectiveDuration);

      const subscription = await createUserSubscription(userId, tierId, expiresAt);

      return res.status(201).json({
        success: true,
        id: subscription.id,
        userId: subscription.userId,
        tierId: subscription.subscriptionTierId,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        createdAt: subscription.subscribedAt,
      });
    } catch (error) {
      console.error('[Subscriptions] Error creating subscription:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create subscription',
      });
    }
  });

  /**
   * GET /api/subscriptions/pricing/:price
   * Get available pricing options for a product price
   * Also returns subscription tier information for feature validation
   */
  app.get('/api/subscriptions/pricing/:price', async (req: Request, res: Response) => {
    try {
      const pricParam = req.params.price as string;
      const price = parseFloat(pricParam);
      const mediaType = (
        typeof req.query.mediaType === 'string' ? req.query.mediaType : 'image'
      ) as 'image' | 'video';

      if (isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'Invalid price' });
      }

      if (isListingFree(price)) {
        return res.json({
          isFree: true,
          message: '✓ Listing is FREE for the first 15 days!',
          price,
          mediaType,
        });
      }

      // Use admin-configured pricing based on media type
      const durations = await getAvailableDurationsWithAdminPricing(price, mediaType);

      // Get subscription tiers for feature validation
      const tiers = await getActiveSubscriptionTiers();

      // Enrich durations with tier information
      const enrichedDurations = durations.map((duration) => ({
        ...duration,
        // Try to match with a subscription tier for features
        tierId: null as string | null,
        features: [] as string[],
      }));

      return res.json({
        isFree: false,
        price,
        mediaType,
        message: 'Choose a listing duration to continue',
        durations: enrichedDurations,
        availableTiers: tiers,
      });
    } catch (error) {
      console.error('[Subscriptions] Error calculating pricing:', error);
      res.status(500).json({ error: 'Failed to calculate pricing' });
    }
  });

  /**
   * POST /api/subscriptions/create-listing
   * Create listing with subscription/coupon validation (RECOMMENDED ENDPOINT)
   *
   * ✅ This is the recommended endpoint for creating listings. It provides:
   * - Subscription limit validation
   * - Per-subscription quota tracking
   * - Coupon code support with free listings
   * - Tier-based feature restrictions (video uploads, featured listings)
   * - Usage tracking and analytics
   * - Payment integration
   *
   * Body: {
   *   userId, title, description, category, price, condition, location,
   *   images?, videos?, userSubscriptionId?, subscriptionTierId?, couponCode?, priceUnit?,
   *   listingType?, pincode?, latitude?, longitude?, featured?
   * }
   */
  app.post(
    '/api/subscriptions/create-listing',
    listingCreationLimiter,
    async (req: Request, res: Response) => {
      try {
        const {
          userId,
          title,
          description,
          category,
          price,
          offerPrice,
          condition,
          location,
          images,
          videos,
          userSubscriptionId, // NEW: specific subscription instance to use
          subscriptionTierId,
          couponCode,
          priceUnit,
          listingType,
          pincode,
          latitude,
          longitude,
          featured = false,
        } = req.body;

        const ownerId = typeof userId === 'string' ? userId.trim() : '';

        // if ownerId appears to be an admin account, ensure request includes a valid admin JWT
        if (ownerId.startsWith('admin')) {
          const authHeader = req.get('Authorization') || '';
          const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
          const admin = verifyAdminToken(token);
          if (!admin) {
            return res.status(401).json({ error: 'Unauthorized: valid admin token required' });
          }
        }

        // Validate required fields
        if (!ownerId || !title || !price || !category || !condition || !location) {
          return res.status(400).json({
            error: 'Missing required fields: userId, title, price, category, condition, location',
          });
        }

        // Check if user can create a listing (subscription limit check)
        // Skip check for admin accounts and coupon-based listings.
        // For starter-credit flow (no subscription ids provided), defer eligibility
        // to consumeStarterListingCredit() below so users without active plans can still post.
        if (!ownerId.startsWith('admin') && !couponCode) {
          if (userSubscriptionId) {
            // NEW: Per-subscription quota check
            const { canCreateListingWithSubscription } =
              await import('../services/subscription-tiers');
            const limitCheck = await canCreateListingWithSubscription(ownerId, userSubscriptionId);
            if (!limitCheck.allowed) {
              return res.status(403).json({
                error: limitCheck.reason,
                code: 'SUBSCRIPTION_LIMIT_REACHED',
                current: limitCheck.current,
                limit: limitCheck.limit,
                subscriptionName: limitCheck.subscriptionName,
              });
            }
          } else if (subscriptionTierId) {
            // OLD: Global quota check (fallback for backward compatibility)
            const limitCheck = await canUserCreateListing(ownerId);
            if (!limitCheck.allowed) {
              return res.status(403).json({
                error: limitCheck.reason,
                code: 'LISTING_LIMIT_REACHED',
                current: limitCheck.current,
                limit: limitCheck.limit,
              });
            }
          }
        }

        const imageItems = Array.isArray(images) ? images : [];
        const videoItems = Array.isArray(videos) ? videos : [];
        const allowedRemoteMediaHosts = getAllowedRemoteMediaHosts();

        // Reject local-device URIs: admin web cannot load them and they break moderation previews.
        if (imageItems.some((item) => hasLocalDeviceUri(item))) {
          return res.status(400).json({
            error:
              'One or more images are local device paths. Please reselect images and upload again.',
            code: 'INVALID_IMAGE_URI',
          });
        }

        if (videoItems.some((item) => hasLocalDeviceUri(item))) {
          return res.status(400).json({
            error:
              'One or more videos are local device paths. Please re-upload videos and try again.',
            code: 'INVALID_VIDEO_URI',
          });
        }

        const invalidImageUrls = findInvalidRemoteMediaUrls(imageItems, allowedRemoteMediaHosts);
        if (invalidImageUrls.length > 0) {
          return res.status(400).json({
            error: 'One or more image URLs are not from the approved Cloudflare R2 media domain.',
            code: 'INVALID_REMOTE_IMAGE_URL',
          });
        }

        const invalidVideoUrls = findInvalidRemoteMediaUrls(videoItems, allowedRemoteMediaHosts);
        if (invalidVideoUrls.length > 0) {
          return res.status(400).json({
            error: 'One or more video URLs are not from the approved Cloudflare R2 media domain.',
            code: 'INVALID_REMOTE_VIDEO_URL',
          });
        }

        // Validate image and video limits (max 5 each)
        const imageCount = imageItems.length;
        const videoCount = videoItems.length;

        if (imageCount > 5) {
          return res.status(400).json({
            error: 'Maximum 5 images allowed per listing',
          });
        }

        if (videoCount > 5) {
          return res.status(400).json({
            error: 'Maximum 5 videos allowed per listing',
          });
        }

        // If featured is requested, validate subscription tier allows it
        let isFeatured = featured;
        if (featured === true || featured === 'true') {
          if (!subscriptionTierId) {
            return res.status(403).json({
              error:
                'Featured listings require an active subscription. Please select a subscription tier that supports featured listings.',
              code: 'NO_SUBSCRIPTION_FOR_FEATURED',
            });
          }

          const tier = await getSubscriptionTierById(subscriptionTierId);
          if (!tier) {
            return res.status(400).json({
              error: 'Invalid subscription tier selected',
            });
          }

          const tierBoostCredits = Math.max(
            Number((tier as any).boostCredits || 0),
            Number(tier.featuredListingsPerMonth || 0)
          );
          if (tierBoostCredits <= 0) {
            return res.status(403).json({
              error: `Your subscription tier "${tier.name}" does not include listing boosts. Please upgrade to a plan with boost quota.`,
              tierName: tier.name,
              boostCredits: tierBoostCredits,
              code: 'TIER_NO_FEATURED',
            });
          }

          isFeatured = true;
        } else {
          isFeatured = false;
        }

        // Determine listing duration: either from subscription or coupon free listings
        let durationDays = 30; // default
        let isPaid = false;
        let isFreeFromCoupon = false;
        let couponFreeRemaining = 0;
        let isFreeFromStarterCredits = false;
        let starterListingsRemaining = 0;

        if (couponCode) {
          // User is using a coupon code for free listing
          const freeCheck = await getRemainingFreeListings(couponCode, ownerId);
          if (freeCheck.error || freeCheck.remaining <= 0) {
            return res.status(400).json({
              error: freeCheck.error || 'No free listings remaining on this coupon',
              code: 'NO_FREE_LISTINGS',
            });
          }
          durationDays = freeCheck.durationDays;
          isFreeFromCoupon = true;
          couponFreeRemaining = freeCheck.remaining;
        } else if (subscriptionTierId) {
          // User has an active subscription tier
          const tier = await getSubscriptionTierById(subscriptionTierId);
          if (tier) {
            durationDays = tier.durationDays || 30;
            isPaid = true;
          }
        } else {
          // No coupon and no subscription - consume starter credit if available.
          const starterConsume = await consumeStarterListingCredit(ownerId);
          if (!starterConsume) {
            return res.status(403).json({
              error:
                'A subscription, starter listing credit, or valid coupon code is required to create a listing.',
              code: 'SUBSCRIPTION_STARTER_OR_COUPON_REQUIRED',
            });
          }
          durationDays = 30;
          isPaid = false;
          isFreeFromStarterCredits = true;
          starterListingsRemaining = starterConsume.listingsRemaining;
        }

        const listingData: CreateListingRequest = {
          userId: ownerId,
          title,
          description,
          category,
          price: parseFloat(price as string),
          offerPrice:
            offerPrice !== undefined && offerPrice !== null
              ? parseFloat(offerPrice as string)
              : undefined,
          condition,
          location,
          priceUnit,
          listingType: listingType || 'image',
          pincode,
          latitude: latitude ? parseFloat(latitude as string) : undefined,
          longitude: longitude ? parseFloat(longitude as string) : undefined,
        };

        // Manual moderation workflow:
        // New listings are created as pending and require admin approval before going live.
        console.log('[Listings] Manual review mode active - skipping AI auto-moderation checks.');

        // Create the listing
        let createdListing: any = null;
        try {
          createdListing = await createListing({
            sellerId: ownerId,
            title: listingData.title,
            description: listingData.description || '',
            category: listingData.category,
            price: listingData.price.toString(),
            offerPrice: listingData.offerPrice?.toString(),
            priceUnit: listingData.priceUnit,
            condition: listingData.condition,
            location: listingData.location,
            pincode: listingData.pincode,
            latitude: listingData.latitude?.toString(),
            longitude: listingData.longitude?.toString(),
            images: imageItems,
            videos: videoItems,
            subscriptionTierId: subscriptionTierId || null,
            userSubscriptionId: userSubscriptionId || null, // NEW: Track which subscription instance
            featured: isFeatured,
            isPaid,
            durationDays,
            status: 'pending',
            isActive: false,
          });
        } catch (createError) {
          if (isFreeFromStarterCredits) {
            await releaseStarterListingCredit(ownerId).catch((rollbackError) => {
              console.error(
                '[Subscriptions] Failed to rollback starter listing credit after create failure:',
                rollbackError
              );
            });
          }
          throw createError;
        }

        // Notify admins that a listing is waiting for manual review
        notifyAdminListingPendingReview({
          listingId: createdListing.id,
          listingTitle: createdListing.title,
          userId: ownerId,
          location: listingData.location,
          category: listingData.category,
        }).catch((err) =>
          console.error('[Subscriptions] Failed to notify admins for pending listing:', err)
        );

        // If coupon was used, record the free listing usage
        if (isFreeFromCoupon && couponCode) {
          const useResult = await useFreeListingFromCoupon(couponCode, ownerId, createdListing.id);
          if (!useResult.success) {
            console.error(
              '[Subscriptions] Failed to record coupon free listing usage:',
              useResult.error
            );
          }
          couponFreeRemaining = useResult.remaining;
        }

        return res.json({
          success: true,
          isFree: isFreeFromCoupon || isFreeFromStarterCredits,
          requiresApproval: true,
          message: isFreeFromCoupon
            ? `✓ Listing submitted for review with coupon! ${couponFreeRemaining} free listing${couponFreeRemaining !== 1 ? 's' : ''} remaining.`
            : isFreeFromStarterCredits
              ? `✓ Listing submitted for review using starter credits. ${starterListingsRemaining} starter listing credit${starterListingsRemaining !== 1 ? 's' : ''} remaining.`
              : '✓ Listing submitted for admin review. It will go live after approval.',
          listing: {
            id: createdListing.id,
            title: createdListing.title,
            price: createdListing.price,
            isPaid,
            durationDays,
            status: createdListing.status,
            createdAt: createdListing.createdAt?.toISOString() || new Date().toISOString(),
            expiresAt: createdListing.expiresAt?.toISOString() || null,
          },
          coupon: isFreeFromCoupon
            ? {
                code: couponCode,
                freeListingsRemaining: couponFreeRemaining,
              }
            : undefined,
          starterCredits: isFreeFromStarterCredits
            ? {
                freeListingsRemaining: starterListingsRemaining,
              }
            : undefined,
        });
      } catch (error) {
        console.error('[Subscriptions] Error creating listing:', error);
        res.status(500).json({ error: 'Failed to create listing' });
      }
    }
  );

  /**
   * POST /api/subscriptions/checkout
   * Initiate Razorpay payment for listing with optional coupon
   * Body: { subscriptionId, userId, listingId?, listingTitle?, totalFee?, duration?, tierId?, couponCode? }
   */
  app.post('/api/subscriptions/checkout', async (req: Request, res: Response) => {
    try {
      const {
        subscriptionId,
        userId,
        listingId,
        listingTitle,
        totalFee,
        duration,
        tierId,
        couponCode,
      } = req.body;
      const authenticatedUserId = getAuthenticatedUserId(req);
      const ownerId = typeof userId === 'string' ? userId.trim() : '';
      const safeSubscriptionId = typeof subscriptionId === 'string' ? subscriptionId.trim() : '';
      const safeListingId =
        typeof listingId === 'string' && listingId.trim()
          ? listingId.trim()
          : `subscription-${safeSubscriptionId}`;
      const safeListingTitle =
        typeof listingTitle === 'string' && listingTitle.trim()
          ? listingTitle.trim()
          : 'Subscription Plan';

      if (!authenticatedUserId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      if (!safeSubscriptionId || !ownerId) {
        return res.status(400).json({ error: 'Missing required fields: subscriptionId, userId' });
      }

      if (ownerId !== authenticatedUserId) {
        return res.status(403).json({
          success: false,
          error: 'Authenticated user does not match checkout owner',
        });
      }

      const subscription = await getSubscriptionById(safeSubscriptionId);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
      }

      if (String(subscription.userId) !== authenticatedUserId) {
        return res.status(403).json({
          success: false,
          error: 'Subscription does not belong to authenticated user',
        });
      }

      if (tierId && tierId !== subscription.subscriptionTierId) {
        return res.status(400).json({
          success: false,
          error: 'Subscription tier mismatch for checkout',
        });
      }

      if (subscription.status === 'active' && subscription.paymentId) {
        return res.status(409).json({
          success: false,
          error: 'Subscription is already paid and active',
        });
      }

      const tierPriceRaw =
        subscription.tier.offerPrice != null
          ? subscription.tier.offerPrice
          : subscription.tier.price;
      const tierPrice = Number(tierPriceRaw);
      if (!Number.isFinite(tierPrice) || tierPrice < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subscription tier price',
        });
      }

      const clientTotalFee = Number(totalFee);
      const originalAmount = roundToTwo(tierPrice);
      let finalFee = originalAmount;
      let discountApplied = false;
      let discountPercentage = 0;
      let discountAmount = 0;
      let couponId: string | null = null;
      const effectiveDuration = Number(subscription.tier.durationDays || duration || 30);

      // Apply coupon if provided
      if (couponCode) {
        const discountResult = await applyCouponDiscount(
          couponCode,
          finalFee,
          authenticatedUserId,
          subscription.subscriptionTierId
        );

        if (discountResult.success) {
          discountApplied = true;
          finalFee = discountResult.finalAmount;
          discountPercentage = discountResult.discountPercentage;
          discountAmount = discountResult.discountAmount;

          // Get coupon ID for tracking
          const couponValidation = await validateCouponCode(
            couponCode,
            authenticatedUserId,
            subscription.subscriptionTierId
          );
          if (couponValidation.isValid && couponValidation.coupon) {
            couponId = couponValidation.coupon.id;
          }
        } else {
          // Invalid coupon, return error
          return res.status(400).json({
            success: false,
            error: discountResult.error || 'Invalid coupon code',
          });
        }
      }

      // Handle free subscriptions (free plan or 100% discounted plan)
      if (finalFee <= 0) {
        console.log(
          discountApplied
            ? `[Checkout] 100% discount applied with coupon ${couponCode} - bypassing payment`
            : `[Checkout] Zero-fee subscription (${safeSubscriptionId}) - bypassing payment`
        );

        // Activate subscription immediately for free subscriptions
        try {
          const { db } = await import('../../../data/db');
          const { userSubscriptions } = await import('../../admin/models/admin-settings');
          const { eq } = await import('drizzle-orm');

          await db
            .update(userSubscriptions)
            .set({
              status: 'active',
              orderId: 'FREE_SUBSCRIPTION',
              couponId,
              updatedAt: new Date(),
            })
            .where(eq(userSubscriptions.id, safeSubscriptionId));

          console.log('[Checkout] Free subscription activated:', safeSubscriptionId);
        } catch (activationError) {
          console.error('[Checkout] Failed to activate free subscription:', activationError);
        }

        // Record coupon usage (only when coupon is actually applied)
        if (couponCode && discountApplied) {
          await recordCouponUsage(
            couponCode,
            safeListingId,
            safeSubscriptionId,
            authenticatedUserId,
            discountAmount
          );
        }

        // Return special response for free subscription
        return res.json({
          success: true,
          isFree: true,
          message: discountApplied
            ? `🎉 100% discount applied! Your subscription is completely FREE for ${effectiveDuration} days`
            : `🎉 Free plan activated for ${effectiveDuration} days`,
          payment: {
            razorpayOrderId: 'FREE_SUBSCRIPTION',
            amount: 0,
            amountInRupees: 0,
            key: '',
            subscriptionId: safeSubscriptionId,
          },
          discount: discountApplied
            ? {
                percentage: discountPercentage,
                amount: discountAmount,
                originalAmount,
                finalAmount: 0,
                couponId,
              }
            : null,
          nextStep: 'No payment required - proceed directly to create listing',
        });
      }

      const paymentDetails = await initiatePayment(
        safeSubscriptionId,
        authenticatedUserId,
        safeListingId,
        safeListingTitle,
        finalFee,
        effectiveDuration as DurationOption
      );

      // Persist order/coupon context for verification integrity
      try {
        const { userSubscriptions } = await import('../../admin/models/admin-settings');
        const { eq } = await import('drizzle-orm');
        await db
          .update(userSubscriptions)
          .set({
            orderId: paymentDetails.razorpayOrderId,
            couponId,
            updatedAt: new Date(),
          })
          .where(eq(userSubscriptions.id, safeSubscriptionId));
      } catch (persistError) {
        console.error('[Checkout] Failed to persist pending order context:', persistError);
      }

      return res.json({
        success: true,
        message: discountApplied
          ? `Payment initiated with ${discountPercentage}% discount applied`
          : 'Payment initiated - use Razorpay to complete payment',
        payment: {
          razorpayOrderId: paymentDetails.razorpayOrderId,
          amount: paymentDetails.amount,
          amountInRupees: paymentDetails.amount / 100,
          key: paymentDetails.key,
          subscriptionId: paymentDetails.subscriptionId,
        },
        discount: discountApplied
          ? {
              percentage: discountPercentage,
              amount: discountAmount,
              originalAmount,
              finalAmount: finalFee,
              couponId,
            }
          : null,
        validation: Number.isFinite(clientTotalFee)
          ? {
              clientAmount: roundToTwo(clientTotalFee),
              serverAmount: originalAmount,
              sourceOfTruth: 'server-tier-pricing',
            }
          : {
              serverAmount: originalAmount,
              sourceOfTruth: 'server-tier-pricing',
            },
        nextStep:
          'Use razorpayOrderId to initiate payment in Razorpay checkout. After payment, verify with /api/subscriptions/verify-payment',
      });
    } catch (error) {
      console.error('[Subscriptions] Error initiating payment:', error);
      res.status(500).json({ error: 'Failed to initiate payment' });
    }
  });

  /**
   * POST /api/subscriptions/verify-payment
   * Verify Razorpay payment and activate subscription
   * Body: {
   *   razorpay_order_id, razorpay_payment_id, razorpay_signature,
   *   subscriptionId, couponCode?, listingId?,
   *   customerId?, customerName?, customerEmail?, customerPhone?,
   *   invoiceItems?, generateInvoice?
   * }
   */
  app.post('/api/subscriptions/verify-payment', async (req: Request, res: Response) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        subscriptionId,
        couponCode,
        listingId,
        // Invoice fields
        customerId: requestedCustomerId,
        customerName,
        customerEmail,
        customerPhone,
        generateInvoice,
      } = req.body;
      const authenticatedUserId = getAuthenticatedUserId(req);
      const safeSubscriptionId = typeof subscriptionId === 'string' ? subscriptionId.trim() : '';
      const safeListingId =
        typeof listingId === 'string' && listingId.trim()
          ? listingId.trim()
          : `subscription-${safeSubscriptionId}`;
      const customerId = requestedCustomerId || authenticatedUserId;

      if (!authenticatedUserId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !safeSubscriptionId
      ) {
        return res.status(400).json({
          error: 'Missing payment verification fields or subscription ID',
        });
      }

      const subscription = await getSubscriptionById(safeSubscriptionId);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
      }

      if (String(subscription.userId) !== authenticatedUserId) {
        return res.status(403).json({
          success: false,
          error: 'Subscription does not belong to authenticated user',
        });
      }

      if (requestedCustomerId && requestedCustomerId !== authenticatedUserId) {
        return res.status(403).json({
          success: false,
          error: 'customerId does not match authenticated user',
        });
      }

      // Idempotency: same payment can be acknowledged safely.
      if (
        subscription.status === 'active' &&
        subscription.paymentId === razorpay_payment_id &&
        subscription.orderId === razorpay_order_id
      ) {
        return res.json({
          success: true,
          message: '✓ Payment already verified',
          subscriptionId: safeSubscriptionId,
          subscriptionActivated: true,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          invoice: null,
          invoiceGenerated: false,
          idempotent: true,
        });
      }

      if (
        subscription.status === 'active' &&
        subscription.paymentId &&
        subscription.paymentId !== razorpay_payment_id
      ) {
        return res.status(409).json({
          success: false,
          error: 'Subscription has already been activated with a different payment',
        });
      }

      // Verify payment signature
      const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

      if (!isValid) {
        // Send payment failure notification
        if (customerId) {
          const tierPriceRaw =
            subscription.tier.offerPrice != null
              ? subscription.tier.offerPrice
              : subscription.tier.price;
          const amount = Number(tierPriceRaw);
          notifyPaymentFailed(customerId, amount, 'Invalid payment signature').catch((err) =>
            console.error('[Subscriptions] Failed to send payment failed notification:', err)
          );
        }

        return res.status(400).json({
          success: false,
          error: 'Payment verification failed - invalid signature',
          message: 'This payment appears to be fraudulent. Please contact support.',
        });
      }

      const tierPriceRaw =
        subscription.tier.offerPrice != null
          ? subscription.tier.offerPrice
          : subscription.tier.price;
      const originalAmount = roundToTwo(Number(tierPriceRaw));
      if (!Number.isFinite(originalAmount) || originalAmount < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subscription tier price',
        });
      }

      let expectedFinalAmount = originalAmount;
      let expectedDiscountAmount = 0;
      let expectedDiscountPercentage = 0;
      let couponApplied = false;
      if (couponCode) {
        const discountResult = await applyCouponDiscount(
          couponCode,
          originalAmount,
          authenticatedUserId,
          subscription.subscriptionTierId
        );
        if (!discountResult.success) {
          return res.status(400).json({
            success: false,
            error: discountResult.error || 'Invalid coupon code',
          });
        }
        couponApplied = true;
        expectedFinalAmount = roundToTwo(discountResult.finalAmount);
        expectedDiscountAmount = roundToTwo(discountResult.discountAmount);
        expectedDiscountPercentage = discountResult.discountPercentage;
      }

      const expectedAmountPaise = Math.round(expectedFinalAmount * 100);
      const razorpay = getRazorpayService();
      const paymentDetails = await razorpay.getPaymentDetails(razorpay_payment_id);
      const paymentAmountPaise = Number(paymentDetails?.amount || 0);
      const paymentOrderId = String(paymentDetails?.order_id || '');
      const paymentCurrency = String(paymentDetails?.currency || '');
      const paymentStatus = String(paymentDetails?.status || '');

      if (paymentOrderId !== razorpay_order_id) {
        return res.status(400).json({
          success: false,
          error: 'Payment order mismatch',
        });
      }

      if (
        subscription.orderId &&
        subscription.orderId !== 'FREE_SUBSCRIPTION' &&
        subscription.orderId !== razorpay_order_id
      ) {
        return res.status(400).json({
          success: false,
          error: 'Order ID does not match checkout order for this subscription',
        });
      }

      if (paymentCurrency !== 'INR') {
        return res.status(400).json({
          success: false,
          error: 'Invalid payment currency',
        });
      }

      if (!['captured', 'authorized'].includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          error: `Payment status is not valid for activation (${paymentStatus || 'unknown'})`,
        });
      }

      if (paymentAmountPaise !== expectedAmountPaise) {
        if (customerId) {
          notifyPaymentFailed(
            customerId,
            expectedFinalAmount,
            `Amount mismatch (expected ${expectedAmountPaise}, got ${paymentAmountPaise})`
          ).catch((err) =>
            console.error('[Subscriptions] Failed to send payment failed notification:', err)
          );
        }
        return res.status(400).json({
          success: false,
          error: 'Payment amount mismatch',
          expectedAmountPaise,
          paidAmountPaise: paymentAmountPaise,
        });
      }

      const paymentNotesUserId = String(paymentDetails?.notes?.userId || '').trim();
      const paymentNotesSubscriptionId = String(paymentDetails?.notes?.subscriptionId || '').trim();
      if (paymentNotesUserId && paymentNotesUserId !== authenticatedUserId) {
        return res.status(400).json({
          success: false,
          error: 'Payment notes user mismatch',
        });
      }
      if (paymentNotesSubscriptionId && paymentNotesSubscriptionId !== safeSubscriptionId) {
        return res.status(400).json({
          success: false,
          error: 'Payment notes subscription mismatch',
        });
      }

      const invoiceItemDescription = `${subscription.tier.name} Plan - ${subscription.tier.durationDays} Days`;
      const serverInvoiceItems = [
        {
          description: invoiceItemDescription,
          quantity: 1,
          unitPrice: expectedFinalAmount,
          amount: expectedFinalAmount,
        },
      ];

      // Record coupon usage if applicable
      if (couponCode && couponApplied && customerId && expectedDiscountAmount > 0) {
        const usageResult = await recordCouponUsage(
          couponCode,
          safeListingId,
          safeSubscriptionId,
          customerId,
          expectedDiscountAmount
        );

        if (!usageResult.success) {
          console.error('[Subscriptions] Failed to record coupon usage:', usageResult.error);
          // Don't fail the payment verification if coupon recording fails
          // Just log it and continue
        } else if (customerId) {
          // Send coupon applied notification
          notifyCouponApplied(
            customerId,
            couponCode,
            expectedDiscountAmount,
            invoiceItemDescription
          ).catch((err) =>
            console.error('[Subscriptions] Failed to send coupon notification:', err)
          );
        }
      }

      // Generate invoice if requested and customer info is provided
      let invoiceData: any = null;
      if (generateInvoice && customerId && customerName && customerEmail && customerPhone) {
        try {
          console.log('[Subscriptions] Generating invoice for customer:', customerName);
          const InvoiceService = (await import('../../users/services/invoice')).default;
          const invoiceService = new InvoiceService(InvoiceService.createSynvideConfig());

          // Financial source of truth comes from server-side computed amount.
          const items = serverInvoiceItems;

          invoiceData = invoiceService.createInvoice(
            customerName,
            customerEmail,
            customerPhone,
            items,
            {
              paymentMethod: 'Razorpay',
              paymentId: razorpay_payment_id,
              orderId: razorpay_order_id,
              notes: subscriptionId ? `Subscription ID: ${subscriptionId}` : undefined,
            }
          );

          console.log('[Subscriptions] Invoice generated successfully:', invoiceData.invoiceNumber);

          // Persist invoice for later view/download/history
          try {
            const { db } = await import('../../../data/db');
            const { invoices } = await import('../../admin/models/admin-settings');
            const dueDate = invoiceData?.dueDate ? new Date(invoiceData.dueDate) : new Date();

            await db.insert(invoices).values({
              invoiceNumber: invoiceData.invoiceNumber,
              customerId: customerId,
              customerName: customerName,
              customerEmail: customerEmail,
              customerPhone: customerPhone,
              subscriptionId: safeSubscriptionId,
              orderId: razorpay_order_id || null,
              paymentId: razorpay_payment_id || null,
              paymentMethod: 'Razorpay',
              subtotal: String(invoiceData.subtotal || 0),
              sgst: String(invoiceData.sgst || 0),
              cgst: String(invoiceData.cgst || 0),
              igst: String(invoiceData.igst || 0),
              totalAmount: String(invoiceData.total || 0),
              items: JSON.stringify(invoiceData.items || []),
              invoiceData: JSON.stringify(invoiceData),
              status: 'paid',
              dueDate,
            } as any);
          } catch (saveError) {
            console.error('[Subscriptions] Failed to persist invoice record:', saveError);
          }

          // Send invoice notification
          if (customerId && invoiceData) {
            const invoiceUrl = `/api/invoices/${invoiceData.invoiceNumber}/view?data=${encodeURIComponent(JSON.stringify(invoiceData))}`;
            notifyInvoiceGenerated(
              customerId,
              invoiceData.invoiceNumber,
              invoiceData.total,
              invoiceUrl
            ).catch((err) =>
              console.error('[Subscriptions] Failed to send invoice notification:', err)
            );
          }
        } catch (invoiceError) {
          console.error(
            '[Subscriptions] Failed to generate invoice - Error details:',
            invoiceError
          );
          if (invoiceError instanceof Error) {
            console.error('[Subscriptions] Invoice error stack:', invoiceError.stack);
          }
          // Don't fail payment verification if invoice generation fails
        }
      } else {
        console.log('[Subscriptions] Skipping invoice generation - Missing required fields:', {
          generateInvoice,
          hasCustomerId: !!customerId,
          hasCustomerName: !!customerName,
          hasCustomerEmail: !!customerEmail,
          hasCustomerPhone: !!customerPhone,
        });
      }

      // Activate subscription after successful payment verification
      try {
        console.log('[Subscriptions] Activating subscription:', safeSubscriptionId);
        const { userSubscriptions } = await import('../../admin/models/admin-settings');
        const { eq } = await import('drizzle-orm');

        const updateResult = await db
          .update(userSubscriptions)
          .set({
            status: 'active',
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            updatedAt: new Date(),
          })
          .where(eq(userSubscriptions.id, safeSubscriptionId))
          .returning();

        console.log(
          '[Subscriptions] Subscription activation result:',
          updateResult.length > 0 ? 'SUCCESS' : 'FAILED'
        );
        if (updateResult.length > 0) {
          console.log('[Subscriptions] Updated subscription:', {
            id: updateResult[0].id,
            status: updateResult[0].status,
            userId: updateResult[0].userId,
          });
        } else {
          console.error('[Subscriptions] No subscription found with ID:', safeSubscriptionId);
        }
      } catch (activationError) {
        console.error('[Subscriptions] Failed to activate subscription:', activationError);
        if (activationError instanceof Error) {
          console.error('[Subscriptions] Activation error stack:', activationError.stack);
        }
        // Don't fail the verification, just log the error
      }

      // Send payment success notification
      if (customerId) {
        notifyPaymentSuccess(
          customerId,
          expectedFinalAmount,
          razorpay_payment_id,
          invoiceItemDescription
        ).catch((err) =>
          console.error('[Subscriptions] Failed to send payment success notification:', err)
        );
      }

      // Payment verified successfully
      console.log('[Subscriptions] Payment verification complete:', {
        subscriptionId: safeSubscriptionId,
        invoicegenerated: !!invoiceData,
        invoiceNumber: invoiceData?.invoiceNumber,
      });

      return res.json({
        success: true,
        message: couponApplied
          ? '✓ Payment verified successfully with coupon discount applied'
          : '✓ Payment verified successfully',
        subscriptionId: safeSubscriptionId,
        subscriptionActivated: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: expectedFinalAmount,
        discount: couponApplied
          ? {
              percentage: expectedDiscountPercentage,
              amount: expectedDiscountAmount,
            }
          : null,
        nextStep: 'Subscription is now active - refresh to see updated quota',
        invoice: invoiceData || null,
        invoiceGenerated: !!invoiceData,
        invoiceHtmlUrl: invoiceData
          ? `/api/invoices/${invoiceData.invoiceNumber}/view?data=${encodeURIComponent(JSON.stringify(invoiceData))}`
          : null,
        invoiceDownloadUrl: invoiceData
          ? `/api/invoices/${invoiceData.invoiceNumber}/download?data=${encodeURIComponent(JSON.stringify(invoiceData))}`
          : null,
      });
    } catch (error) {
      console.error('[Subscriptions] Error verifying payment:', error);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  /**
   * GET /api/subscriptions/tiers
   * Get available subscription tiers for users
   */
  app.get('/api/subscriptions/tiers', async (_req: Request, res: Response) => {
    try {
      const tiers = await getActiveSubscriptionTiers();

      return res.json({
        success: true,
        tiers: tiers.map((tier) => ({
          ...tier,
          features: typeof tier.features === 'string' ? JSON.parse(tier.features) : tier.features,
        })),
      });
    } catch (error) {
      console.error('[Subscriptions] Error fetching tiers:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription tiers',
      });
    }
  });

  /**
   * GET /api/subscriptions/:subscriptionId
   * Get subscription details
   */
  app.get(
    '/api/subscriptions/:subscriptionId',
    async (req: Request, res: Response, next: NextFunction) => {
      if (req.params.subscriptionId === 'tiers') {
        return next();
      }

      try {
        const subscriptionId = req.params.subscriptionId as string;

        // Fetch subscription with tier details
        const subscription = await getSubscriptionById(subscriptionId);

        if (!subscription) {
          return res.status(404).json({ success: false, error: 'Subscription not found' });
        }

        return res.json({
          success: true,
          id: subscription.id,
          userId: subscription.userId,
          tierId: subscription.subscriptionTierId,
          status: subscription.status,
          expiresAt: subscription.expiresAt,
          startDate: subscription.subscribedAt,
          subscribedAt: subscription.subscribedAt,
          autoRenew: subscription.autoRenew,
          tier: {
            id: subscription.tier.id,
            name: subscription.tier.name,
            type: (subscription.tier as any).type || 'bundle',
            price: subscription.tier.price,
            durationDays: subscription.tier.durationDays,
            maxListings: subscription.tier.maxListings,
            featuredListingsPerMonth: subscription.tier.featuredListingsPerMonth,
            boostCredits: Number((subscription.tier as any).boostCredits || 0),
          },
          boostsRemaining: Number((subscription as any).boostsRemaining || 0),
        });
      } catch (error) {
        console.error('[Subscriptions] Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
      }
    }
  );

  /**
   * POST /api/subscriptions/webhook/razorpay
   * Razorpay webhook for payment notifications
   */
  app.post('/api/subscriptions/webhook/razorpay', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;

      const razorpay = getRazorpayService();

      // Verify against exact raw payload for Razorpay signature correctness.
      const payloadString =
        typeof (req as any).rawBody === 'string'
          ? ((req as any).rawBody as string)
          : typeof req.body === 'string'
            ? req.body
            : JSON.stringify(req.body);

      const isValid = razorpay.verifyWebhookSignature(payloadString, signature);

      if (!isValid) {
        console.warn('[Razorpay Webhook] Invalid signature');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      const event = req.body.event;
      const data = req.body.data;

      switch (event) {
        case 'payment.authorized':
          // Payment authorized
          console.log(`[Razorpay] Payment authorized: ${data.payment.id}`);
          // TODO: Update subscription status to 'completed'
          break;

        case 'payment.failed':
          // Payment failed
          console.log(`[Razorpay] Payment failed: ${data.payment.id}`);
          // TODO: Update subscription status to 'failed'
          // Send payment failed notification if user info available
          if (data.payment?.notes?.userId) {
            notifyPaymentFailed(
              data.payment.notes.userId,
              data.payment.amount / 100,
              data.payment.error_description || 'Payment failed'
            ).catch((err) =>
              console.error('[Webhook] Failed to send payment failed notification:', err)
            );
          }
          break;

        case 'payment.captured':
          // Payment captured
          console.log(`[Razorpay] Payment captured: ${data.payment.id}`);
          // TODO: Activate subscription listing
          break;

        case 'refund.created':
          // Refund initiated
          console.log(`[Razorpay] Refund created: ${data.refund.id}`);
          // TODO: Update subscription refund status
          break;

        default:
          console.log(`[Razorpay] Unhandled event: ${event}`);
      }

      // Always return 200 to acknowledge receipt
      return res.json({ success: true });
    } catch (error) {
      console.error('[Razorpay Webhook] Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  const getUserListingsHandler = async (
    req: Request,
    res: Response,
    ownerIdParam: string
  ): Promise<void> => {
    try {
      const listings = await getListingsByUser(ownerIdParam);
      const sellerMetaMap = await getSellerMetaMap(listings.map((listing) => listing.sellerId));
      const formattedListings = listings.map((listing) => toPublicListing(listing, sellerMetaMap));

      // Attach latest rejection reason for rejected listings so seller can edit + resubmit
      const rejectedListingIds = formattedListings
        .filter((l) => l.status === 'rejected')
        .map((l) => l.id)
        .filter(Boolean);
      const rejectedUserIds = [
        ...new Set(
          formattedListings
            .filter((l) => l.status === 'rejected')
            .map((l) => String(l.sellerId).trim())
            .filter(Boolean)
        ),
      ];

      const rejectionReasonByListingId = new Map<string, string>();
      if (rejectedListingIds.length > 0) {
        try {
          const { inAppNotifications } = await import('../../admin/models/admin-settings');
          const { and, eq, inArray, desc } = await import('drizzle-orm');
          const rejectionNotifications = await db
            .select({
              referenceId: inAppNotifications.referenceId,
              message: inAppNotifications.message,
            })
            .from(inAppNotifications)
            .where(
              and(
                inArray(
                  inAppNotifications.userId,
                  rejectedUserIds.length > 0 ? rejectedUserIds : [ownerIdParam]
                ),
                eq(inAppNotifications.category, 'listing_rejection'),
                inArray(inAppNotifications.referenceId, rejectedListingIds)
              )
            )
            .orderBy(desc(inAppNotifications.createdAt));

          for (const row of rejectionNotifications) {
            const refId = String(row.referenceId || '');
            const msg = String(row.message || '').trim();
            if (!refId || !msg || rejectionReasonByListingId.has(refId)) continue;
            rejectionReasonByListingId.set(refId, msg);
          }
        } catch (error) {
          console.error('[Subscriptions] Failed to load rejection reasons:', error);
        }
      }

      const listingsWithRejectionReason = formattedListings.map((listing) => ({
        ...listing,
        rejectionReason:
          listing.status === 'rejected' ? rejectionReasonByListingId.get(listing.id) || null : null,
      }));

      const activeListings = listingsWithRejectionReason.filter(
        (l) => l.status === 'active' && l.isActive
      );

      res.json({
        success: true,
        userId: ownerIdParam,
        listings: listingsWithRejectionReason,
        totalListings: listingsWithRejectionReason.length,
        activeListings,
        total: activeListings.length,
      });
      return;
    } catch (error) {
      console.error('[Subscriptions] Error fetching user listings:', error);
      res.status(500).json({ error: 'Failed to fetch user listings' });
    }
  };

  /**
   * GET /api/subscriptions/user/:userId/listings
   * Get user listings (all + active subset)
   */
  app.get('/api/subscriptions/user/:userId/listings', async (req: Request, res: Response) => {
    await getUserListingsHandler(req, res, String(req.params.userId || ''));
  });

  /**
   * GET /api/subscriptions/user/:userId/active
   * Get active user listings
   */
  app.get('/api/subscriptions/user/:userId/active', async (req: Request, res: Response) => {
    await getUserListingsHandler(req, res, String(req.params.userId || ''));
  });

  /**
   * POST /api/subscriptions/:subscriptionId/renew
   * Renew a listing subscription
   */
  app.post('/api/subscriptions/:subscriptionId/renew', async (req: Request, res: Response) => {
    try {
      const { subscriptionId } = req.params;
      const { duration } = req.body;

      // TODO: Process renewal
      return res.json({
        success: true,
        message: 'Subscription renewal initiated',
        subscriptionId,
        duration,
      });
    } catch (error) {
      console.error('[Subscriptions] Error renewing subscription:', error);
      res.status(500).json({ error: 'Failed to renew subscription' });
    }
  });

  /**
   * GET /api/admin/subscription-tiers
   * Get all subscription tiers (admin only)
   */
  app.get('/api/admin/subscription-tiers', async (req: Request, res: Response) => {
    try {
      const tiers = await getActiveSubscriptionTiers();
      const allTiers = await (async () => {
        const { db } = await import('../../../data/db');
        const { subscriptionTiers } = await import('../../admin/models/admin-settings');
        return await db.select().from(subscriptionTiers).orderBy(subscriptionTiers.price);
      })();

      // Prevent caching to ensure fresh data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.json({
        success: true,
        tiers: allTiers.map((tier) => ({
          ...tier,
          features: typeof tier.features === 'string' ? JSON.parse(tier.features) : tier.features,
        })),
      });
    } catch (error) {
      console.error('[Admin] Error fetching subscription tiers:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription tiers',
      });
    }
  });

  /**
   * POST /api/admin/subscription-tiers
   * Create new subscription tier (admin only)
   */
  app.post('/api/admin/subscription-tiers', async (req: Request, res: Response) => {
    try {
      // Accept both snake_case (from old clients) and camelCase (from frontend)
      const {
        name,
        type,
        duration_days,
        durationDays,
        price,
        offer_price,
        offerPrice,
        features,
        max_listings,
        maxListings,
        featured_listings_per_month,
        featuredListingsPerMonth,
        boost_credits,
        boostCredits,
        highlight,
        is_active,
        isActive,
      } = req.body;

      // Use camelCase values as fallback
      const finalDurationDays = duration_days !== undefined ? duration_days : durationDays;
      const finalMaxListings = max_listings !== undefined ? max_listings : maxListings;
      const finalFeaturedListings =
        featured_listings_per_month !== undefined
          ? featured_listings_per_month
          : (featuredListingsPerMonth ?? 0);
      const finalOfferPrice = offer_price !== undefined ? offer_price : offerPrice;
      const finalType = type || 'bundle';
      const finalBoostCredits = boost_credits !== undefined ? boost_credits : (boostCredits ?? 0);
      const finalIsActive = is_active !== undefined ? is_active : isActive;

      if (!name || !finalDurationDays || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, durationDays, price',
        });
      }

      const numericPrice = parseFloat(price);
      const parsedOfferPrice =
        finalOfferPrice !== undefined && finalOfferPrice !== null && `${finalOfferPrice}` !== ''
          ? parseFloat(finalOfferPrice)
          : undefined;
      const numericOfferPrice =
        parsedOfferPrice !== undefined && Number.isFinite(parsedOfferPrice) && parsedOfferPrice > 0
          ? parsedOfferPrice
          : undefined;

      if (
        numericOfferPrice !== undefined &&
        (numericOfferPrice <= 0 || numericOfferPrice >= numericPrice)
      ) {
        return res.status(400).json({
          success: false,
          error: 'offerPrice must be greater than 0 and less than price',
        });
      }

      const f = features as any;
      const featuresStr = typeof f === 'string' ? f : JSON.stringify(f || []);
      const newTier = await createSubscriptionTier({
        name,
        type: finalType,
        durationDays: parseInt(finalDurationDays) as any,
        price: numericPrice as any,
        offerPrice: numericOfferPrice as any,
        features: featuresStr as any,
        description: name,
        maxListings: finalMaxListings ? parseInt(finalMaxListings) : 10,
        featuredListingsPerMonth: parseInt(finalFeaturedListings.toString()),
        boostCredits: parseInt(String(finalBoostCredits || 0), 10),
        monthlyPrice: numericPrice as any,
        annualPrice: numericPrice as any,
        highlight: highlight === true,
        isActive: finalIsActive !== false,
      } as any);

      return res.json({
        success: true,
        tier: {
          ...newTier,
          features:
            typeof (newTier.features as any) === 'string'
              ? JSON.parse(newTier.features as string)
              : newTier.features,
        },
      });
    } catch (error) {
      console.error('[Admin] Error creating subscription tier:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create subscription tier',
      });
    }
  });

  /**
   * PUT /api/admin/subscription-tiers/:id
   * Update subscription tier (admin only)
   */
  app.put('/api/admin/subscription-tiers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tierId = typeof id === 'string' ? id : id[0];
      // Accept both snake_case (from old clients) and camelCase (from frontend)
      const {
        name,
        type,
        duration_days,
        durationDays,
        price,
        offer_price,
        offerPrice,
        features,
        max_listings,
        maxListings,
        featured_listings_per_month,
        featuredListingsPerMonth,
        boost_credits,
        boostCredits,
        highlight,
        is_active,
        isActive,
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (type !== undefined) updateData.type = type;
      if (price !== undefined) {
        updateData.price = parseFloat(price);
        updateData.monthlyPrice = parseFloat(price);
        updateData.annualPrice = parseFloat(price);
      }
      if (offer_price !== undefined || offerPrice !== undefined) {
        const nextOffer = offer_price !== undefined ? offer_price : offerPrice;
        if (nextOffer === null || `${nextOffer}` === '') {
          updateData.offerPrice = null;
        } else {
          const parsedNextOffer = parseFloat(nextOffer as any);
          updateData.offerPrice =
            Number.isFinite(parsedNextOffer) && parsedNextOffer > 0 ? parsedNextOffer : null;
        }
      }
      if (duration_days !== undefined || durationDays !== undefined) {
        updateData.durationDays = parseInt((duration_days || durationDays) as any);
      }
      if (max_listings !== undefined || maxListings !== undefined) {
        updateData.maxListings = parseInt((max_listings || maxListings) as any);
      }
      if (featured_listings_per_month !== undefined || featuredListingsPerMonth !== undefined) {
        updateData.featuredListingsPerMonth = parseInt(
          (featured_listings_per_month ?? featuredListingsPerMonth ?? 0).toString()
        );
      }
      if (boost_credits !== undefined || boostCredits !== undefined) {
        updateData.boostCredits = parseInt((boost_credits ?? boostCredits ?? 0).toString());
      }
      if (features !== undefined) {
        updateData.features = typeof features === 'string' ? features : JSON.stringify(features);
      }
      if (highlight !== undefined) updateData.highlight = highlight;
      if (is_active !== undefined || isActive !== undefined) {
        updateData.isActive = is_active !== undefined ? is_active : isActive;
      }

      let effectivePrice = updateData.price ?? (price !== undefined ? Number(price) : undefined);
      if (effectivePrice === undefined && updateData.offerPrice !== undefined) {
        const existingTier = await getSubscriptionTierById(tierId);
        effectivePrice = existingTier ? Number(existingTier.price) : undefined;
      }
      if (
        updateData.offerPrice !== undefined &&
        updateData.offerPrice !== null &&
        !(
          updateData.offerPrice > 0 &&
          effectivePrice !== undefined &&
          updateData.offerPrice < Number(effectivePrice)
        )
      ) {
        return res.status(400).json({
          success: false,
          error: 'offerPrice must be greater than 0 and less than price',
        });
      }

      const updatedTier = await updateSubscriptionTier(tierId, updateData as any);

      if (!updatedTier) {
        return res.status(404).json({
          success: false,
          error: 'Subscription tier not found',
        });
      }

      return res.json({
        success: true,
        tier: {
          ...updatedTier,
          features:
            typeof (updatedTier.features as any) === 'string'
              ? JSON.parse(updatedTier.features as string)
              : updatedTier.features,
        },
      });
    } catch (error) {
      console.error('[Admin] Error updating subscription tier:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update subscription tier',
      });
    }
  });

  /**
   * DELETE /api/admin/subscription-tiers/:id
   * Delete subscription tier (admin only)
   */
  app.delete('/api/admin/subscription-tiers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tierId = typeof id === 'string' ? id : id[0];
      const deleted = await deleteSubscriptionTier(tierId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Subscription tier not found',
        });
      }

      return res.json({
        success: true,
        message: 'Subscription tier deleted',
      });
    } catch (error) {
      if (error instanceof SubscriptionTierInUseError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          details: error.details,
          action: 'deactivate_tier_instead',
        });
      }
      console.error('[Admin] Error deleting subscription tier:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete subscription tier',
      });
    }
  });

  /**
   * GET /api/subscriptions/boost/summary
   * Returns remaining boost credits across active subscriptions
   */
  app.get('/api/subscriptions/boost/summary', async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const summary = await getUserBoostCreditsSummary(String(userId));
      const starterSummary = await getStarterCreditsSummary(String(userId));
      return res.json({
        success: true,
        totalBoostCredits: summary.total + starterSummary.boostsRemaining,
        bySubscription: summary.bySubscription,
        starterCredits: {
          boostsRemaining: starterSummary.boostsRemaining,
          boostsTotal: starterSummary.boostsTotal,
        },
      });
    } catch (error) {
      console.error('[Boost] Error fetching boost summary:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch boost summary' });
    }
  });

  /**
   * GET /api/subscriptions/boost/plans
   * Returns active boost-pack tiers
   */
  app.get('/api/subscriptions/boost/plans', async (_req: Request, res: Response) => {
    try {
      const tiers = await getActiveSubscriptionTiers();
      const boostPlans = tiers
        .filter((tier: any) => String(tier.type || 'bundle') === 'boost')
        .map((tier: any) => {
          const regularPrice = Number(tier.price || 0);
          const offerPrice = Number(tier.offerPrice);
          const finalPrice =
            Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < regularPrice
              ? offerPrice
              : regularPrice;
          return {
            ...tier,
            features: typeof tier.features === 'string' ? JSON.parse(tier.features) : tier.features,
            finalPrice,
          };
        })
        .sort((a: any, b: any) => Number(a.finalPrice) - Number(b.finalPrice));

      return res.json({ success: true, plans: boostPlans });
    } catch (error) {
      console.error('[Boost] Error fetching boost plans:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch boost plans' });
    }
  });

  /**
   * POST /api/subscriptions/listings/:listingId/boost
   * Consumes 1 boost credit and boosts listing for 24h
   */
  app.post('/api/subscriptions/listings/:listingId/boost', async (req: Request, res: Response) => {
    try {
      const listingId = String(req.params.listingId || '');
      const userId = getRequestUserId(req);

      if (!listingId) {
        return res.status(400).json({ success: false, error: 'Listing ID is required' });
      }

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const listing = await getListingById(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }

      const isOwner = listing.sellerId === userId;

      if (!isOwner) {
        return res
          .status(403)
          .json({ success: false, error: 'You can only boost your own listing' });
      }

      if (listing.status !== 'active' || listing.isActive !== true) {
        return res.status(400).json({
          success: false,
          error: 'Only active listings can be boosted',
        });
      }

      if (listing.boostedUntil && new Date(listing.boostedUntil) > new Date()) {
        return res.status(409).json({
          success: false,
          code: 'LISTING_ALREADY_BOOSTED',
          error:
            'This listing is already boosted. You can boost again after current boost expires.',
          boostedUntil: listing.boostedUntil,
        });
      }

      const effectiveUserId = String(userId);
      const consumed = await consumeUserBoostCredit(effectiveUserId);
      const starterConsumed = !consumed ? await consumeStarterBoostCredit(effectiveUserId) : null;
      if (!consumed && !starterConsumed) {
        const tiers = await getActiveSubscriptionTiers();
        const plans = tiers
          .filter((tier: any) => String(tier.type || 'bundle') === 'boost')
          .map((tier: any) => ({
            id: tier.id,
            name: tier.name,
            durationDays: tier.durationDays,
            boostCredits: Number((tier as any).boostCredits || 0),
            price: Number(tier.price || 0),
            offerPrice: tier.offerPrice ? Number(tier.offerPrice) : null,
          }));

        return res.status(402).json({
          success: false,
          code: 'BOOST_CREDITS_EXHAUSTED',
          error: 'No boost credits remaining. Purchase a boost pack to continue.',
          plans,
        });
      }

      const boosted = await boostListingForHours(listingId, 24);
      if (!boosted) {
        return res.status(500).json({ success: false, error: 'Failed to boost listing' });
      }

      return res.json({
        success: true,
        listingId,
        boostedUntil: boosted.boostedUntil,
        boostsRemaining: consumed ? consumed.boostsRemaining : starterConsumed!.boostsRemaining,
        usedSubscriptionId: consumed?.subscriptionId || null,
        usedStarterCredits: !consumed && !!starterConsumed,
        message: 'Listing boosted for 24 hours',
      });
    } catch (error) {
      console.error('[Boost] Error boosting listing:', error);
      return res.status(500).json({ success: false, error: 'Failed to boost listing' });
    }
  });

  /**
   * POST /api/subscriptions/boost/checkout
   * Create payment order for boost pack purchase
   */
  app.post('/api/subscriptions/boost/checkout', async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { tierId } = req.body;
      if (!tierId) {
        return res.status(400).json({ success: false, error: 'tierId is required' });
      }

      const tier = await getSubscriptionTierById(String(tierId));
      if (!tier || String((tier as any).type || 'bundle') !== 'boost') {
        return res.status(400).json({ success: false, error: 'Invalid boost tier selected' });
      }

      const regularPrice = Number(tier.price || 0);
      const offerPrice = Number((tier as any).offerPrice);
      const finalPrice =
        Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < regularPrice
          ? offerPrice
          : regularPrice;

      if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid boost plan price' });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(tier.durationDays || 30));
      const subscription = await createUserSubscription(String(userId), tier.id, expiresAt);

      const amountInPaise = Math.round(finalPrice * 100);
      const razorpay = getRazorpayService();
      const receipt = razorpay.generateReceiptId(String(userId), `boost-${subscription.id}`);
      const order = await razorpay.createOrder({
        amount: amountInPaise,
        receipt,
        notes: {
          userId: String(userId),
          listingId: 'boost-pack',
          subscriptionId: subscription.id,
          listingTitle: tier.name,
          duration: Number(tier.durationDays || 30),
        },
      });

      return res.json({
        success: true,
        subscriptionId: subscription.id,
        payment: {
          razorpayOrderId: order.id,
          amount: order.amount,
          amountInRupees: order.amount / 100,
          key: process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY || '',
        },
        plan: {
          id: tier.id,
          name: tier.name,
          boostCredits: Number((tier as any).boostCredits || 0),
          durationDays: tier.durationDays,
          price: finalPrice,
        },
      });
    } catch (error) {
      console.error('[Boost] Error creating boost checkout:', error);
      return res.status(500).json({ success: false, error: 'Failed to initiate boost payment' });
    }
  });

  /**
   * POST /api/subscriptions/boost/verify-payment
   * Verify boost payment and activate boost credits. Optionally applies one boost immediately.
   */
  app.post('/api/subscriptions/boost/verify-payment', async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const {
        subscriptionId,
        tierId,
        listingId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      if (
        !subscriptionId ||
        !tierId ||
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res
          .status(400)
          .json({ success: false, error: 'Missing payment verification fields' });
      }

      const isValidPayment = verifyPayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );
      if (!isValidPayment) {
        return res.status(400).json({ success: false, error: 'Payment verification failed' });
      }

      const tier = await getSubscriptionTierById(String(tierId));
      if (!tier || String((tier as any).type || 'bundle') !== 'boost') {
        return res.status(400).json({ success: false, error: 'Invalid boost tier selected' });
      }

      const creditsToAdd = Number((tier as any).boostCredits || tier.featuredListingsPerMonth || 0);
      if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
        return res.status(400).json({ success: false, error: 'Boost plan has no boost credits' });
      }

      const { db } = await import('../../../data/db');
      const { userSubscriptions } = await import('../../admin/models/admin-settings');
      const { eq } = await import('drizzle-orm');

      await db
        .update(userSubscriptions)
        .set({
          status: 'active',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, String(subscriptionId)));

      const updatedSubscription = await addBoostCreditsToSubscription(
        String(subscriptionId),
        creditsToAdd
      );

      let immediateBoost: any = null;
      if (listingId) {
        const listing = await getListingById(String(listingId));
        if (listing) {
          const isOwner = listing.sellerId === userId;

          if (isOwner && listing.status === 'active' && listing.isActive === true) {
            const consumed = await consumeUserBoostCredit(String(userId));
            if (consumed) {
              const boosted = await boostListingForHours(String(listingId), 24);
              immediateBoost = {
                listingId: String(listingId),
                boostedUntil: boosted?.boostedUntil || null,
                usedSubscriptionId: consumed.subscriptionId,
                boostsRemainingAfterBoost: consumed.boostsRemaining,
              };
            }
          }
        }
      }

      const summary = await getUserBoostCreditsSummary(String(userId));
      return res.json({
        success: true,
        subscriptionId,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        boostCreditsAdded: creditsToAdd,
        boostsRemainingInSubscription: Number((updatedSubscription as any)?.boostsRemaining || 0),
        totalBoostCredits: summary.total,
        immediateBoost,
      });
    } catch (error) {
      console.error('[Boost] Error verifying boost payment:', error);
      return res.status(500).json({ success: false, error: 'Failed to verify boost payment' });
    }
  });

  /**
   * POST /api/subscriptions/upgrade-listing/checkout
   * Create Razorpay order for listing upgrade
   */
  app.post('/api/subscriptions/upgrade-listing/checkout', async (req: Request, res: Response) => {
    try {
      const { listingId, duration, price } = req.body;
      const userId = getRequestUserId(req);

      if (!listingId || !duration || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: listingId, duration, price',
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const validDurations = [45, 90, 180];
      if (!validDurations.includes(Number(duration))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid duration. Must be 45, 90, or 180 days',
        });
      }

      const listing = await getListingById(listingId);
      if (!listing) {
        return res.status(404).json({
          success: false,
          error: 'Listing not found',
        });
      }

      const isOwner = listing.sellerId === userId;

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'You can only upgrade your own listing',
        });
      }

      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid price',
        });
      }

      const razorpay = getRazorpayService();
      const amountInPaise = Math.round(numericPrice * 100);
      const effectiveUserId = String(userId);
      const receipt = razorpay.generateReceiptId(effectiveUserId, listingId);

      const order = await razorpay.createOrder({
        amount: amountInPaise,
        receipt,
        notes: {
          userId: effectiveUserId,
          listingId,
          subscriptionId: 'listing-upgrade',
          listingTitle: listing.title,
          duration: Number(duration),
        },
      });

      return res.json({
        success: true,
        payment: {
          razorpayOrderId: order.id,
          amount: order.amount,
          amountInRupees: order.amount / 100,
          key: process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY || '',
        },
      });
    } catch (error) {
      console.error('[Subscriptions] Error creating listing upgrade checkout:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to initiate upgrade payment',
      });
    }
  });

  /**
   * POST /api/subscriptions/upgrade-listing/verify-payment
   * Verify Razorpay payment and then upgrade listing
   */
  app.post(
    '/api/subscriptions/upgrade-listing/verify-payment',
    async (req: Request, res: Response) => {
      try {
        const {
          listingId,
          duration,
          price,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        } = req.body;
        const userId = getRequestUserId(req);

        if (!listingId || !duration || price === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: listingId, duration, price',
          });
        }

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
          });
        }

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          return res.status(400).json({
            success: false,
            error: 'Missing payment verification fields',
          });
        }

        const validDurations = [45, 90, 180];
        if (!validDurations.includes(Number(duration))) {
          return res.status(400).json({
            success: false,
            error: 'Invalid duration. Must be 45, 90, or 180 days',
          });
        }

        const numericPrice = Number(price);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid price',
          });
        }

        const listing = await getListingById(listingId);
        if (!listing) {
          return res.status(404).json({
            success: false,
            error: 'Listing not found',
          });
        }

        const isOwner = listing.sellerId === userId;

        if (!isOwner) {
          return res.status(403).json({
            success: false,
            error: 'You can only upgrade your own listing',
          });
        }

        const razorpay = getRazorpayService();
        const isValidPayment = razorpay.verifyPaymentSignature({
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        });

        if (!isValidPayment) {
          return res.status(400).json({
            success: false,
            error: 'Payment verification failed',
          });
        }

        // Calculate new expiry date (duration days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Number(duration));

        // Upgrade only after successful payment verification
        const updatedListing = await updateListing(listingId, {
          isPaid: true,
          durationDays: Number(duration),
          expiresAt,
          featured: true,
          isActive: true,
          status: 'active',
        });

        if (!updatedListing) {
          return res.status(500).json({
            success: false,
            error: 'Failed to upgrade listing',
          });
        }

        console.log(
          `[Subscriptions] Listing ${listingId} upgraded after payment ${razorpay_payment_id} to ${duration} days`
        );

        return res.json({
          success: true,
          data: {
            listingId,
            duration: Number(duration),
            expiresAt: expiresAt.toISOString(),
            isPaid: true,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
          },
          message: 'Listing upgraded successfully',
        });
      } catch (error) {
        console.error('[Subscriptions] Error verifying listing upgrade payment:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to verify payment and upgrade listing',
        });
      }
    }
  );

  /**
   * POST /api/subscriptions/upgrade-listing
   * Legacy endpoint retained for backward compatibility.
   * New clients should use:
   * 1) /api/subscriptions/upgrade-listing/checkout
   * 2) /api/subscriptions/upgrade-listing/verify-payment
   */
  app.post('/api/subscriptions/upgrade-listing', async (req: Request, res: Response) => {
    try {
      const { listingId, duration, price } = req.body;

      // Validate required fields
      if (!listingId || !duration || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: listingId, duration, price',
        });
      }

      // Validate duration
      const validDurations = [45, 90, 180];
      if (!validDurations.includes(duration)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid duration. Must be 45, 90, or 180 days',
        });
      }

      // Get the listing to verify it exists
      const listing = await getListingById(listingId);
      if (!listing) {
        return res.status(404).json({
          success: false,
          error: 'Listing not found',
        });
      }

      // Calculate new expiry date (duration days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + duration);

      // Update the listing with paid status and new expiry
      const updatedListing = await updateListing(listingId, {
        isPaid: true,
        durationDays: Number(duration),
        expiresAt: expiresAt, // Pass Date object, not string
        featured: true,
        isActive: true,
        status: 'active',
      });

      if (!updatedListing) {
        return res.status(500).json({
          success: false,
          error: 'Failed to upgrade listing',
        });
      }

      console.log(`[Subscriptions] Listing ${listingId} upgraded to ${duration} days plan`);

      return res.json({
        success: true,
        data: {
          listingId,
          duration,
          expiresAt: expiresAt.toISOString(),
          isPaid: true,
        },
        message: 'Listing upgraded successfully',
      });
    } catch (error) {
      console.error('[Subscriptions] Error upgrading listing:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upgrade listing',
      });
    }
  });

  console.log('[Routes] Subscription routes registered');
}
