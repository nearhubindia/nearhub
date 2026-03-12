/**
 * User Management API Routes
 * Handles user profile, listings, and subscriptions
 */

import type { Express, Request, Response } from 'express';
import { getListingsByUser } from '../../listings/services/listings';
import { getUserById, normalizePhone, upsertUser, type AppUser } from '../services/user-profiles';
import { getRequestUserId } from '../../../lib/request-user';

function parseJsonField(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
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
  return [];
}

export function registerUserRoutes(app: Express) {
  const ensureUser = (userId: string): AppUser => {
    const existing = getUserById(userId);
    if (existing) return existing;

    return upsertUser({
      id: userId,
      phone: normalizePhone(userId),
      name: '',
      email: '',
      gender: 'other',
      bio: '',
      address: '',
      gstin: '',
      location: null,
      isVerified: true,
      preferences: {
        notifications: true,
        emailNotifications: true,
        autoLocalizeListings: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  /**
   * GET /api/users/profile
   * Get authenticated user's profile
   */
  app.get('/api/users/profile', async (req: Request, res: Response) => {
    try {
      // Get userId from request context (set by middleware)
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user from storage, or create a default user if doesn't exist
      const user = ensureUser(String(userId));

      return res.json({
        success: true,
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        bio: user.bio,
        address: user.address,
        gstin: user.gstin,
        location: user.location,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isVerified: user.isVerified || true,
        profileComplete: !!(user.name && user.email && user.address),
      });
    } catch (error) {
      console.error('[Users] Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * GET /api/users/:userId/profile
   * Get user profile by ID
   */
  app.get('/api/users/:userId/profile', async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

      // Get user from storage (mock)
      const user = getUserById(String(userId));

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          bio: user.bio,
          address: user.address,
          gstin: user.gstin,
          location: user.location,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isVerified: user.isVerified || true,
          profileComplete: !!(user.name && user.email && user.address),
        },
      });
    } catch (error) {
      console.error('[Users] Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * PUT /api/users/:userId/profile
   * Update user profile (creates user if doesn't exist)
   */
  app.put('/api/users/:userId/profile', async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const { name, email, bio, address, gstin } = req.body;

      // Validate required fields
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Get existing user or create new one
      let user = ensureUser(String(userId));

      // Update user
      user = {
        ...user,
        name: name.trim(),
        email: email?.trim() || user.email,
        bio: bio?.trim() || user.bio,
        address: address?.trim() || user.address,
        gstin: gstin?.trim() || user.gstin,
        updatedAt: new Date().toISOString(),
      };

      upsertUser(user);

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          bio: user.bio,
          address: user.address,
          gstin: user.gstin,
          location: user.location,
        },
      });
    } catch (error) {
      console.error('[Users] Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * GET /api/users/:userId/listings
   * Get user's listings
   */
  app.get('/api/users/:userId/listings', async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const { status } = req.query; // 'active', 'sold', 'expired'

      let userListings = await getListingsByUser(userId);

      // Filter by status if provided
      if (status) {
        if (status === 'expired') {
          userListings = userListings.filter((listing) => {
            if (!listing.expiresAt) return false;
            return new Date(listing.expiresAt) < new Date();
          });
        } else {
          userListings = userListings.filter((listing) => listing.status === String(status));
        }
      }

      // Sort by creation date (newest first)
      userListings.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return res.json({
        listings: userListings.map((listing) => ({
          ...listing,
          userId: listing.sellerId,
          price: Number(listing.price),
          offerPrice:
            listing.offerPrice !== undefined && listing.offerPrice !== null
              ? Number(listing.offerPrice)
              : undefined,
          images: parseJsonField(listing.images),
          videos: parseJsonField(listing.videos),
        })),
        total: userListings.length,
      });
    } catch (error) {
      console.error('[Users] Error fetching listings:', error);
      res.status(500).json({ error: 'Failed to fetch listings' });
    }
  });

  /**
   * GET /api/users/:userId/subscriptions
   * Get user's subscriptions
   */
  app.get('/api/users/:userId/subscriptions', async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

      const userListings = await getListingsByUser(userId);
      const userSubscriptions = userListings
        .filter((listing) => listing.isPaid)
        .map((listing) => ({
          id: `sub-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          price: Number(listing.price),
          duration: listing.durationDays || 0,
          status:
            listing.expiresAt && new Date(listing.expiresAt) < new Date()
              ? 'expired'
              : listing.isActive
                ? 'active'
                : 'cancelled',
          startDate: listing.createdAt,
          expiresAt: listing.expiresAt || '',
          paymentId: `pay_${listing.id.substring(0, 8)}`,
        }));

      // Sort by creation date (newest first)
      userSubscriptions.sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );

      return res.json({
        subscriptions: userSubscriptions,
        total: userSubscriptions.length,
        active: userSubscriptions.filter((s) => s.status === 'active').length,
      });
    } catch (error) {
      console.error('[Users] Error fetching subscriptions:', error);
      res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
  });

  /**
   * GET /api/users/:userId/stats
   * Get user statistics
   */
  app.get('/api/users/:userId/stats', async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

      const userListings = await getListingsByUser(userId);

      const stats = {
        totalListings: userListings.length,
        activeListings: userListings.filter((l) => l.status === 'active').length,
        soldListings: userListings.filter((l) => l.status === 'sold').length,
        totalSubscriptions: userListings.filter((l) => l.isPaid).length,
        totalRevenue: userListings
          .filter((l) => l.status === 'sold')
          .reduce((sum, l) => sum + Number(l.price), 0),
      };

      return res.json({ stats });
    } catch (error) {
      console.error('[Users] Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * PUT /api/users/:userId/settings
   * Update user settings
   */
  app.put('/api/users/:userId/settings', async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const { notifications, emailNotifications, autoLocalize } = req.body;

      // Get existing user
      let user = getUserById(String(userId));

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update settings
      user = {
        ...user,
        preferences: {
          ...user.preferences,
          notifications: notifications ?? user.preferences?.notifications,
          emailNotifications: emailNotifications ?? user.preferences?.emailNotifications,
          autoLocalizeListings: autoLocalize ?? user.preferences?.autoLocalizeListings,
        },
        updatedAt: new Date().toISOString(),
      };

      upsertUser(user);

      return res.json({
        success: true,
        message: 'Settings updated successfully',
        preferences: user.preferences,
      });
    } catch (error) {
      console.error('[Users] Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  console.log('[Users] User routes registered');
}
