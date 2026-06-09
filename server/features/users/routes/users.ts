/**
 * User Management API Routes
 * Handles user profile, listings, and subscriptions
 */

import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getListingsByUser } from '../../listings/services/listings';
import {
  getUserById,
  getUserByPhone,
  isMeaningfulDisplayName,
  normalizePhone,
  pickMeaningfulDisplayName,
  upsertUser,
  type AppUser,
} from '../services/user-profiles';
import { getRequestUserId } from '../../../lib/request-user';
import { db } from '../../../data/db';
import { users } from '../models/users';
import { parseJsonArrayField } from '../../../shared/utils/json-fields';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(String(value || '').trim());
}

export function registerUserRoutes(app: Express) {
  const getDbUser = async (userId: string) => {
    const normalizedId = String(userId || '').trim();
    if (!isUuid(normalizedId)) return null;
    return db.query.users.findFirst({
      where: eq(users.id, normalizedId),
    });
  };

  const syncDbUserProfile = async (
    userId: string,
    avatarUrl: string | undefined,
    profile: {
      name?: string;
      email?: string;
      address?: string;
      gstin?: string;
      latitude?: number | null;
      longitude?: number | null;
    }
  ) => {
    if (!isUuid(userId)) {
      throw new Error('Invalid user id format');
    }

    const dbUser = await getDbUser(userId);
    const profileName =
      typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : '';
    const profileAddress =
      typeof profile.address === 'string' && profile.address.trim() ? profile.address.trim() : '';
    const profileEmail =
      typeof profile.email === 'string' && profile.email.trim() ? profile.email.trim() : '';
    const profileGstin =
      typeof profile.gstin === 'string' && profile.gstin.trim() ? profile.gstin.trim() : '';
    const profileLatitude = typeof profile.latitude === 'number' ? profile.latitude : null;
    const profileLongitude = typeof profile.longitude === 'number' ? profile.longitude : null;

    const normalizedAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';

    if (dbUser?.id) {
      const nextDisplayName = pickMeaningfulDisplayName(profileName, dbUser.displayName) || null;

      await db
        .update(users)
        .set({
          displayName: nextDisplayName,
          email: profileEmail || dbUser.email || null,
          address: profileAddress || dbUser.address || null,
          gstin: profileGstin || dbUser.gstin || null,
          latitude: profileLatitude ?? dbUser.latitude ?? null,
          longitude: profileLongitude ?? dbUser.longitude ?? null,
          avatarUrl: normalizedAvatarUrl || dbUser.avatarUrl || null,
          mobile: dbUser.mobile,
        })
        .where(eq(users.id, dbUser.id));
      return;
    }

    await db
      .insert(users)
      .values({
        id: userId,
        username: userId,
        displayName: pickMeaningfulDisplayName(profileName) || null,
        password: 'otp-auth',
        mobile: null,
        email: profileEmail || null,
        address: profileAddress || null,
        gstin: profileGstin || null,
        latitude: profileLatitude,
        longitude: profileLongitude,
        avatarUrl: normalizedAvatarUrl || null,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: users.username });
  };

  const ensureUser = (userId: string): AppUser => {
    const existing = getUserById(userId);
    if (existing) return existing;

    return upsertUser({
      id: userId,
      phone: normalizePhone(userId),
      name: '',
      email: '',
      gender: 'other',
      avatarUrl: '',
      bio: '',
      address: '',
      gstin: '',
      location: null,
      isVerified: true,
      preferences: {
        notifications: true,
        emailNotifications: true,
        autoLocalizeListings: true,
        searchRadiusKm: 50,
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
      const userId = String(getRequestUserId(req) || '').trim();

      if (!userId || !isUuid(userId)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      let dbUser = await getDbUser(userId);
      if (!dbUser) {
        const seedUser = getUserById(userId);
        await syncDbUserProfile(userId, seedUser?.avatarUrl, {
          name: seedUser?.name,
          email: seedUser?.email,
          address: seedUser?.address,
          gstin: seedUser?.gstin,
        });
        dbUser = await getDbUser(userId);
        if (!dbUser) {
          return res.status(404).json({ error: 'User not found' });
        }
      }
      const existing = getUserById(userId);
      const dbDisplayName = String(dbUser.displayName || '').trim();
      const fallbackName = String(dbUser.username || '').trim();
      const user = upsertUser({
        id: userId,
        phone: normalizePhone(dbUser.mobile || existing?.phone || ''),
        name: pickMeaningfulDisplayName(dbDisplayName, existing?.name, fallbackName) || 'User',
        email: String(dbUser.email || existing?.email || '').trim(),
        gender: existing?.gender || 'other',
        avatarUrl: dbUser.avatarUrl || existing?.avatarUrl || '',
        bio: existing?.bio || '',
        address: String(dbUser.address || existing?.address || '').trim(),
        gstin: String(dbUser.gstin || existing?.gstin || '').trim(),
        location: dbUser.location || existing?.location || null,
        latitude: dbUser.latitude ?? existing?.latitude ?? null,
        longitude: dbUser.longitude ?? existing?.longitude ?? null,
        isVerified: Boolean(dbUser.isVerified || existing?.isVerified),
        preferences: existing?.preferences || {
          notifications: true,
          emailNotifications: true,
          autoLocalizeListings: true,
          searchRadiusKm: 50,
        },
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        address: user.address,
        gstin: user.gstin,
        location: user.location,
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isVerified: user.isVerified || false,
        profileComplete: !!(isMeaningfulDisplayName(user.name) && user.email && user.address),
      });
    } catch (error) {
      console.error('[Users] Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * DELETE /api/users/profile
   * Permanently delete authenticated user's account and related data
   */
  app.delete('/api/users/profile', async (req: Request, res: Response) => {
    try {
      const userId = String(getRequestUserId(req) || '').trim();
      const userPhone = normalizePhone(req.get('x-user-phone') || '');
      const memoryUser = getUserById(userId) || (userPhone ? getUserByPhone(userPhone) : undefined);
      const deletionUserId = String(memoryUser?.id || userId).trim();

      if (!deletionUserId || !isUuid(deletionUserId)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const existing = await getDbUser(deletionUserId);
      if (!existing && !memoryUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { deleteUserDataByAdmin } = await import('../services/user-lifecycle');
      await deleteUserDataByAdmin(deletionUserId);
      await db.delete(users).where(eq(users.id, deletionUserId));

      return res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      console.error('[Users] Error deleting profile:', error);
      return res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  /**
   * GET /api/users/:userId/profile
   * Get user profile by ID
   */
  app.get('/api/users/:userId/profile', async (req: Request, res: Response) => {
    try {
      const userId = String(
        Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId
      ).trim();
      if (!isUuid(userId)) {
        return res.status(400).json({ error: 'Invalid user id format' });
      }

      let user = getUserById(userId);
      const dbUser = await getDbUser(userId);
      if (!dbUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (!user) {
        const dbDisplayName = String(dbUser.displayName || '').trim();
        const fallbackName = String(dbUser.username || '').trim();
        user = upsertUser({
          id: String(dbUser.id),
          phone: normalizePhone(dbUser.mobile || ''),
          name: pickMeaningfulDisplayName(dbDisplayName, fallbackName) || 'User',
          email: String(dbUser.email || '').trim(),
          gender: 'other',
          avatarUrl: dbUser.avatarUrl || '',
          bio: '',
          address: String(dbUser.address || '').trim(),
          gstin: String(dbUser.gstin || '').trim(),
          location: dbUser.location || null,
          latitude: dbUser.latitude ?? null,
          longitude: dbUser.longitude ?? null,
          isVerified: Boolean(dbUser.isVerified),
          createdAt: dbUser.createdAt
            ? new Date(dbUser.createdAt).toISOString()
            : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          preferences: {
            notifications: true,
            emailNotifications: true,
            autoLocalizeListings: true,
            searchRadiusKm: 50,
          },
        });
      } else if (user && dbUser) {
        const dbDisplayName = String(dbUser.displayName || '').trim();
        const fallbackName = String(dbUser.username || '').trim();
        user = upsertUser({
          ...user,
          name: pickMeaningfulDisplayName(dbDisplayName, user.name, fallbackName) || 'User',
          email: String(dbUser.email || user.email || '').trim(),
          avatarUrl: dbUser.avatarUrl || user.avatarUrl,
          address: String(dbUser.address || user.address || '').trim(),
          gstin: String(dbUser.gstin || user.gstin || '').trim(),
          updatedAt: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          address: user.address,
          gstin: user.gstin,
          location: user.location,
          latitude: user.latitude ?? null,
          longitude: user.longitude ?? null,
          preferences: user.preferences,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isVerified: user.isVerified || false,
          profileComplete: !!(isMeaningfulDisplayName(user.name) && user.email && user.address),
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
      const userId = String(
        Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId
      ).trim();
      const requestUserId = String(getRequestUserId(req) || '').trim();
      if (!isUuid(userId)) {
        return res.status(400).json({ error: 'Invalid user id format' });
      }
      if (!isUuid(requestUserId) || requestUserId !== userId) {
        return res.status(403).json({ error: 'You can only update your own profile' });
      }
      const { name, email, bio, address, gstin, avatarUrl } = req.body;
      const latitude = typeof req.body.latitude === 'number' ? req.body.latitude : null;
      const longitude = typeof req.body.longitude === 'number' ? req.body.longitude : null;

      // Validate required fields
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Get existing user or create new one
      let user = ensureUser(String(userId));
      const dbUser = await getDbUser(String(userId));
      const persistedAvatar = String(dbUser?.avatarUrl || '').trim();
      const incomingAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
      const nextAvatar = incomingAvatar || persistedAvatar || user.avatarUrl || '';

      // Update user
      user = {
        ...user,
        name: name.trim(),
        email: email?.trim() || user.email,
        avatarUrl: nextAvatar,
        bio: bio?.trim() || user.bio,
        address: address?.trim() || user.address,
        gstin: gstin?.trim() || user.gstin,
        latitude: latitude ?? user.latitude ?? null,
        longitude: longitude ?? user.longitude ?? null,
        updatedAt: new Date().toISOString(),
      };

      upsertUser(user);
      await syncDbUserProfile(String(userId), user.avatarUrl, {
        name: user.name,
        email: user.email,
        address: user.address,
        gstin: user.gstin,
        latitude: user.latitude,
        longitude: user.longitude,
      });

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          address: user.address,
          gstin: user.gstin,
          latitude: user.latitude ?? null,
          longitude: user.longitude ?? null,
          location: user.location,
          preferences: user.preferences,
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
          images: parseJsonArrayField(listing.images),
          videos: parseJsonArrayField(listing.videos),
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
      const { notifications, emailNotifications, autoLocalize, searchRadiusKm } = req.body;
      const latitude = typeof req.body.latitude === 'number' ? req.body.latitude : null;
      const longitude = typeof req.body.longitude === 'number' ? req.body.longitude : null;

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
          searchRadiusKm:
            typeof searchRadiusKm === 'number'
              ? searchRadiusKm
              : (user.preferences?.searchRadiusKm ?? 50),
        },
        latitude: latitude ?? user.latitude ?? null,
        longitude: longitude ?? user.longitude ?? null,
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
