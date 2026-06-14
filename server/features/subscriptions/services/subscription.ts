/**
 * Subscription Service
 * Orchestrates listing creation, pricing, and payment flow
 * Integrates with admin settings for dynamic pricing
 */

import {
  isListingFree,
  getPricingForDuration,
  calculateExpiryDate,
  type DurationOption,
} from './pricing';
import { getRazorpayService } from '../../payments/services/razorpay';
import {
  getAdminSettings,
  calculatePriceWithDiscount,
  getPricingConfig,
} from '../../admin/services/admin-settings';

export interface CreateListingRequest {
  userId: string;
  title: string;
  description: string;
  mainCategory?: string;
  subCategory?: string;
  subcategory?: string;
  category: string;
  price: number;
  offerPrice?: number;
  priceUnit?: string;
  condition?: string;
  images?: string[];
  videoUrl?: string;
  listingType: 'image' | 'video'; // NEW: Required to determine pricing
  location: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  isDeal?: boolean;
  dealType?: 'normal' | 'combo';
  dealStartAt?: string;
  dealEndAt?: string;
  dealRecurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dealRecurrenceUntil?: string;
  dealCycleQuantity?: number;
  maxDealBookings?: number;
  purchaseLimitType?: 'ONE_TIME' | 'UNLIMITED';
  comboItems?: string[];
  dealTerms?: string;
  voucherEnabled?: boolean;
  attributes?: Record<string, string | number | boolean>;
}

export interface CheckoutRequest extends CreateListingRequest {
  duration: DurationOption;
}

export interface CheckoutResponse {
  // Listing info
  listing: {
    title: string;
    price: number;
    isPaid: boolean;
    durationDays?: number;
  };

  // Subscription info (if paid)
  subscription?: {
    id: string;
    totalFee: number;
    durationLabel: string;
    expiresAt: Date;
  };

  // Payment info (if paid)
  payment?: {
    razorpayOrderId: string;
    amount: number; // in paise
    key: string; // Public key for Razorpay
  };

  // Free tier (if < 3000)
  message?: string;
}

/**
 * Calculate checkout details (pricing, fees, etc.)
 */
export async function calculateCheckout(req: CheckoutRequest): Promise<{
  isFree: boolean;
  pricing?: {
    duration: DurationOption;
    totalFee: number;
    durationLabel: string;
    expiresAt: Date;
  };
}> {
  if (isListingFree(req.price)) {
    return { isFree: true };
  }

  const pricing = getPricingForDuration(req.price, req.duration);

  if (!pricing.totalFee || !pricing.durationLabel) {
    throw new Error('Invalid pricing calculation');
  }

  return {
    isFree: false,
    pricing: {
      duration: req.duration,
      totalFee: pricing.totalFee,
      durationLabel: pricing.durationLabel,
      expiresAt: calculateExpiryDate(new Date(), req.duration),
    },
  };
}

/**
 * Get listing summary for checkout
 */
export function getListingCheckoutSummary(req: CreateListingRequest) {
  const isFree = isListingFree(req.price);
  const conditionLabel =
    typeof req.condition === 'string' && req.condition.trim() ? req.condition.trim() : 'N/A';

  return {
    title: req.title,
    category: req.category,
    price: req.price,
    condition: conditionLabel,
    isFree,
    message: isFree
      ? '✓ Your listing is FREE (product price < ₹3000)'
      : '📋 Choose listing duration to continue for products ≥ ₹3000',
  };
}

/**
 * Calculate and initiate Razorpay payment
 */
export async function initiatePayment(
  subscriptionId: string,
  userId: string,
  listingId: string,
  listingTitle: string,
  totalFee: number,
  duration: DurationOption
): Promise<{
  razorpayOrderId: string;
  amount: number;
  key: string;
  subscriptionId: string;
}> {
  const razorpay = getRazorpayService();

  // Amount in paise (₹1 = 100 paise)
  const amountInPaise = Math.round(totalFee * 100);

  const receiptId = razorpay.generateReceiptId(userId, listingId);

  const order = await razorpay.createOrder({
    amount: amountInPaise,
    receipt: receiptId,
    notes: {
      userId,
      listingId,
      subscriptionId,
      listingTitle,
      duration,
    },
  });

  return {
    razorpayOrderId: order.id,
    amount: amountInPaise,
    key: process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY || '',
    subscriptionId,
  };
}

/**
 * Verify payment and activate subscription
 * Returns true if payment is verified and legitimate
 */
export function verifyPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean {
  const razorpay = getRazorpayService();

  const isValid = razorpay.verifyPaymentSignature({
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  });

  return isValid;
}

/**
 * Generate payment summary
 */
export function generatePaymentSummary(
  listing: CreateListingRequest,
  pricingInfo: {
    totalFee: number;
    durationLabel: string;
    expiresAt: Date;
  }
): string {
  const conditionLabel =
    typeof listing.condition === 'string' && listing.condition.trim()
      ? listing.condition.trim()
      : 'N/A';
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      LISTING SUBSCRIPTION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Listing Details:
   Title: ${listing.title}
   Category: ${listing.category}
   Price: ₹${listing.price.toLocaleString('en-IN')}
   Condition: ${conditionLabel}

💳 Subscription Details:
   Duration: ${pricingInfo.durationLabel}
   Fee: ₹${pricingInfo.totalFee.toLocaleString('en-IN')}
   Expires: ${pricingInfo.expiresAt.toLocaleDateString('en-IN')}

Status: Ready for payment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

/**
 * Listing fee breakdown
 */
export function breakdownFee(totalFee: number, duration: DurationOption): string {
  const basePerDay = 99;
  const days = duration;
  const perDay = totalFee / days;

  return `
Fee Breakdown:
- Base fee: ₹${basePerDay}/15 days
- Duration: ${days} days
- Cost per day: ₹${perDay.toFixed(2)}
- Total: ₹${totalFee.toLocaleString('en-IN')}
  `.trim();
}

/**
 * Check if payment is required
 */
export function isPaymentRequired(productPrice: number): boolean {
  return !isListingFree(productPrice);
}

/**
 * Get available durations with pricing
 */
export function getAvailableDurations(productPrice: number) {
  if (isListingFree(productPrice)) {
    return [];
  }

  return [
    { duration: 15 as DurationOption, fee: 99, label: '15 days' },
    { duration: 45 as DurationOption, fee: 297, label: '45 days' },
    { duration: 90 as DurationOption, fee: 594, label: '3 months' },
    { duration: 180 as DurationOption, fee: 1188, label: '6 months' },
  ];
}

/**
 * Get available durations with dynamic pricing from admin settings
 * Now supports separate pricing for image and video listings
 */
export async function getAvailableDurationsWithAdminPricing(
  productPrice: number,
  listingType: 'image' | 'video' = 'image'
) {
  if (isListingFree(productPrice)) {
    return [];
  }

  const settings = await getAdminSettings();

  // Select pricing based on listing type
  if (listingType === 'video') {
    return [
      {
        duration: 15 as DurationOption,
        fee: parseFloat(settings.videoDuration15Days),
        label: '15 days',
        type: 'video',
      },
      {
        duration: 45 as DurationOption,
        fee: parseFloat(settings.videoDuration45Days),
        label: '45 days',
        type: 'video',
      },
      {
        duration: 90 as DurationOption,
        fee: parseFloat(settings.videoDuration90Days),
        label: '3 months',
        type: 'video',
      },
      {
        duration: 180 as DurationOption,
        fee: parseFloat(settings.videoDuration180Days),
        label: '6 months',
        type: 'video',
      },
    ];
  }

  // Default to image pricing
  return [
    {
      duration: 15 as DurationOption,
      fee: parseFloat(settings.imageDuration15Days),
      label: '15 days',
      type: 'image',
    },
    {
      duration: 45 as DurationOption,
      fee: parseFloat(settings.imageDuration45Days),
      label: '45 days',
      type: 'image',
    },
    {
      duration: 90 as DurationOption,
      fee: parseFloat(settings.imageDuration90Days),
      label: '3 months',
      type: 'image',
    },
    {
      duration: 180 as DurationOption,
      fee: parseFloat(settings.imageDuration180Days),
      label: '6 months',
      type: 'image',
    },
  ];
}

/**
 * Calculate checkout with admin settings applied
 * Now supports separate pricing for image and video listings
 */
export async function calculateCheckoutWithAdminSettings(req: CheckoutRequest): Promise<{
  isFree: boolean;
  pricing?: {
    duration: DurationOption;
    basePrice: number;
    discount: number;
    discountPercent: number;
    finalPrice: number;
    durationLabel: string;
    expiresAt: Date;
    listingType: 'image' | 'video';
    appliedAdminSettings: {
      feePerDay: string;
      discountEnabled: boolean;
      discountPercent: number;
    };
  };
}> {
  // Check free tier from admin settings
  const settings = await getAdminSettings();

  if (parseFloat(req.price as any) < parseFloat(settings.freeTierThreshold ?? '3000')) {
    return { isFree: true };
  }

  const listingType = req.listingType || 'image';

  // Get duration-based price (different for image vs video)
  const durationPrices: Record<DurationOption, string> =
    listingType === 'video'
      ? {
          15: settings.videoDuration15Days,
          45: settings.videoDuration45Days,
          90: settings.videoDuration90Days,
          180: settings.videoDuration180Days,
        }
      : {
          15: settings.imageDuration15Days,
          45: settings.imageDuration45Days,
          90: settings.imageDuration90Days,
          180: settings.imageDuration180Days,
        };

  const basePrice = parseFloat(durationPrices[req.duration]);

  // Apply discount if configured
  const priceWithDiscount = await calculatePriceWithDiscount(
    basePrice,
    req.duration as 15 | 45 | 90 | 180
  );

  return {
    isFree: false,
    pricing: {
      duration: req.duration,
      basePrice: priceWithDiscount.basePrice,
      discount: priceWithDiscount.discount,
      discountPercent: priceWithDiscount.discountPercent,
      finalPrice: priceWithDiscount.finalPrice,
      durationLabel: getDurationLabelFromNumber(req.duration),
      expiresAt: calculateExpiryDate(new Date(), req.duration),
      listingType,
      appliedAdminSettings: {
        feePerDay: listingType === 'video' ? settings.videoFeePerDay : settings.imageFeePerDay,
        discountEnabled: settings.discountEnabled ?? false,
        discountPercent: settings.discountPercentage ?? 0,
      },
    },
  };
}

/**
 * Helper: Convert duration to label
 */
function getDurationLabelFromNumber(duration: DurationOption): string {
  const labels: Record<DurationOption, string> = {
    15: '15 days',
    45: '45 days',
    90: '3 months',
    180: '6 months',
  };
  return labels[duration] || 'Unknown';
}
