import type { Express, Response } from 'express';
import { desc, eq, inArray, or } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../../data/db';
import { users } from '../../users/models/users';
import type { AuthRequest } from '../../../lib/types';
import { handleError, notFound } from '../../../lib/error-handler';
import { adminAuthMiddleware } from './admin-auth';
import {
  listings,
  userActivity,
  userStarterCredits,
  userSubscriptions,
} from '../models/admin-settings';
import { deleteUserDataByAdmin } from '../../users/services/user-lifecycle';

function normalizeMobile(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 10 ? digits : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function resolveDisplayName(input: {
  mobile: string;
  username?: string | null;
  displayName?: string | null;
}): string {
  const rawDisplayName = String(input.displayName || '').trim();
  if (rawDisplayName && !/^\d{10}$/.test(rawDisplayName)) {
    return rawDisplayName;
  }
  const rawUsername = String(input.username || '').trim();
  if (rawUsername && !/^\d{10}$/.test(rawUsername)) {
    return rawUsername;
  }
  const suffix = input.mobile.slice(-4) || input.mobile || 'User';
  return `User ${suffix}`;
}

type ListingAggregate = {
  count: number;
  latestCreatedAt: Date | null;
  latestLocation: string | null;
  latestContactPhone: string | null;
  locations: Set<string>;
};

export function registerAdminUsersRoutes(app: Express) {
  /**
   * GET /api/admin/users
   * Get all users (admin only)
   */
  app.get('/api/admin/users', adminAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const [activityRows, listingRows, subscriptionRows, starterRows] = await Promise.all([
        db
          .select({ userId: userActivity.userId, firstSeenAt: userActivity.firstSeenAt })
          .from(userActivity),
        db
          .select({
            userId: listings.sellerId,
            createdAt: listings.createdAt,
            location: listings.location,
            contactPhone: listings.contactPhone,
          })
          .from(listings),
        db.select({ userId: userSubscriptions.userId }).from(userSubscriptions),
        db.select({ userId: userStarterCredits.userId }).from(userStarterCredits),
      ]);

      const userIds = new Set<string>();
      activityRows.forEach((row) => userIds.add(row.userId));
      listingRows.forEach((row) => userIds.add(row.userId));
      subscriptionRows.forEach((row) => userIds.add(row.userId));
      starterRows.forEach((row) => userIds.add(row.userId));

      const idList = [...userIds].filter(Boolean).slice(0, 1000);
      if (idList.length === 0) {
        return res.json({ success: true, data: [], total: 0 });
      }

      const metaRows = await db
        .select()
        .from(users)
        .where(or(inArray(users.id, idList), inArray(users.mobile, idList))!);

      const metaById = new Map<string, (typeof metaRows)[number]>();
      for (const row of metaRows) {
        if (row.id) metaById.set(row.id, row);
        if (row.mobile) metaById.set(row.mobile, row);
      }

      const activityById = new Map(activityRows.map((row) => [row.userId, row]));
      const listingAggregateById = new Map<string, ListingAggregate>();
      for (const row of listingRows) {
        const key = String(row.userId || '').trim();
        if (!key) continue;
        const existing = listingAggregateById.get(key) || {
          count: 0,
          latestCreatedAt: null,
          latestLocation: null,
          latestContactPhone: null,
          locations: new Set<string>(),
        };

        const createdAt = row.createdAt || null;
        const location = String(row.location || '').trim();
        const contactPhone = String(row.contactPhone || '').trim();

        existing.count += 1;
        if (location) {
          existing.locations.add(location);
        }

        if (
          !existing.latestCreatedAt ||
          (createdAt && createdAt.getTime() > existing.latestCreatedAt.getTime())
        ) {
          existing.latestCreatedAt = createdAt;
          existing.latestLocation = location || null;
          existing.latestContactPhone = contactPhone || null;
        }
        listingAggregateById.set(key, existing);
      }

      const deduped = new Map<
        string,
        {
          id: string;
          displayName: string;
          username: string;
          mobile: string;
          autoDetectedLocation: string;
          location: string;
          listingsCount: number;
          listings: number;
          listingLocations: string[];
          isVerified: boolean;
          createdAt: string;
        }
      >();
      idList.forEach((id) => {
        const meta = metaById.get(id);
        const activity = activityById.get(id);
        const listingAggregateForId = listingAggregateById.get(id);
        const mobile = normalizeMobile(
          meta?.mobile || listingAggregateForId?.latestContactPhone || id
        );
        if (!mobile) {
          return;
        }
        const listingAggregate =
          listingAggregateForId || listingAggregateById.get(mobile) || undefined;

        const listingLocations = listingAggregate
          ? [...listingAggregate.locations].sort((a, b) => a.localeCompare(b))
          : [];
        const autoDetectedLocation = listingAggregate?.latestLocation || meta?.location || '-';
        const displayName = resolveDisplayName({
          mobile,
          username: meta?.username,
          displayName: meta?.displayName,
        });
        const existing = deduped.get(mobile);
        const candidate = {
          id: mobile,
          username: mobile, // Canonical: username == mobile to avoid identity duplication.
          displayName,
          mobile,
          autoDetectedLocation,
          location: autoDetectedLocation, // Backward compatibility for old admin UI.
          listingsCount: listingAggregate?.count || 0,
          listings: listingAggregate?.count || 0, // Backward compatibility alias.
          listingLocations,
          isVerified: Boolean(meta?.isVerified),
          createdAt:
            activity?.firstSeenAt?.toISOString() ||
            listingAggregate?.latestCreatedAt?.toISOString() ||
            meta?.createdAt?.toISOString() ||
            new Date().toISOString(),
        };
        if (
          !existing ||
          new Date(candidate.createdAt).getTime() > new Date(existing.createdAt).getTime()
        ) {
          deduped.set(mobile, candidate);
        }
      });

      const safeUsers = [...deduped.values()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json({
        success: true,
        data: safeUsers,
        total: safeUsers.length,
      });
    } catch (error) {
      console.error('[Admin Users] Error fetching users:', error);
      handleError(res, error, '[Admin Users]', 'Failed to fetch users');
    }
  });

  /**
   * GET /api/admin/users/:id
   * Get user by ID (admin only)
   */
  app.get('/api/admin/users/:id', adminAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const [meta, activity, latestListing] = await Promise.all([
        db
          .select()
          .from(users)
          .where(or(eq(users.id, id), eq(users.mobile, id))!)
          .limit(1),
        db.select().from(userActivity).where(eq(userActivity.userId, id)).limit(1),
        db
          .select({ location: listings.location, createdAt: listings.createdAt })
          .from(listings)
          .where(eq(listings.sellerId, id))
          .orderBy(desc(listings.createdAt))
          .limit(1),
      ]);

      if (meta.length === 0 && activity.length === 0 && latestListing.length === 0) {
        return notFound(res, 'User');
      }

      const userMeta = meta[0];
      const userActivityRow = activity[0];
      const latestListingRow = latestListing[0];
      const mobile = normalizeMobile(userMeta?.mobile || id) || '-';
      const autoDetectedLocation = latestListingRow?.location || userMeta?.location || '-';
      const safeUser = {
        id,
        username: mobile,
        displayName: resolveDisplayName({
          mobile,
          username: userMeta?.username,
          displayName: userMeta?.displayName,
        }),
        mobile,
        autoDetectedLocation,
        location: autoDetectedLocation,
        listingsCount: latestListingRow ? 1 : 0,
        listings: latestListingRow ? 1 : 0,
        listingLocations: latestListingRow?.location ? [latestListingRow.location] : [],
        isVerified: Boolean(userMeta?.isVerified),
        createdAt:
          userActivityRow?.firstSeenAt?.toISOString() ||
          latestListingRow?.createdAt?.toISOString() ||
          userMeta?.createdAt?.toISOString() ||
          new Date().toISOString(),
      };

      res.json({
        success: true,
        data: safeUser,
      });
    } catch (error) {
      console.error('[Admin Users] Error fetching user:', error);
      handleError(res, error, '[Admin Users]', 'Failed to fetch user');
    }
  });

  /**
   * DELETE /api/admin/users/:id
   * Delete user (admin only)
   */
  app.delete(
    '/api/admin/users/:id',
    adminAuthMiddleware,
    async (req: AuthRequest, res: Response) => {
      try {
        const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
        const impact = await deleteUserDataByAdmin(id);
        await db.delete(users).where(or(eq(users.id, id), eq(users.mobile, id))!);

        res.json({
          success: true,
          message: 'User and related data deleted successfully',
          impact,
        });
      } catch (error) {
        console.error('[Admin Users] Error deleting user:', error);
        handleError(res, error, '[Admin Users]', 'Failed to delete user');
      }
    }
  );

  /**
   * PUT /api/admin/users/:id
   * Update user data (admin only)
   */
  app.put('/api/admin/users/:id', adminAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const { username, mobile, location, isVerified } = req.body;
      const normalizedMobile = normalizeMobile(mobile || id);
      const normalizedLocation = String(location || '').trim();
      const normalizedUsername = String(username || '').trim();

      if (!normalizedMobile || !normalizedLocation) {
        return res.status(400).json({
          success: false,
          message: 'Valid mobile number and location are required',
        });
      }

      const candidateIds = [id, normalizedMobile, normalizedUsername].filter(Boolean);
      const candidateMobiles = [normalizeMobile(id), normalizedMobile].filter(Boolean);
      const candidateUsernames = [id, normalizedUsername, normalizedMobile].filter(Boolean);

      const existingRows = await db
        .select()
        .from(users)
        .where(
          or(
            inArray(users.id, [...new Set(candidateIds)]),
            inArray(users.mobile, [...new Set(candidateMobiles)]),
            inArray(users.username, [...new Set(candidateUsernames)])
          )!
        )
        .limit(10);

      const existingById = existingRows.find((row) => row.id === id);
      const existingByMobile = existingRows.find(
        (row) =>
          row.mobile === normalizedMobile ||
          (normalizeMobile(id) && row.mobile === normalizeMobile(id))
      );
      const existingByUsername = existingRows.find(
        (row) =>
          row.username === id ||
          row.username === normalizedUsername ||
          row.username === normalizedMobile
      );
      const existing = existingById || existingByMobile || existingByUsername;

      let upserted: typeof existingRows = [];
      if (existing) {
        upserted = await db
          .update(users)
          .set({
            mobile: normalizedMobile,
            location: normalizedLocation,
            isVerified: Boolean(isVerified),
          })
          .where(eq(users.id, existing.id))
          .returning();
      } else {
        const nextId = isUuid(id) ? id : crypto.randomUUID();
        const nextUsername = normalizedUsername || normalizedMobile || nextId;
        upserted = await db
          .insert(users)
          .values({
            id: nextId,
            username: nextUsername,
            password: 'admin-managed',
            mobile: normalizedMobile,
            location: normalizedLocation,
            isVerified: Boolean(isVerified),
          })
          .onConflictDoUpdate({
            target: users.username,
            set: {
              mobile: normalizedMobile,
              location: normalizedLocation,
              isVerified: Boolean(isVerified),
            },
          })
          .returning();
      }

      const updatedUser = upserted[0];
      const safeUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        mobile: updatedUser.mobile || '-',
        location: updatedUser.location || '-',
        isVerified: Boolean(updatedUser.isVerified),
        createdAt: updatedUser.createdAt?.toISOString() || new Date().toISOString(),
      };

      res.json({
        success: true,
        data: safeUser,
        message: 'User updated successfully',
      });
    } catch (error) {
      console.error('[Admin Users] Error updating user:', error);
      handleError(res, error, '[Admin Users]', 'Failed to update user');
    }
  });
}
