/**
 * Subscription Tiers Service
 * Manages subscription tier operations and user subscriptions
 */

import { db } from '../../../data/db';
import {
  subscriptionTiers,
  userSubscriptions,
  coupons,
  listings,
  insertSubscriptionTierSchema,
  type SubscriptionTier,
  type InsertSubscriptionTier,
  type UserSubscription,
} from '../../admin/models/admin-settings';
import { eq, and, gt, sql, asc } from 'drizzle-orm';

function toDecimalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return value as null | undefined;
  if (typeof value === 'number') return value.toString();
  return String(value);
}

export class SubscriptionTierInUseError extends Error {
  statusCode: number;
  details: {
    activeSubscriptions: number;
    totalSubscriptions: number;
    linkedListings: number;
  };

  constructor(
    message: string,
    details: { activeSubscriptions: number; totalSubscriptions: number; linkedListings: number }
  ) {
    super(message);
    this.name = 'SubscriptionTierInUseError';
    this.statusCode = 409;
    this.details = details;
  }
}

/**
 * Get all active subscription tiers
 */
export async function getActiveSubscriptionTiers(): Promise<SubscriptionTier[]> {
  return await db
    .select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.isActive, true))
    .orderBy(subscriptionTiers.price);
}

/**
 * Get subscription tier by ID
 */
export async function getSubscriptionTierById(tierId: string): Promise<SubscriptionTier | null> {
  const result = await db
    .select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.id, tierId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Create new subscription tier (admin only)
 */
export async function createSubscriptionTier(
  data: InsertSubscriptionTier
): Promise<SubscriptionTier> {
  const normalizedData: InsertSubscriptionTier = {
    ...data,
    price: toDecimalString((data as any).price) as any,
    monthlyPrice: toDecimalString((data as any).monthlyPrice) as any,
    annualPrice: toDecimalString((data as any).annualPrice) as any,
    offerPrice: toDecimalString((data as any).offerPrice) as any,
  };

  // Validate schema
  const validated = insertSubscriptionTierSchema.parse(normalizedData);

  // Ensure features is JSON stringified
  const features =
    typeof validated.features === 'string'
      ? validated.features
      : JSON.stringify(validated.features || []);

  const result = await db
    .insert(subscriptionTiers)
    .values({
      ...validated,
      features,
    } as any)
    .returning();

  return result[0];
}

/**
 * Update subscription tier (admin only)
 */
export async function updateSubscriptionTier(
  tierId: string,
  data: Partial<InsertSubscriptionTier>
): Promise<SubscriptionTier | null> {
  const normalizedData: Partial<InsertSubscriptionTier> = {
    ...data,
    price: toDecimalString((data as any).price) as any,
    monthlyPrice: toDecimalString((data as any).monthlyPrice) as any,
    annualPrice: toDecimalString((data as any).annualPrice) as any,
    offerPrice: toDecimalString((data as any).offerPrice) as any,
  };

  const features =
    normalizedData.features && typeof normalizedData.features !== 'string'
      ? JSON.stringify(normalizedData.features)
      : normalizedData.features;

  const result = await db
    .update(subscriptionTiers)
    .set({
      ...normalizedData,
      features,
      updatedAt: new Date(),
    } as any)
    .where(eq(subscriptionTiers.id, tierId))
    .returning();

  return result.length > 0 ? result[0] : null;
}

/**
 * Get user's first active subscription (for backwards compatibility)
 * @deprecated Use getUserActiveSubscriptions instead
 */
export async function getUserSubscription(
  userId: string
): Promise<(UserSubscription & { tier: SubscriptionTier }) | null> {
  const result = await db
    .select({
      subscription: userSubscriptions,
      tier: subscriptionTiers,
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionTiers, eq(userSubscriptions.subscriptionTierId, subscriptionTiers.id))
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active')))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0].subscription,
    tier: result[0].tier,
  } as any;
}

/**
 * Get all active subscriptions for a user
 */
export async function getUserActiveSubscriptions(
  userId: string
): Promise<Array<UserSubscription & { tier: SubscriptionTier }>> {
  const results = await db
    .select({
      subscription: userSubscriptions,
      tier: subscriptionTiers,
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionTiers, eq(userSubscriptions.subscriptionTierId, subscriptionTiers.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, 'active'),
        gt(userSubscriptions.expiresAt, new Date())
      )
    );

  return results.map((r) => ({
    ...r.subscription,
    tier: r.tier,
  })) as any;
}

/**
 * Get total allowed listings from all active subscriptions
 */
export async function getTotalAllowedListings(userId: string): Promise<number> {
  const subscriptions = await getUserActiveSubscriptions(userId);

  if (subscriptions.length === 0) return 0;

  // Sum up maxListings from all active subscriptions
  // -1 means unlimited, so if any subscription has unlimited, return -1
  let total = 0;
  for (const sub of subscriptions) {
    if (sub.tier.maxListings === -1) return -1; // Unlimited
    total += sub.tier.maxListings;
  }

  return total;
}

/**
 * Get subscription by ID with tier details
 */
export async function getSubscriptionById(
  subscriptionId: string
): Promise<(UserSubscription & { tier: SubscriptionTier }) | null> {
  const result = await db
    .select({
      subscription: userSubscriptions,
      tier: subscriptionTiers,
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionTiers, eq(userSubscriptions.subscriptionTierId, subscriptionTiers.id))
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0].subscription,
    tier: result[0].tier,
  } as any;
}

/**
 * Create user subscription
 * Allows multiple active subscriptions per user
 */
export async function createUserSubscription(
  userId: string,
  subscriptionTierId: string,
  expiresAt: Date,
  paymentId?: string,
  orderId?: string,
  invoiceId?: string,
  couponId?: string
): Promise<UserSubscription> {
  const tier = await getSubscriptionTierById(subscriptionTierId);
  const tierBoostCredits = tier
    ? Number((tier as any).boostCredits || tier.featuredListingsPerMonth || 0)
    : 0;

  // NO LONGER deleting existing subscriptions - users can have multiple!

  const result = await db
    .insert(userSubscriptions)
    .values({
      userId,
      subscriptionTierId,
      expiresAt,
      paymentId,
      orderId,
      invoiceId,
      couponId,
      boostsRemaining: tierBoostCredits,
      status: 'pending', // Start as pending, activate after payment verification
      autoRenew: false,
    })
    .returning();

  return result[0];
}

/**
 * Grant an active subscription to a user without payment flow.
 * Intended for admin/manual issuance.
 */
export async function grantUserSubscription(
  userId: string,
  subscriptionTierId: string,
  expiresAt: Date,
  options: {
    paymentId?: string | null;
    orderId?: string | null;
    invoiceId?: string | null;
    couponId?: string | null;
  } = {}
): Promise<UserSubscription> {
  const tier = await getSubscriptionTierById(subscriptionTierId);
  const tierBoostCredits = tier
    ? Number((tier as any).boostCredits || tier.featuredListingsPerMonth || 0)
    : 0;

  const result = await db
    .insert(userSubscriptions)
    .values({
      userId,
      subscriptionTierId,
      expiresAt,
      paymentId: options.paymentId ?? null,
      orderId: options.orderId ?? null,
      invoiceId: options.invoiceId ?? null,
      couponId: options.couponId ?? null,
      boostsRemaining: tierBoostCredits,
      status: 'active',
      autoRenew: false,
    })
    .returning();

  return result[0];
}

/**
 * Get total remaining boost credits from all active subscriptions
 */
export async function getUserBoostCreditsSummary(userId: string): Promise<{
  total: number;
  bySubscription: Array<{ subscriptionId: string; boostsRemaining: number; expiresAt: Date }>;
}> {
  const rows = await db
    .select({
      id: userSubscriptions.id,
      boostsRemaining: userSubscriptions.boostsRemaining,
      expiresAt: userSubscriptions.expiresAt,
    })
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, 'active'),
        gt(userSubscriptions.expiresAt, new Date()),
        gt(userSubscriptions.boostsRemaining, 0)
      )
    )
    .orderBy(asc(userSubscriptions.expiresAt));

  const bySubscription = rows.map((r) => ({
    subscriptionId: r.id,
    boostsRemaining: Number(r.boostsRemaining || 0),
    expiresAt: r.expiresAt,
  }));

  const total = bySubscription.reduce((sum, s) => sum + s.boostsRemaining, 0);
  return { total, bySubscription };
}

/**
 * Consume one boost credit from earliest-expiring active subscription.
 * Returns null if no credits available.
 */
export async function consumeUserBoostCredit(
  userId: string
): Promise<{ subscriptionId: string; boostsRemaining: number } | null> {
  const activeWithCredits = await db
    .select({
      id: userSubscriptions.id,
      boostsRemaining: userSubscriptions.boostsRemaining,
      expiresAt: userSubscriptions.expiresAt,
    })
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, 'active'),
        gt(userSubscriptions.expiresAt, new Date()),
        gt(userSubscriptions.boostsRemaining, 0)
      )
    )
    .orderBy(asc(userSubscriptions.expiresAt))
    .limit(1);

  if (activeWithCredits.length === 0) return null;

  const target = activeWithCredits[0];
  const updateResult = await db
    .update(userSubscriptions)
    .set({
      boostsRemaining: sql`${userSubscriptions.boostsRemaining} - 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userSubscriptions.id, target.id),
        gt(userSubscriptions.boostsRemaining, 0),
        eq(userSubscriptions.status, 'active'),
        gt(userSubscriptions.expiresAt, new Date())
      )
    )
    .returning({
      id: userSubscriptions.id,
      boostsRemaining: userSubscriptions.boostsRemaining,
    });

  if (updateResult.length === 0) return null;
  return {
    subscriptionId: updateResult[0].id,
    boostsRemaining: Number(updateResult[0].boostsRemaining || 0),
  };
}

/**
 * Add boost credits to a subscription after successful boost-pack purchase.
 */
export async function addBoostCreditsToSubscription(
  subscriptionId: string,
  credits: number
): Promise<UserSubscription | null> {
  if (!Number.isFinite(credits) || credits <= 0) return null;

  const result = await db
    .update(userSubscriptions)
    .set({
      boostsRemaining: sql`${userSubscriptions.boostsRemaining} + ${Math.floor(credits)}`,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, subscriptionId))
    .returning();

  return result.length > 0 ? result[0] : null;
}

/**
 * Check if user's subscription is active and valid
 */
export async function isUserSubscriptionActive(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) return false;

  const now = new Date();
  return subscription.expiresAt > now && subscription.status === 'active';
}

/**
 * Get remaining days in subscription
 */
export async function getSubscriptionRemainingDays(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) return 0;

  const now = new Date();
  if (subscription.expiresAt <= now) return 0;

  const diffTime = subscription.expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Apply coupon to subscription
 */
export async function applyCouponToSubscription(
  userId: string,
  couponCode: string
): Promise<{ discount: number; discountPercentage: number } | null> {
  // Get coupon
  const couponResult = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, couponCode.toUpperCase()), eq(coupons.isActive, true)))
    .limit(1);

  if (couponResult.length === 0) return null;

  const coupon = couponResult[0];

  // Check if coupon is still valid
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return null;

  // Check if coupon has reached max usage
  if (coupon.maxUsageCount > 0 && coupon.usageCount >= coupon.maxUsageCount) {
    return null;
  }

  // Get user subscription to calculate discount
  const subscription = await getUserSubscription(userId);
  if (!subscription) return null;

  // Calculate actual discount amount (in rupees)
  const tierPrice =
    typeof subscription.tier.price === 'string'
      ? parseFloat(subscription.tier.price)
      : subscription.tier.price;

  const discountAmount = Math.round((tierPrice * coupon.discountPercentage) / 100);

  return {
    discount: discountAmount,
    discountPercentage: coupon.discountPercentage,
  };
}

/**
 * Expire subscription (called by cron job or admin)
 */
export async function expireSubscription(userId: string): Promise<void> {
  await db
    .update(userSubscriptions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(eq(userSubscriptions.userId, userId));
}

/**
 * Get subscription statistics (admin)
 */
export async function getSubscriptionStats() {
  const totalTiers = await db.select().from(subscriptionTiers);
  const activeTiers = await db
    .select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.isActive, true));
  const activeSubscriptions = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.status, 'active'));
  const expiredSubscriptions = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.status, 'expired'));

  return {
    totalTiers: totalTiers.length,
    activeTiers: activeTiers.length,
    activeSubscriptions: activeSubscriptions.length,
    expiredSubscriptions: expiredSubscriptions.length,
  };
}

/**
 * Delete subscription tier (admin only)
 */
export async function deleteSubscriptionTier(tierId: string): Promise<boolean> {
  const [activeSubsResult, totalSubsResult, linkedListingsResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.subscriptionTierId, tierId),
          eq(userSubscriptions.status, 'active')
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.subscriptionTierId, tierId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(eq(listings.subscriptionTierId, tierId)),
  ]);

  const activeSubscriptions = Number(activeSubsResult[0]?.count || 0);
  const totalSubscriptions = Number(totalSubsResult[0]?.count || 0);
  const linkedListings = Number(linkedListingsResult[0]?.count || 0);

  if (totalSubscriptions > 0 || linkedListings > 0) {
    throw new SubscriptionTierInUseError(
      'Cannot delete subscription tier because it is referenced by existing data. Deactivate/archive the tier instead.',
      {
        activeSubscriptions,
        totalSubscriptions,
        linkedListings,
      }
    );
  }

  const result = await db
    .delete(subscriptionTiers)
    .where(eq(subscriptionTiers.id, tierId))
    .returning();

  return result.length > 0;
}

/**
 * Get active listing count for a user
 */
export async function getActiveListingCount(userId: string): Promise<number> {
  const { listings } = await import('../../admin/models/admin-settings');
  const { sql } = await import('drizzle-orm');

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(
      and(eq(listings.sellerId, userId), eq(listings.isActive, true), eq(listings.status, 'active'))
    );

  return Number(result[0]?.count || 0);
}

/**
 * Check if user can create a new listing based on subscription limits
 */
export async function canUserCreateListing(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
}> {
  const totalAllowed = await getTotalAllowedListings(userId);
  const currentCount = await getActiveListingCount(userId);

  // -1 means unlimited
  if (totalAllowed === -1) {
    return {
      allowed: true,
      current: currentCount,
      limit: -1,
    };
  }

  // No active subscriptions
  if (totalAllowed === 0) {
    return {
      allowed: false,
      reason: 'No active subscription. Please purchase a subscription to create listings.',
      current: currentCount,
      limit: 0,
    };
  }

  // Check if user has reached limit
  if (currentCount >= totalAllowed) {
    return {
      allowed: false,
      reason: `Listing limit reached (${currentCount}/${totalAllowed}). Purchase another subscription to create more listings.`,
      current: currentCount,
      limit: totalAllowed,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: totalAllowed,
  };
}

/**
 * Check if user can create a listing with a specific subscription
 * Validates subscription ownership and quota
 */
export async function canCreateListingWithSubscription(
  userId: string,
  userSubscriptionId: string
): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  subscriptionName?: string;
}> {
  // Get the specific subscription
  const subscription = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, userSubscriptionId))
    .limit(1);

  if (subscription.length === 0) {
    return {
      allowed: false,
      reason: 'Subscription not found',
      current: 0,
      limit: 0,
    };
  }

  const sub = subscription[0];

  // Verify subscription belongs to user
  if (sub.userId !== userId) {
    return {
      allowed: false,
      reason: 'This subscription belongs to a different user',
      current: 0,
      limit: 0,
    };
  }

  // Check if subscription is active
  if (sub.status !== 'active') {
    return {
      allowed: false,
      reason: `Subscription is ${sub.status}. Only active subscriptions can be used.`,
      current: 0,
      limit: 0,
    };
  }

  // Check if subscription has expired
  const now = new Date();
  if (sub.expiresAt && sub.expiresAt <= now) {
    return {
      allowed: false,
      reason: 'Subscription has expired',
      current: 0,
      limit: 0,
    };
  }

  // Get tier details
  const tier = await getSubscriptionTierById(sub.subscriptionTierId);
  if (!tier) {
    return {
      allowed: false,
      reason: 'Subscription tier not found',
      current: 0,
      limit: 0,
    };
  }

  // Get current listing count for this specific subscription
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(
      and(
        eq(listings.userSubscriptionId, userSubscriptionId),
        eq(listings.isActive, true),
        eq(listings.status, 'active')
      )
    );

  const currentCount = Number(result[0]?.count || 0);
  const maxListings = tier.maxListings;

  // -1 means unlimited
  if (maxListings === -1) {
    return {
      allowed: true,
      current: currentCount,
      limit: -1,
      subscriptionName: tier.name,
    };
  }

  // Check if quota is exceeded
  if (currentCount >= maxListings) {
    return {
      allowed: false,
      reason: `This ${tier.name} subscription has reached its limit (${currentCount}/${maxListings} listings used)`,
      current: currentCount,
      limit: maxListings,
      subscriptionName: tier.name,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: maxListings,
    subscriptionName: tier.name,
  };
}
