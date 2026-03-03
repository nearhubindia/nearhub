/**
 * Subscription & Payment API Routes
 * Handles listing creation with optional payment
 * Integrates with database-backed listings
 */

import type { Express, Request, Response } from 'express';
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
import { createListing, updateListing } from '../../listings/services/listings';
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
  getListingsBySeller,
} from '../../listings/services/listings';
import {
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyInvoiceGenerated,
  notifyCouponApplied,
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
} from '../services/subscription-tiers';
import {
  analyzeImageContent,
  analyzeVideoContent,
  verifyProductImageMatch,
} from '../../../shared/ai/ai';
import { getActiveListingCount, getSubscriptionById } from '../services/subscription-tiers';
import { listingCreationLimiter } from '../../../lib/rate-limiter';

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
      const userId = (req as any).userId || req.get('x-user-id');

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
      let sellerListings = await getListingsBySeller(userId);

      // If no listings found by userId, try user's phone number from header
      if (sellerListings.length === 0) {
        const userPhone = req.get('x-user-phone');
        if (userPhone) {
          const normalizedPhone = userPhone.replace(/[\s+-]/g, '');
          sellerListings = await getListingsBySeller(normalizedPhone);
        }
      }

      const totalListingsCount = sellerListings.length;

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
            tier: tier
              ? {
                  id: tier.id,
                  name: tier.name,
                  price: tier.price,
                  durationDays: tier.durationDays,
                  maxListings: tier.maxListings,
                  featuredListingsPerMonth: tier.featuredListingsPerMonth,
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
        })),
      });

      return res.json({
        success: true,
        data: enriched,
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
      const userId = (req as any).userId || req.get('x-user-id');

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const { tierId, duration = 30 } = req.body;

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

      // Create subscription
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + duration);

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
   *   sellerId, title, description, category, price, condition, location,
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
          sellerId,
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

        // if sellerId appears to be an admin account, ensure request includes a valid admin JWT
        if (typeof sellerId === 'string' && sellerId.startsWith('admin')) {
          const authHeader = req.get('Authorization') || '';
          const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
          const admin = verifyAdminToken(token);
          if (!admin) {
            return res.status(401).json({ error: 'Unauthorized: valid admin token required' });
          }
        }

        // Validate required fields
        if (!sellerId || !title || !price || !category || !condition || !location) {
          return res.status(400).json({
            error: 'Missing required fields: sellerId, title, price, category, condition, location',
          });
        }

        // Check if user can create a listing (subscription limit check)
        // Skip check for admin accounts and coupon-based listings
        if (!sellerId.startsWith('admin') && !couponCode) {
          if (userSubscriptionId) {
            // NEW: Per-subscription quota check
            const { canCreateListingWithSubscription } =
              await import('../services/subscription-tiers');
            const limitCheck = await canCreateListingWithSubscription(sellerId, userSubscriptionId);
            if (!limitCheck.allowed) {
              return res.status(403).json({
                error: limitCheck.reason,
                code: 'SUBSCRIPTION_LIMIT_REACHED',
                current: limitCheck.current,
                limit: limitCheck.limit,
                subscriptionName: limitCheck.subscriptionName,
              });
            }
          } else {
            // OLD: Global quota check (fallback for backward compatibility)
            const limitCheck = await canUserCreateListing(sellerId);
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

        // Validate image and video limits (max 5 each)
        const imageCount = Array.isArray(images) ? images.length : 0;
        const videoCount = Array.isArray(videos) ? videos.length : 0;

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

        // If videos are being uploaded, validate subscription tier allows it
        if (videoCount > 0 && subscriptionTierId) {
          const tier = await getSubscriptionTierById(subscriptionTierId);
          if (!tier) {
            return res.status(400).json({
              error: 'Invalid subscription tier selected',
            });
          }

          // Parse tier features and check if video is allowed
          const tierFeatures =
            typeof tier.features === 'string' ? JSON.parse(tier.features) : tier.features || [];
          if (!tierFeatures.includes('video')) {
            return res.status(400).json({
              error: `Your subscription tier "${tier.name}" does not support video uploads. Please upgrade to a tier that includes video feature.`,
              tierName: tier.name,
              tierFeatures: tierFeatures,
            });
          }
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

          // Check if tier supports featured listings
          const tierFeatures =
            typeof tier.features === 'string' ? JSON.parse(tier.features) : tier.features || [];
          if (!tierFeatures.includes('featured')) {
            return res.status(403).json({
              error: `Your subscription tier "${tier.name}" does not include featured listings. Please upgrade to a tier that supports Featured listings.`,
              tierName: tier.name,
              tierFeatures: tierFeatures,
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

        if (couponCode) {
          // User is using a coupon code for free listing
          const freeCheck = await getRemainingFreeListings(couponCode, sellerId);
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
          // No coupon and no subscription - reject
          return res.status(403).json({
            error:
              'A subscription or valid coupon code with free listings is required to create a listing.',
            code: 'SUBSCRIPTION_OR_COUPON_REQUIRED',
          });
        }

        const listingData: CreateListingRequest = {
          sellerId,
          title,
          description,
          category,
          price: parseFloat(price as string),
          offerPrice:
            offerPrice !== undefined && offerPrice !== null ? parseFloat(offerPrice as string) : undefined,
          condition,
          location,
          priceUnit,
          listingType: listingType || 'image',
          pincode,
          latitude: latitude ? parseFloat(latitude as string) : undefined,
          longitude: longitude ? parseFloat(longitude as string) : undefined,
        };

        // 🛡️ AI CONTENT MODERATION: Validate images and videos before creating listing
        console.log('[AI Moderation] Starting content validation...');
        const hasImages = images && Array.isArray(images) && images.length > 0;
        const hasVideos = videos && Array.isArray(videos) && videos.length > 0;

        if (hasImages) {
          console.log(`[AI Moderation] Analyzing ${images.length} image(s)...`);
          // Analyze first image (could extend to all images if needed)
          const firstImage = images[0];
          if (firstImage && typeof firstImage === 'string') {
            try {
              // Step 1: Check for inappropriate content (safety)
              const imageAnalysis = await analyzeImageContent(firstImage);
              console.log('[AI Moderation] Safety check result:', imageAnalysis);

              if (!imageAnalysis.isAppropriate) {
                const reasons = [];
                if (imageAnalysis.hasNudity) reasons.push('nudity');
                if (imageAnalysis.hasViolence) reasons.push('violence');
                if (imageAnalysis.hasWeapons) reasons.push('weapons');
                if (imageAnalysis.hasDrugs) reasons.push('drugs');

                return res.status(400).json({
                  success: false,
                  error: 'Image content violates community guidelines',
                  code: 'INAPPROPRIATE_CONTENT',
                  details: {
                    contentType: 'image',
                    violations: reasons,
                    reason: imageAnalysis.reason,
                    confidence: imageAnalysis.confidence,
                  },
                  message: `Your image was flagged for containing inappropriate content: ${reasons.join(', ')}. Please use different images.`,
                });
              }
              console.log('[AI Moderation] ✓ Images passed safety check');

              // Step 2: Verify product-image matching
              const productMatch = await verifyProductImageMatch(firstImage, title, category);
              console.log('[AI Moderation] Product match result:', productMatch);

              if (!productMatch.matches && productMatch.confidence > 0.6) {
                return res.status(400).json({
                  success: false,
                  error: 'Image does not match the product title and category',
                  code: 'PRODUCT_IMAGE_MISMATCH',
                  details: {
                    contentType: 'image',
                    expectedProduct: title,
                    expectedCategory: category,
                    detectedItems: productMatch.detectedItems,
                    reason: productMatch.reason,
                    confidence: productMatch.confidence,
                  },
                  message: `Your image doesn't match what you're selling. ${productMatch.reason}. Please upload correct product images.`,
                });
              }
              console.log('[AI Moderation] ✓ Product-image match verified');
            } catch (error) {
              console.error('[AI Moderation] Image analysis failed:', error);
              // Continue with listing creation if AI service is down (graceful degradation)
              // TODO: Flag for manual review
            }
          }
        }

        if (hasVideos) {
          console.log(`[AI Moderation] Video upload detected - requires frame analysis`);
          // Note: Video frame extraction should happen client-side or via FFmpeg
          // For now, we'll skip direct video validation but log it
          // TODO: Implement video frame extraction and analysis
          console.log(
            '[AI Moderation] ⚠️ Video content moderation not yet implemented - manual review recommended'
          );
        }

        // Create the listing
        const createdListing = await createListing({
          sellerId: listingData.sellerId,
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
          images: images || [],
          videos: videos || [],
          subscriptionTierId: subscriptionTierId || null,
          userSubscriptionId: userSubscriptionId || null, // NEW: Track which subscription instance
          featured: isFeatured,
          isPaid,
          durationDays,
          status: 'active',
          isActive: true,
        });

        // If coupon was used, record the free listing usage
        if (isFreeFromCoupon && couponCode) {
          const useResult = await useFreeListingFromCoupon(couponCode, sellerId, createdListing.id);
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
          isFree: isFreeFromCoupon,
          message: isFreeFromCoupon
            ? `✓ Listing created with coupon! ${couponFreeRemaining} free listing${couponFreeRemaining !== 1 ? 's' : ''} remaining.`
            : '✓ Listing created successfully with your subscription.',
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
   * Body: { subscriptionId, sellerId, listingId, listingTitle, totalFee, duration, tierId?, couponCode? }
   */
  app.post('/api/subscriptions/checkout', async (req: Request, res: Response) => {
    try {
      const {
        subscriptionId,
        sellerId,
        listingId,
        listingTitle,
        totalFee,
        duration,
        tierId,
        couponCode,
      } = req.body;

      if (!subscriptionId || !sellerId || !listingId || !totalFee || !duration) {
        return res.status(400).json({
          error: 'Missing required fields: subscriptionId, sellerId, listingId, totalFee, duration',
        });
      }

      let finalFee = parseFloat(totalFee);
      let discountApplied = false;
      let discountPercentage = 0;
      let discountAmount = 0;
      let couponId: string | null = null;

      // Apply coupon if provided
      if (couponCode) {
        const discountResult = await applyCouponDiscount(couponCode, finalFee, sellerId, tierId);

        if (discountResult.success) {
          discountApplied = true;
          finalFee = discountResult.finalAmount;
          discountPercentage = discountResult.discountPercentage;
          discountAmount = discountResult.discountAmount;

          // Get coupon ID for tracking
          const couponValidation = await validateCouponCode(couponCode, sellerId, tierId);
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

      // Handle 100% discount (free subscription)
      if (finalFee <= 0 && discountApplied) {
        console.log(
          `[Checkout] 100% discount applied with coupon ${couponCode} - bypassing payment`
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
              updatedAt: new Date(),
            })
            .where(eq(userSubscriptions.id, subscriptionId));

          console.log('[Checkout] Free subscription activated:', subscriptionId);
        } catch (activationError) {
          console.error('[Checkout] Failed to activate free subscription:', activationError);
        }

        // Record coupon usage
        if (couponCode) {
          await recordCouponUsage(couponCode, listingId, subscriptionId, sellerId, discountAmount);
        }

        // Return special response for free subscription
        return res.json({
          success: true,
          isFree: true,
          message: `🎉 100% discount applied! Your subscription is completely FREE for ${duration} days`,
          payment: {
            razorpayOrderId: 'FREE_SUBSCRIPTION',
            amount: 0,
            amountInRupees: 0,
            key: '',
            subscriptionId: subscriptionId,
          },
          discount: {
            percentage: discountPercentage,
            amount: discountAmount,
            originalAmount: parseFloat(totalFee),
            finalAmount: 0,
            couponId,
          },
          nextStep: 'No payment required - proceed directly to create listing',
        });
      }

      const paymentDetails = await initiatePayment(
        subscriptionId,
        sellerId,
        listingId,
        listingTitle,
        finalFee,
        parseInt(duration) as DurationOption
      );

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
              originalAmount: parseFloat(totalFee),
              finalAmount: finalFee,
              couponId,
            }
          : null,
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
   *   subscriptionId, couponCode?, listingId?, discountAmount?,
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
        discountAmount,
        // Invoice fields
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        invoiceItems,
        generateInvoice,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          error: 'Missing payment verification fields',
        });
      }

      // Verify payment signature
      const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

      if (!isValid) {
        // Send payment failure notification
        if (customerId) {
          const amount = invoiceItems && invoiceItems[0] ? invoiceItems[0].amount : 0;
          notifyPaymentFailed(customerId, amount / 100, 'Invalid payment signature').catch((err) =>
            console.error('[Subscriptions] Failed to send payment failed notification:', err)
          );
        }

        return res.status(400).json({
          success: false,
          error: 'Payment verification failed - invalid signature',
          message: 'This payment appears to be fraudulent. Please contact support.',
        });
      }

      // Record coupon usage if applicable
      if (couponCode && listingId && subscriptionId && discountAmount && customerId) {
        const usageResult = await recordCouponUsage(
          couponCode,
          listingId,
          subscriptionId,
          customerId,
          parseFloat(discountAmount)
        );

        if (!usageResult.success) {
          console.error('[Subscriptions] Failed to record coupon usage:', usageResult.error);
          // Don't fail the payment verification if coupon recording fails
          // Just log it and continue
        } else if (customerId) {
          // Send coupon applied notification
          const listingTitle =
            invoiceItems && invoiceItems[0] ? invoiceItems[0].description : 'listing';
          notifyCouponApplied(
            customerId,
            couponCode,
            parseFloat(discountAmount),
            listingTitle
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

          // Use provided items or create default subscription item
          const items = invoiceItems || [
            {
              description: 'Listing Subscription Payment',
              quantity: 1,
              unitPrice: 0, // Will be provided by client
              amount: 0, // Will be provided by client
            },
          ];

          console.log('[Subscriptions] Invoice items:', JSON.stringify(items, null, 2));

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
      if (subscriptionId) {
        try {
          console.log('[Subscriptions] Activating subscription:', subscriptionId);
          const { db } = await import('../../../data/db');
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
            .where(eq(userSubscriptions.id, subscriptionId))
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
            console.error('[Subscriptions] No subscription found with ID:', subscriptionId);
          }
        } catch (activationError) {
          console.error('[Subscriptions] Failed to activate subscription:', activationError);
          if (activationError instanceof Error) {
            console.error('[Subscriptions] Activation error stack:', activationError.stack);
          }
          // Don't fail the verification, just log the error
        }
      } else {
        console.warn('[Subscriptions] No subscriptionId provided for activation');
      }

      // Send payment success notification
      if (customerId) {
        const amount = invoiceItems && invoiceItems[0] ? invoiceItems[0].amount : 0;
        const listingTitle =
          invoiceItems && invoiceItems[0] ? invoiceItems[0].description : undefined;
        notifyPaymentSuccess(customerId, amount / 100, razorpay_payment_id, listingTitle).catch(
          (err) =>
            console.error('[Subscriptions] Failed to send payment success notification:', err)
        );
      }

      // Payment verified successfully
      console.log('[Subscriptions] Payment verification complete:', {
        subscriptionId,
        invoicegenerated: !!invoiceData,
        invoiceNumber: invoiceData?.invoiceNumber,
      });

      return res.json({
        success: true,
        message: couponCode
          ? '✓ Payment verified successfully with coupon discount applied'
          : '✓ Payment verified successfully',
        subscriptionId,
        subscriptionActivated: !!subscriptionId,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        nextStep: 'Subscription is now active - refresh to see updated quota',
        invoice: invoiceData || null,
        invoiceGenerated: !!invoiceData,
        invoiceHtmlUrl: invoiceData
          ? `/api/invoices/${invoiceData.invoiceNumber}/view?data=${encodeURIComponent(JSON.stringify(invoiceData))}`
          : null,
      });
    } catch (error) {
      console.error('[Subscriptions] Error verifying payment:', error);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  /**
   * GET /api/subscriptions/:subscriptionId
   * Get subscription details
   */
  app.get('/api/subscriptions/:subscriptionId', async (req: Request, res: Response) => {
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
          price: subscription.tier.price,
          durationDays: subscription.tier.durationDays,
          maxListings: subscription.tier.maxListings,
          featuredListingsPerMonth: subscription.tier.featuredListingsPerMonth,
        },
      });
    } catch (error) {
      console.error('[Subscriptions] Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  /**
   * POST /api/subscriptions/webhook/razorpay
   * Razorpay webhook for payment notifications
   */
  app.post('/api/subscriptions/webhook/razorpay', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const payload = JSON.stringify(req.body);

      const razorpay = getRazorpayService();

      // Convert payload to string for verification
      const payloadString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

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
          if (data.payment?.notes?.sellerId) {
            notifyPaymentFailed(
              data.payment.notes.sellerId,
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

  /**
   * GET /api/subscriptions/seller/:sellerId/active
   * Get active listings for seller
   */
  app.get('/api/subscriptions/seller/:sellerId/active', async (req: Request, res: Response) => {
    try {
      const { sellerId } = req.params;
      let listings = await getListingsBySeller(sellerId as string);

      // If no listings found, try user's phone from header
      if (listings.length === 0) {
        const userPhone = req.get('x-user-phone');
        if (userPhone) {
          const normalizedPhone = userPhone.replace(/[\s+-]/g, '');
          listings = await getListingsBySeller(normalizedPhone);
        }
      }

      const formattedListings = listings.map((listing) => ({
        ...listing,
        images:
          typeof listing.images === 'string'
            ? JSON.parse(listing.images || '[]')
            : listing.images || [],
        videos:
          typeof listing.videos === 'string'
            ? JSON.parse(listing.videos || '[]')
            : listing.videos || [],
      }));

      const activeListings = formattedListings.filter((l) => l.status === 'active' && l.isActive);

      return res.json({
        success: true,
        sellerId,
        activeListings,
        total: activeListings.length,
      });
    } catch (error) {
      console.error('[Subscriptions] Error fetching seller listings:', error);
      res.status(500).json({ error: 'Failed to fetch seller listings' });
    }
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
        duration_days,
        durationDays,
        price,
        features,
        max_listings,
        maxListings,
        featured_listings_per_month,
        featuredListingsPerMonth,
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
      const finalIsActive = is_active !== undefined ? is_active : isActive;

      if (!name || !finalDurationDays || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, durationDays, price',
        });
      }

      const f = features as any;
      const featuresStr = typeof f === 'string' ? f : JSON.stringify(f || []);
      const newTier = await createSubscriptionTier({
        name,
        type: 'bundle', // New type for bundled tiers
        durationDays: parseInt(finalDurationDays) as any,
        price: parseFloat(price) as any,
        features: featuresStr as any,
        description: name,
        maxListings: finalMaxListings ? parseInt(finalMaxListings) : 10,
        featuredListingsPerMonth: parseInt(finalFeaturedListings.toString()),
        monthlyPrice: parseFloat(price) as any,
        annualPrice: parseFloat(price) as any,
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
        duration_days,
        durationDays,
        price,
        features,
        max_listings,
        maxListings,
        featured_listings_per_month,
        featuredListingsPerMonth,
        highlight,
        is_active,
        isActive,
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) {
        updateData.price = parseFloat(price);
        updateData.monthlyPrice = parseFloat(price);
        updateData.annualPrice = parseFloat(price);
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
      if (features !== undefined) {
        updateData.features = typeof features === 'string' ? features : JSON.stringify(features);
      }
      if (highlight !== undefined) updateData.highlight = highlight;
      if (is_active !== undefined || isActive !== undefined) {
        updateData.isActive = is_active !== undefined ? is_active : isActive;
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
      console.error('[Admin] Error deleting subscription tier:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete subscription tier',
      });
    }
  });

  /**
   * GET /api/subscriptions/tiers
   * Get available subscription tiers for users
   */
  app.get('/api/subscriptions/tiers', async (req: Request, res: Response) => {
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
   * POST /api/subscriptions/upgrade-listing
   * Upgrade an existing listing to a paid plan
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
        expiresAt: expiresAt, // Pass Date object, not string
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
