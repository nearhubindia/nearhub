/**
 * Admin Settings & Configuration Routes
 * Allows admins to manage subscription pricing, discounts, and expiration rules
 */

import type { Express, Request, Response } from 'express';
import { adminAuthMiddleware } from './admin-auth';
import {
  getAdminSettings,
  updateAdminSettings,
  getPricingConfig,
  calculatePriceWithDiscount,
  formatSettingsForDisplay,
  clearSettingsCache,
} from '../services/admin-settings';
import type { AdminSettings } from '../models/admin-settings';

export function registerAdminSettingsRoutes(app: Express) {
  /**
   * GET /api/admin/settings
   * Get current subscription settings (public - for pricing display)
   */
  app.get('/api/admin/settings', async (req: Request, res: Response) => {
    try {
      const settings = await getAdminSettings();

      return res.json({
        success: true,
        settings: {
          image: {
            baseFee: settings.imageFeePerDay,
            minPrice: settings.imageMinPricePerDay,
            maxPrice: settings.imageMaxPricePerDay,
            durations: {
              15: settings.imageDuration15Days,
              45: settings.imageDuration45Days,
              90: settings.imageDuration90Days,
              180: settings.imageDuration180Days,
            },
          },
          video: {
            baseFee: settings.videoFeePerDay,
            minPrice: settings.videoMinPricePerDay,
            maxPrice: settings.videoMaxPricePerDay,
            durations: {
              15: settings.videoDuration15Days,
              45: settings.videoDuration45Days,
              90: settings.videoDuration90Days,
              180: settings.videoDuration180Days,
            },
          },
          freeListingDays: settings.freeListingDays,
          discountEnabled: settings.discountEnabled,
          discountPercentage: settings.discountPercentage,
          reactivationAllowed: settings.allowReactivation,
          mediaDeleteAfterDays: settings.mediaDeleteAfterDays,
          autoDeleteExpiredMedia: settings.autoDeleteExpiredMedia,
          enableDynamicPricing: settings.enableDynamicPricing,
          dynamicPricingAlgorithm: settings.dynamicPricingAlgorithm,
          geoRadiusKm: settings.geoRadiusKm,
        },
      });
    } catch (error) {
      console.error('[Admin Settings] Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  /**
   * GET /api/admin/settings/pricing
   * Get calculated pricing configuration
   */
  app.get('/api/admin/settings/pricing', async (req: Request, res: Response) => {
    try {
      const config = await getPricingConfig();

      return res.json({
        success: true,
        pricing: config,
      });
    } catch (error) {
      console.error('[Admin Settings] Error fetching pricing config:', error);
      res.status(500).json({ error: 'Failed to fetch pricing config' });
    }
  });

  /**
   * POST /api/admin/settings/update
   * Update subscription settings (admin only)
   * Requires authentication/authorization
   */
  app.post('/api/admin/settings/update', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {

      const {
        // Image listing pricing
        imageFeePerDay,
        imageMinPricePerDay,
        imageMaxPricePerDay,
        imageDuration15,
        imageDuration45,
        imageDuration90,
        imageDuration180,
        // Video listing pricing
        videoFeePerDay,
        videoMinPricePerDay,
        videoMaxPricePerDay,
        videoDuration15,
        videoDuration45,
        videoDuration90,
        videoDuration180,
        // Other settings
        freeListingDays,
        discountEnabled,
        discountPercentage,
        discountMinimumDuration,
        discountMaxDiscount,
        autoDeactivateOnExpiry,
        hideFromSearchOnExpiry,
        hideFromShortsOnExpiry,
        allowReactivation,
        reactivationPricingMultiplier,
        gracePeriodDays,
        mediaDeleteAfterDays,
        autoDeleteExpiredMedia,
        enableDynamicPricing,
        dynamicPricingAlgorithm,
        geoRadiusKm,
      } = req.body;

      // Validate inputs
      if (imageFeePerDay && imageFeePerDay < 0) {
        return res.status(400).json({ error: 'Image base fee cannot be negative' });
      }

      if (videoFeePerDay && videoFeePerDay < 0) {
        return res.status(400).json({ error: 'Video base fee cannot be negative' });
      }

      // Validate min/max constraints
      if (imageMinPricePerDay && imageMaxPricePerDay && imageMinPricePerDay > imageMaxPricePerDay) {
        return res.status(400).json({ error: 'Image min price cannot exceed max price' });
      }

      if (videoMinPricePerDay && videoMaxPricePerDay && videoMinPricePerDay > videoMaxPricePerDay) {
        return res.status(400).json({ error: 'Video min price cannot exceed max price' });
      }

      if (discountPercentage && (discountPercentage < 0 || discountPercentage > 100)) {
        return res.status(400).json({ error: 'Discount percentage must be 0-100' });
      }

      if (gracePeriodDays && gracePeriodDays < 0) {
        return res.status(400).json({ error: 'Grace period cannot be negative' });
      }

      if (geoRadiusKm && (geoRadiusKm < 1 || geoRadiusKm > 500)) {
        return res.status(400).json({ error: 'Geo radius must be between 1 and 500 km' });
      }

      // Build update object
      const updates: Partial<AdminSettings> = {};

      // Image pricing
      if (imageFeePerDay !== undefined) updates.imageFeePerDay = imageFeePerDay.toString();
      if (imageMinPricePerDay !== undefined)
        updates.imageMinPricePerDay = imageMinPricePerDay.toString();
      if (imageMaxPricePerDay !== undefined)
        updates.imageMaxPricePerDay = imageMaxPricePerDay.toString();
      if (imageDuration15 !== undefined) updates.imageDuration15Days = imageDuration15.toString();
      if (imageDuration45 !== undefined) updates.imageDuration45Days = imageDuration45.toString();
      if (imageDuration90 !== undefined) updates.imageDuration90Days = imageDuration90.toString();
      if (imageDuration180 !== undefined)
        updates.imageDuration180Days = imageDuration180.toString();

      // Video pricing
      if (videoFeePerDay !== undefined) updates.videoFeePerDay = videoFeePerDay.toString();
      if (videoMinPricePerDay !== undefined)
        updates.videoMinPricePerDay = videoMinPricePerDay.toString();
      if (videoMaxPricePerDay !== undefined)
        updates.videoMaxPricePerDay = videoMaxPricePerDay.toString();
      if (videoDuration15 !== undefined) updates.videoDuration15Days = videoDuration15.toString();
      if (videoDuration45 !== undefined) updates.videoDuration45Days = videoDuration45.toString();
      if (videoDuration90 !== undefined) updates.videoDuration90Days = videoDuration90.toString();
      if (videoDuration180 !== undefined)
        updates.videoDuration180Days = videoDuration180.toString();

      if (freeListingDays !== undefined) updates.freeListingDays = freeListingDays;
      if (discountEnabled !== undefined) updates.discountEnabled = discountEnabled;
      if (discountPercentage !== undefined) updates.discountPercentage = discountPercentage;
      if (discountMinimumDuration !== undefined)
        updates.discountMinimumDuration = discountMinimumDuration;
      if (discountMaxDiscount !== undefined)
        updates.discountMaxDiscount = discountMaxDiscount.toString();
      if (autoDeactivateOnExpiry !== undefined)
        updates.autoDeactivateOnExpiry = autoDeactivateOnExpiry;
      if (hideFromSearchOnExpiry !== undefined)
        updates.hideFromSearchOnExpiry = hideFromSearchOnExpiry;
      if (hideFromShortsOnExpiry !== undefined)
        updates.hideFromShortsOnExpiry = hideFromShortsOnExpiry;
      if (allowReactivation !== undefined) updates.allowReactivation = allowReactivation;
      if (reactivationPricingMultiplier !== undefined)
        updates.reactivationPricingMultiplier = reactivationPricingMultiplier.toString();
      if (gracePeriodDays !== undefined) updates.gracePeriodDays = gracePeriodDays;
      if (mediaDeleteAfterDays !== undefined) updates.mediaDeleteAfterDays = mediaDeleteAfterDays;
      if (autoDeleteExpiredMedia !== undefined)
        updates.autoDeleteExpiredMedia = autoDeleteExpiredMedia;
      if (enableDynamicPricing !== undefined) updates.enableDynamicPricing = enableDynamicPricing;
      if (dynamicPricingAlgorithm !== undefined)
        updates.dynamicPricingAlgorithm = dynamicPricingAlgorithm;
      if (geoRadiusKm !== undefined) updates.geoRadiusKm = geoRadiusKm;

      const updatedSettings = await updateAdminSettings(updates);

      return res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: updatedSettings,
      });
    } catch (error) {
      console.error('[Admin Settings] Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  /**
   * GET /api/admin/settings/discount-preview
   * Preview price with discount applied
   * Query: ?basePrice=75000&duration=45
   */
  app.get('/api/admin/settings/discount-preview', async (req: Request, res: Response) => {
    try {
      const { basePrice, duration } = req.query;

      if (!basePrice || !duration) {
        return res.status(400).json({
          error: 'Missing parameters: basePrice, duration',
        });
      }

      const price = parseFloat(basePrice as string);
      const durationDays = parseInt(duration as string) as 15 | 45 | 90 | 180;

      if (![15, 45, 90, 180].includes(durationDays)) {
        return res.status(400).json({
          error: 'Invalid duration. Must be 15, 45, 90, or 180',
        });
      }

      const result = await calculatePriceWithDiscount(price, durationDays);

      return res.json({
        success: true,
        preview: {
          basePrice: result.basePrice,
          discount: result.discount,
          discountPercent: result.discountPercent,
          finalPrice: result.finalPrice,
          savings: result.basePrice - result.finalPrice,
        },
      });
    } catch (error) {
      console.error('[Admin Settings] Error calculating discount preview:', error);
      res.status(500).json({ error: 'Failed to calculate discount preview' });
    }
  });

  /**
   * POST /api/admin/settings/reset
   * Reset all settings to defaults (admin only)
   */
  app.post('/api/admin/settings/reset', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {

      clearSettingsCache();

      const settings = await getAdminSettings();

      return res.json({
        success: true,
        message: 'Settings reset to defaults',
        settings,
      });
    } catch (error) {
      console.error('[Admin Settings] Error resetting settings:', error);
      res.status(500).json({ error: 'Failed to reset settings' });
    }
  });

  /**
   * GET /api/admin/settings/display
   * Get formatted settings for display
   */
  app.get('/api/admin/settings/display', async (req: Request, res: Response) => {
    try {
      const formatted = await formatSettingsForDisplay();

      return res.json({
        success: true,
        display: formatted,
      });
    } catch (error) {
      console.error('[Admin Settings] Error formatting settings:', error);
      res.status(500).json({ error: 'Failed to format settings' });
    }
  });

  console.log('[Routes] Admin settings routes registered');
}
