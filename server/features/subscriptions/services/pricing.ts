/**
 * Pricing Service
 * Handles all pricing calculations for listings
 */

import { getAdminSettings } from '../../admin/services/admin-settings';

export type DurationOption = 15 | 45 | 90 | 180;

const PRICING_CONFIG = {
  FEE_PER_DAY: 99, // Base fee per 15 days (deprecated - use admin settings)
  DURATION_OPTIONS: [15, 45, 90, 180] as const,
  MULTIPLIERS: {
    15: 1, // 15 days = ₹99 × 1
    45: 3, // 45 days = ₹99 × 3
    90: 6, // 90 days = ₹99 × 6
    180: 12, // 180 days = ₹99 × 12
  },
};

export interface PricingInfo {
  productPrice: number;
  isFree: boolean;
  duration?: DurationOption;
  totalFee?: number;
  feePerDay?: number;
  durationLabel?: string;
}

/**
 * Get free listing days from admin settings
 */
async function getFreeListingDays(): Promise<number> {
  const settings = await getAdminSettings();
  return settings.freeListingDays ?? 15;
}

/**
 * Check if listing is within its free period (first N days after creation)
 * This should be called when checking an EXISTING listing's creation date
 */
export async function isListingInFreePeriodAsync(createdAt: Date): Promise<boolean> {
  const freeDays = await getFreeListingDays();
  const createdDate = new Date(createdAt);
  const now = new Date();
  const daysElapsed = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysElapsed < freeDays;
}

/**
 * Check if a NEW listing should be free (always true now - but kept for reference)
 * All new listings are free for the first N days
 */
export function isNewListingFree(): boolean {
  // All new listings are free for first N days (configured in admin settings)
  return true;
}

/**
 * Get free tier threshold from admin settings (DEPRECATED - use freeListingDays instead)
 */
async function getFreeTierThreshold(): Promise<number> {
  const settings = await getAdminSettings();
  return parseFloat(settings.freeTierThreshold ?? '3000');
}

/**
 * Check if listing is free based on price (async - uses admin settings)
 */
export async function isListingFreeAsync(productPrice: number): Promise<boolean> {
  const threshold = await getFreeTierThreshold();
  return productPrice < threshold;
}

/**
 * Check if listing is free (sync version - uses hardcoded default, use async version for admin-configured)
 */
export function isListingFree(productPrice: number): boolean {
  // DEPRECATED: This uses hardcoded default. Use isListingFreeAsync() for admin-configured threshold
  return productPrice < 3000;
}

/**
 * Get pricing for a specific duration
 */
export function getPricingForDuration(productPrice: number, duration: DurationOption): PricingInfo {
  if (isListingFree(productPrice)) {
    return {
      productPrice,
      isFree: true,
    };
  }

  const multiplier = PRICING_CONFIG.MULTIPLIERS[duration] || 1;
  const totalFee = PRICING_CONFIG.FEE_PER_DAY * multiplier;

  const durationLabels: Record<DurationOption, string> = {
    15: '15 days',
    45: '45 days',
    90: '3 months',
    180: '6 months',
  };

  return {
    productPrice,
    isFree: false,
    duration,
    totalFee,
    feePerDay: PRICING_CONFIG.FEE_PER_DAY,
    durationLabel: durationLabels[duration],
  };
}

/**
 * Get all pricing options for a product
 */
export function getAllPricingOptions(productPrice: number): PricingInfo[] {
  if (isListingFree(productPrice)) {
    return [
      {
        productPrice,
        isFree: true,
        durationLabel: 'Free (Unlimited)',
      },
    ];
  }

  return (PRICING_CONFIG.DURATION_OPTIONS as unknown as DurationOption[]).map((duration) =>
    getPricingForDuration(productPrice, duration)
  );
}

/**
 * Calculate expiry date from start date and duration
 */
export function calculateExpiryDate(startDate: Date, duration: DurationOption): Date {
  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + duration);
  return expiryDate;
}

/**
 * Check if listing has expired
 */
export function hasListingExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}

/**
 * Get days remaining until expiry
 */
export function getDaysRemaining(expiryDate: Date): number {
  const now = new Date();
  const diff = expiryDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Validate duration option
 */
export function isValidDuration(duration: DurationOption): boolean {
  return PRICING_CONFIG.DURATION_OPTIONS.includes(duration);
}

/**
 * Get configuration for UI
 */
export function getPricingConfig() {
  return PRICING_CONFIG;
}

/**
 * Format price in INR
 */
export function formatPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Generate pricing summary
 */
export function generatePricingSummary(productPrice: number, duration?: DurationOption): string {
  if (isListingFree(productPrice)) {
    return `Your listing is FREE (product price < ₹3000)`;
  }

  if (!duration) {
    return `Paid listing required (product price ≥ ₹3000). Choose a duration to continue.`;
  }

  const pricing = getPricingForDuration(productPrice, duration);
  return `
Listing Duration: ${pricing.durationLabel}
Total Fee: ${formatPrice(pricing.totalFee!)}
Expires on: ${calculateExpiryDate(new Date(), duration).toLocaleDateString()}
  `.trim();
}
