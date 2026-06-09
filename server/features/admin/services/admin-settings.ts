/**
 * Admin Settings Service
 * Manages subscription pricing configuration
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '../../../data/db';
import { adminSettings as adminSettingsTable } from '../models/admin-settings';
import type { AdminSettings, PricingConfiguration } from '../models/admin-settings';

// In-memory cache for admin settings (refresh every 5 minutes)
let cachedSettings: AdminSettings | null = null;
let cacheExpiresAt: number = 0;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;

const DEFAULT_SETTINGS: AdminSettings = {
  id: 'default',
  // Image listing pricing
  imageFeePerDay: '99',
  imageMinPricePerDay: '49',
  imageMaxPricePerDay: '199',
  imageDuration15Days: '1485',
  imageDuration45Days: '4455',
  imageDuration90Days: '8910',
  imageDuration180Days: '17820',
  // Video listing pricing (50% premium over images)
  videoFeePerDay: '149',
  videoMinPricePerDay: '79',
  videoMaxPricePerDay: '299',
  videoDuration15Days: '2235',
  videoDuration45Days: '6705',
  videoDuration90Days: '13410',
  videoDuration180Days: '26820',
  freeListingDays: 15,
  starterCreditsEnabled: true,
  starterListingsCount: 2,
  starterBoostsCount: 2,
  freeTierThreshold: '3000',
  discountEnabled: false,
  discountPercentage: 0,
  discountMinimumDuration: 45,
  discountMaxDiscount: '0',
  autoDeactivateOnExpiry: true,
  hideFromSearchOnExpiry: true,
  hideFromShortsOnExpiry: true,
  allowReactivation: true,
  reactivationPricingMultiplier: '1',
  gracePeriodDays: 30,
  mediaDeleteAfterDays: 60,
  autoDeleteExpiredMedia: true,
  enableDynamicPricing: false,
  dynamicPricingAlgorithm: 'demand_supply',
  geoRadiusKm: 50,
  listingCategoryGroups: null,
  listingPriceUnits: ['per unit', 'per piece'],
  attributesByKey: {},
  inactiveUserReviewDays: 90,
  forceUpdateEnabled: false,
  minSupportedVersion: '1.0.0',
  minSupportedAndroidBuildNumber: 1,
  minSupportedIosBuildNumber: 1,
  forceUpdateMessage: 'A new app version is required to continue. Please update now.',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.synvide.nearhub',
  appStoreUrl: '',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Get admin settings (with caching)
 */
export async function getAdminSettings(): Promise<AdminSettings> {
  const now = Date.now();

  if (cachedSettings && cacheExpiresAt > now) {
    return cachedSettings;
  }

  try {
    const [latestSettings] = await db
      .select()
      .from(adminSettingsTable)
      .orderBy(desc(adminSettingsTable.updatedAt))
      .limit(1);

    cachedSettings = latestSettings ? { ...DEFAULT_SETTINGS, ...latestSettings } : DEFAULT_SETTINGS;
  } catch (error) {
    console.warn('[AdminSettings] Falling back to in-memory defaults:', error);
    cachedSettings = cachedSettings ?? DEFAULT_SETTINGS;
  }
  cacheExpiresAt = now + SETTINGS_CACHE_TTL_MS;

  return cachedSettings;
}

/**
 * Get pricing configuration (derived from settings)
 * Using unified pricing for all listings (5 images + 2 videos)
 */
export async function getPricingConfig(): Promise<PricingConfiguration> {
  const settings = await getAdminSettings();

  return {
    imagePricing: {
      // Unified fee for all listings (regardless of image/video type)
      feePerDay: parseFloat(settings.imageFeePerDay ?? '99'),
      durations: {
        15: parseFloat(settings.imageDuration15Days ?? '1485'),
        45: parseFloat(settings.imageDuration45Days ?? '4455'),
        90: parseFloat(settings.imageDuration90Days ?? '8910'),
        180: parseFloat(settings.imageDuration180Days ?? '17820'),
      },
    },
    videoPricing: {
      // Deprecated: kept for backward compatibility, use imagePricing instead
      feePerDay: parseFloat(settings.imageFeePerDay ?? '99'),
      durations: {
        15: parseFloat(settings.imageDuration15Days ?? '1485'),
        45: parseFloat(settings.imageDuration45Days ?? '4455'),
        90: parseFloat(settings.imageDuration90Days ?? '8910'),
        180: parseFloat(settings.imageDuration180Days ?? '17820'),
      },
    },
    freeTierThreshold: parseFloat(settings.freeTierThreshold ?? '3000'),
    discount: {
      enabled: settings.discountEnabled ?? false,
      percentage: settings.discountPercentage ?? 0,
      minDuration: settings.discountMinimumDuration ?? 45,
      maxDiscount: parseFloat(settings.discountMaxDiscount ?? '0'),
    },
    expiration: {
      autoDeactivate: settings.autoDeactivateOnExpiry ?? true,
      hideFromSearch: settings.hideFromSearchOnExpiry ?? true,
      hideFromShorts: settings.hideFromShortsOnExpiry ?? true,
    },
    reactivation: {
      allowed: settings.allowReactivation ?? true,
      priceMultiplier: parseFloat(settings.reactivationPricingMultiplier ?? '1'),
    },
    mediaDeletion: {
      autoDelete: settings.autoDeleteExpiredMedia ?? true,
      deleteAfterDays: settings.mediaDeleteAfterDays ?? 60,
    },
  };
}

/**
 * Update admin settings
 * @returns Updated settings
 */
export async function updateAdminSettings(updates: Partial<AdminSettings>): Promise<AdminSettings> {
  const now = new Date();
  try {
    const [existingSettings] = await db
      .select()
      .from(adminSettingsTable)
      .orderBy(desc(adminSettingsTable.updatedAt))
      .limit(1);

    let persistedSettings: AdminSettings;
    if (existingSettings) {
      const [updatedSettings] = await db
        .update(adminSettingsTable)
        .set({
          ...updates,
          updatedAt: now,
        })
        .where(eq(adminSettingsTable.id, existingSettings.id))
        .returning();
      persistedSettings = updatedSettings;
    } else {
      const [createdSettings] = await db
        .insert(adminSettingsTable)
        .values({
          ...DEFAULT_SETTINGS,
          ...updates,
          updatedAt: now,
        })
        .returning();
      persistedSettings = createdSettings;
    }

    cachedSettings = { ...DEFAULT_SETTINGS, ...persistedSettings };
  } catch (error) {
    console.warn('[AdminSettings] DB update failed, using in-memory fallback:', error);
    const base = cachedSettings ?? DEFAULT_SETTINGS;
    cachedSettings = {
      ...base,
      ...updates,
      updatedAt: now,
    };
  }
  cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;

  console.log('[AdminSettings] Updated:', Object.keys(updates).join(', '));

  return cachedSettings;
}

/**
 * Clear settings cache (force refresh on next read)
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
  cacheExpiresAt = 0;
}

/**
 * Calculate price with discount
 */
export async function calculatePriceWithDiscount(
  basePrice: number,
  duration: 15 | 45 | 90 | 180
): Promise<{ basePrice: number; discount: number; finalPrice: number; discountPercent: number }> {
  const config = await getPricingConfig();

  // Only apply discount if enabled and duration meets minimum
  if (!config.discount.enabled || duration < config.discount.minDuration) {
    return {
      basePrice,
      discount: 0,
      finalPrice: basePrice,
      discountPercent: 0,
    };
  }

  // Calculate discount
  const discountAmount = (basePrice * config.discount.percentage) / 100;
  const maxDiscount = config.discount.maxDiscount;
  const actualDiscount = Math.min(discountAmount, maxDiscount);
  const finalPrice = basePrice - actualDiscount;

  return {
    basePrice,
    discount: actualDiscount,
    finalPrice: Math.max(finalPrice, basePrice * 0.5), // Min 50% of original
    discountPercent: config.discount.percentage,
  };
}

/**
 * Check if listing should be visible
 */
export async function isListingVisible(expiresAt: Date, isActive: boolean): Promise<boolean> {
  if (!isActive) {
    return false;
  }

  const settings = await getAdminSettings();

  if (settings.autoDeactivateOnExpiry && expiresAt < new Date()) {
    return false;
  }

  return true;
}

/**
 * Get grace period end date
 */
export async function getGracePeriodEndDate(expiresAt: Date): Promise<Date> {
  const settings = await getAdminSettings();
  const endDate = new Date(expiresAt);
  endDate.setDate(endDate.getDate() + (settings.gracePeriodDays ?? 30));
  return endDate;
}

/**
 * Check if listing is in grace period
 */
export async function isInGracePeriod(expiresAt: Date): Promise<boolean> {
  const settings = await getAdminSettings();
  const gracePeriodEnd = new Date(expiresAt);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + (settings.gracePeriodDays ?? 30));

  const now = new Date();
  return expiresAt < now && now < gracePeriodEnd;
}

/**
 * Format settings for display
 */
export async function formatSettingsForDisplay(): Promise<string> {
  const settings = await getAdminSettings();

  return `
Admin Subscription Settings
══════════════════════════════════════

UNIFIED LISTING PRICING (5 images + 2 videos per listing):
  Base Fee: ₹${settings.imageFeePerDay}/day
  Duration Fees:
    15 days: ₹${settings.imageDuration15Days}
    45 days: ₹${settings.imageDuration45Days}
    90 days: ₹${settings.imageDuration90Days}
    180 days: ₹${settings.imageDuration180Days}

Free Tier Threshold: ₹${settings.freeTierThreshold}

Free Tier Threshold: ₹${settings.freeTierThreshold}

Starter Credits:
  Enabled: ${settings.starterCreditsEnabled ? 'Yes' : 'No'}
  Free listings: ${settings.starterListingsCount}
  Free boosts: ${settings.starterBoostsCount}

Discount:
  Enabled: ${settings.discountEnabled ? 'Yes' : 'No'}
  Amount: ${settings.discountPercentage}% (max ₹${settings.discountMaxDiscount})
  Min Duration: ${settings.discountMinimumDuration} days

Expiration:
  Auto-deactivate: ${settings.autoDeactivateOnExpiry ? 'Yes' : 'No'}
  Hide from search: ${settings.hideFromSearchOnExpiry ? 'Yes' : 'No'}
  Hide from shorts: ${settings.hideFromShortsOnExpiry ? 'Yes' : 'No'}
  Grace period: ${settings.gracePeriodDays} days

Media Deletion:
  Auto-delete expired media: ${settings.autoDeleteExpiredMedia ? 'Yes' : 'No'}
  Delete after: ${settings.mediaDeleteAfterDays} days

Reactivation:
  Allowed: ${settings.allowReactivation ? 'Yes' : 'No'}
  Price multiplier: ${settings.reactivationPricingMultiplier}x

Inactive User Review:
  Inactivity threshold: ${settings.inactiveUserReviewDays} days

App Hard Update:
  Enabled: ${settings.forceUpdateEnabled ? 'Yes' : 'No'}
  Min Version: ${settings.minSupportedVersion}
  Min Android Build: ${settings.minSupportedAndroidBuildNumber}
  Min iOS Build: ${settings.minSupportedIosBuildNumber}
  `.trim();
}
