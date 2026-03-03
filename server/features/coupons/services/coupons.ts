/**
 * Coupons Service
 * Handles coupon creation, validation, and usage tracking
 */

import { db } from '../../../data/db';
import { coupons, couponUsage } from '../../admin/models/admin-settings';
import { eq, and, lt, gt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export interface CouponValidationResult {
  isValid: boolean;
  coupon?: {
    id: string;
    code: string;
    discountPercentage: number;
    maxUsageCount: number;
    usageCount: number;
    freeListings: number;
    freeListingDurationDays: number;
  };
  error?: string;
}

export interface ApplyCouponResult {
  success: boolean;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  error?: string;
}

/**
 * Validate coupon code
 * @param code - Coupon code to validate
 * @param userId - Optional user ID to check if user already used this coupon
 * @param tierId - Optional subscription tier ID to check if coupon applies to this plan
 * @returns Validation result with coupon details
 */
export async function validateCouponCode(
  code: string,
  userId?: string,
  tierId?: string
): Promise<CouponValidationResult> {
  try {
    const couponCode = code.toUpperCase().trim();

    // Find coupon
    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, couponCode),
    });

    if (!coupon) {
      return {
        isValid: false,
        error: 'Coupon code not found',
      };
    }

    // Check if active
    if (!coupon.isActive) {
      return {
        isValid: false,
        error: 'Coupon is no longer active',
      };
    }

    // Check expiry
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return {
        isValid: false,
        error: 'Coupon has expired',
      };
    }

    // Check if coupon is applicable to the selected subscription tier
    if (tierId && coupon.applicableTiers) {
      try {
        const applicableTiers = JSON.parse(coupon.applicableTiers);
        if (Array.isArray(applicableTiers) && applicableTiers.length > 0) {
          if (!applicableTiers.includes(tierId)) {
            return {
              isValid: false,
              error: 'This coupon is not applicable to the selected subscription plan',
            };
          }
        }
      } catch (e) {
        console.error('[Coupons] Error parsing applicableTiers:', e);
      }
    }

    // Check if user already used this coupon (one-time per user)
    if (userId) {
      const alreadyUsed = await hasUserUsedCoupon(couponCode, userId);
      if (alreadyUsed) {
        return {
          isValid: false,
          error: 'You have already used this coupon',
        };
      }
    }

    // Check usage limit
    if (coupon.usageCount >= coupon.maxUsageCount) {
      return {
        isValid: false,
        error: `Coupon usage limit (${coupon.maxUsageCount}) reached`,
      };
    }

    return {
      isValid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
        maxUsageCount: coupon.maxUsageCount,
        usageCount: coupon.usageCount,
        freeListings: coupon.freeListings ?? 0,
        freeListingDurationDays: coupon.freeListingDurationDays ?? 30,
      },
    };
  } catch (error) {
    console.error('[Coupons] Error validating coupon:', error);
    return {
      isValid: false,
      error: 'Failed to validate coupon',
    };
  }
}

/**
 * Apply coupon discount to a price
 * @param couponCode - Coupon code
 * @param originalAmount - Original subscription fee
 * @param userId - Optional user ID to check if user already used this coupon
 * @param tierId - Optional subscription tier ID to check if coupon applies to this plan
 * @returns Result with discount details
 */
export async function applyCouponDiscount(
  couponCode: string,
  originalAmount: number,
  userId?: string,
  tierId?: string
): Promise<ApplyCouponResult> {
  try {
    const validation = await validateCouponCode(couponCode, userId, tierId);

    if (!validation.isValid) {
      return {
        success: false,
        discountPercentage: 0,
        discountAmount: 0,
        finalAmount: originalAmount,
        error: validation.error,
      };
    }

    const coupon = validation.coupon!;
    const discountAmount = (originalAmount * coupon.discountPercentage) / 100;
    const finalAmount = Math.max(0, originalAmount - discountAmount);

    return {
      success: true,
      discountPercentage: coupon.discountPercentage,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
    };
  } catch (error) {
    console.error('[Coupons] Error applying discount:', error);
    return {
      success: false,
      discountPercentage: 0,
      discountAmount: 0,
      finalAmount: originalAmount,
      error: 'Failed to apply coupon',
    };
  }
}

/**
 * Check if a user has already used a specific coupon
 * @param couponCode - Coupon code
 * @param userId - User ID
 * @returns true if user has already used this coupon
 */
export async function hasUserUsedCoupon(
  couponCode: string,
  userId: string
): Promise<boolean> {
  try {
    const couponCode_ = couponCode.toUpperCase().trim();

    // Find coupon
    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, couponCode_),
    });

    if (!coupon) {
      return false;
    }

    // Check if user has used this coupon
    const usage = await db.query.couponUsage.findFirst({
      where: and(
        eq(couponUsage.couponId, coupon.id),
        eq(couponUsage.userId, userId)
      ),
    });

    return !!usage;
  } catch (error) {
    console.error('[Coupons] Error checking user coupon usage:', error);
    return false;
  }
}

/**
 * Record coupon usage
 * @param couponCode - Coupon code
 * @param listingId - Listing ID
 * @param subscriptionId - Subscription ID
 * @param userId - User ID
 * @param discountAmount - Actual discount amount applied
 */
export async function recordCouponUsage(
  couponCode: string,
  listingId: string,
  subscriptionId: string,
  userId: string,
  discountAmount: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const couponCode_ = couponCode.toUpperCase().trim();

    // Find coupon
    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, couponCode_),
    });

    if (!coupon) {
      return {
        success: false,
        error: 'Coupon not found',
      };
    }

    // Check if user already used this coupon
    const alreadyUsed = await hasUserUsedCoupon(couponCode_, userId);
    if (alreadyUsed) {
      return {
        success: false,
        error: 'You have already used this coupon',
      };
    }

    // Record usage in coupon_usage table
    await db.insert(couponUsage).values({
      couponId: coupon.id,
      listingId,
      subscriptionId,
      userId,
      discountAmount: discountAmount.toString(),
    });

    // Increment usage count
    await db
      .update(coupons)
      .set({
        usageCount: sql`usage_count + 1`,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, coupon.id));

    return { success: true };
  } catch (error) {
    console.error('[Coupons] Error recording coupon usage:', error);
    return {
      success: false,
      error: 'Failed to record coupon usage',
    };
  }
}

/**
 * Create a new coupon (admin only)
 * @param code - Coupon code
 * @param discountPercentage - Discount percentage (0-100)
 * @param applicableTiers - Optional array of subscription tier IDs this coupon applies to
 * @param maxUsageCount - Max number of uses
 * @param adminId - Admin ID
 * @param expiresAt - Optional expiry date
 */
export async function createCoupon(
  code: string,
  discountPercentage: number,
  applicableTiers: string[] | undefined,
  maxUsageCount: number,
  adminId: string,
  expiresAt?: string,
  freeListings: number = 0,
  freeListingDurationDays: number = 30
): Promise<{
  success: boolean;
  coupon?: typeof coupons.$inferSelect;
  error?: string;
}> {
  try {
    // Validate inputs
    if (discountPercentage < 0 || discountPercentage > 100) {
      return {
        success: false,
        error: 'Discount percentage must be between 0 and 100',
      };
    }

    if (maxUsageCount < 1) {
      return {
        success: false,
        error: 'Max usage count must be at least 1',
      };
    }

    // Check for existing coupon
    const existing = await db.query.coupons.findFirst({
      where: eq(coupons.code, code.toUpperCase()),
    });

    if (existing) {
      return {
        success: false,
        error: 'Coupon code already exists',
      };
    }

    // Create coupon
    const newCoupon = await db
      .insert(coupons)
      .values({
        code: code.toUpperCase(),
        discountPercentage,
        applicableTiers: applicableTiers && applicableTiers.length > 0 ? JSON.stringify(applicableTiers) : null,
        maxUsageCount,
        usageCount: 0,
        freeListings,
        freeListingDurationDays,
        isActive: true,
        createdBy: adminId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    return {
      success: true,
      coupon: newCoupon[0],
    };
  } catch (error) {
    console.error('[Coupons] Error creating coupon:', error);
    return {
      success: false,
      error: 'Failed to create coupon',
    };
  }
}

/**
 * Get all coupons (admin only)
 */
export async function getAllCoupons(): Promise<(typeof coupons.$inferSelect)[]> {
  try {
    return await db.query.coupons.findMany({
      orderBy: (couponsTable: any, { desc }: any) => [desc(couponsTable.createdAt)],
    });
  } catch (error) {
    console.error('[Coupons] Error fetching coupons:', error);
    return [];
  }
}

/**
 * Get coupon details by ID
 */
export async function getCouponById(id: string): Promise<typeof coupons.$inferSelect | null> {
  try {
    return (
      (await db.query.coupons.findFirst({
        where: eq(coupons.id, id),
      })) ?? null
    );
  } catch (error) {
    console.error('[Coupons] Error fetching coupon:', error);
    return null;
  }
}

/**
 * Update coupon
 */
export async function updateCoupon(
  id: string,
  updates: {
    discountPercentage?: number;
    maxUsageCount?: number;
    isActive?: boolean;
    expiresAt?: string | null;
  }
): Promise<{
  success: boolean;
  coupon?: typeof coupons.$inferSelect;
  error?: string;
}> {
  try {
    const coupon = await getCouponById(id);
    if (!coupon) {
      return {
        success: false,
        error: 'Coupon not found',
      };
    }

    const updated = await db
      .update(coupons)
      .set({
        ...updates,
        expiresAt: updates.expiresAt
          ? new Date(updates.expiresAt)
          : updates.expiresAt === null
            ? null
            : coupon.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, id))
      .returning();

    return {
      success: true,
      coupon: updated[0],
    };
  } catch (error) {
    console.error('[Coupons] Error updating coupon:', error);
    return {
      success: false,
      error: 'Failed to update coupon',
    };
  }
}

/**
 * Delete coupon
 */
export async function deleteCoupon(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await db.delete(coupons).where(eq(coupons.id, id));
    return { success: true };
  } catch (error) {
    console.error('[Coupons] Error deleting coupon:', error);
    return {
      success: false,
      error: 'Failed to delete coupon',
    };
  }
}

/**
 * Get coupon usage statistics
 */
export async function getCouponStats(id: string): Promise<{
  total: number;
  used: number;
  remaining: number;
  usagePercentage: number;
} | null> {
  try {
    const coupon = await getCouponById(id);
    if (!coupon) return null;

    return {
      total: coupon.maxUsageCount,
      used: coupon.usageCount,
      remaining: Math.max(0, coupon.maxUsageCount - coupon.usageCount),
      usagePercentage: (coupon.usageCount / coupon.maxUsageCount) * 100,
    };
  } catch (error) {
    console.error('[Coupons] Error getting coupon stats:', error);
    return null;
  }
}

/**
 * Deactivate a coupon
 */
export async function deactivateCoupon(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const coupon = await getCouponById(id);
    if (!coupon) {
      return {
        success: false,
        error: 'Coupon not found',
      };
    }

    await db
      .update(coupons)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, id));

    return { success: true };
  } catch (error) {
    console.error('[Coupons] Error deactivating coupon:', error);
    return {
      success: false,
      error: 'Failed to deactivate coupon',
    };
  }
}

/**
 * Get remaining free listings for a user from a coupon code.
 * Counts how many free listings the user has already used from this coupon
 * and returns the remaining count.
 *
 * @param couponCode - Coupon code
 * @param userId - User ID (or phone number)
 * @returns Remaining free listings and coupon details
 */
export async function getRemainingFreeListings(
  couponCode: string,
  userId: string
): Promise<{
  remaining: number;
  total: number;
  used: number;
  durationDays: number;
  couponId: string | null;
  error?: string;
}> {
  try {
    const code = couponCode.toUpperCase().trim();

    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, code),
    });

    if (!coupon) {
      return { remaining: 0, total: 0, used: 0, durationDays: 0, couponId: null, error: 'Coupon not found' };
    }

    if (!coupon.isActive) {
      return { remaining: 0, total: 0, used: 0, durationDays: 0, couponId: null, error: 'Coupon is no longer active' };
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { remaining: 0, total: 0, used: 0, durationDays: 0, couponId: null, error: 'Coupon has expired' };
    }

    const totalFreeListings = coupon.freeListings ?? 0;
    if (totalFreeListings <= 0) {
      return { remaining: 0, total: 0, used: 0, durationDays: 0, couponId: coupon.id, error: 'This coupon does not grant free listings' };
    }

    // Count how many free listings this user has used from this coupon
    const usageRecords = await db.query.couponUsage.findMany({
      where: and(
        eq(couponUsage.couponId, coupon.id),
        eq(couponUsage.userId, userId)
      ),
    });

    const used = usageRecords.length;
    const remaining = Math.max(0, totalFreeListings - used);

    return {
      remaining,
      total: totalFreeListings,
      used,
      durationDays: coupon.freeListingDurationDays ?? 30,
      couponId: coupon.id,
    };
  } catch (error) {
    console.error('[Coupons] Error getting remaining free listings:', error);
    return { remaining: 0, total: 0, used: 0, durationDays: 0, couponId: null, error: 'Failed to check free listings' };
  }
}

/**
 * Use a free listing from a coupon.
 * Records the usage and returns durationDays for the free listing.
 *
 * @param couponCode - Coupon code
 * @param userId - User ID (or phone number)
 * @param listingId - The listing ID created
 * @returns Result with duration and remaining count
 */
export async function useFreeListingFromCoupon(
  couponCode: string,
  userId: string,
  listingId: string
): Promise<{
  success: boolean;
  durationDays: number;
  remaining: number;
  error?: string;
}> {
  try {
    const code = couponCode.toUpperCase().trim();

    // First check remaining
    const freeCheck = await getRemainingFreeListings(code, userId);
    if (freeCheck.error || freeCheck.remaining <= 0) {
      return {
        success: false,
        durationDays: 0,
        remaining: 0,
        error: freeCheck.error || 'No free listings remaining on this coupon',
      };
    }

    // Record usage (use discountAmount = 0 for free listing tracking)
    await db.insert(couponUsage).values({
      couponId: freeCheck.couponId!,
      listingId,
      subscriptionId: 'free-listing', // marker for free listing usage
      userId,
      discountAmount: '0',
    });

    // Increment global usage count on coupon
    await db
      .update(coupons)
      .set({
        usageCount: sql`usage_count + 1`,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, freeCheck.couponId!));

    return {
      success: true,
      durationDays: freeCheck.durationDays,
      remaining: freeCheck.remaining - 1,
    };
  } catch (error) {
    console.error('[Coupons] Error using free listing from coupon:', error);
    return {
      success: false,
      durationDays: 0,
      remaining: 0,
      error: 'Failed to use free listing',
    };
  }
}
