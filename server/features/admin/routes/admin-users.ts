import type { Express, Response } from 'express';
import { eq, inArray, or } from 'drizzle-orm';
import { db } from '../../../data/db';
import { users } from '../../users/models/users';
import type { AuthRequest } from '../../../lib/types';
import { handleError, notFound } from '../../../lib/error-handler';
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

export function registerAdminUsersRoutes(app: Express) {
  /**
   * GET /api/admin/users
   * Get all users (admin only)
   */
  app.get('/api/admin/users', async (req: AuthRequest, res: Response) => {
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
      const latestListingById = new Map<
        string,
        { location: string | null; createdAt: Date | null; contactPhone: string | null }
      >();
      for (const row of listingRows) {
        const existing = latestListingById.get(row.userId);
        if (!existing) {
          latestListingById.set(row.userId, {
            location: row.location || null,
            createdAt: row.createdAt || null,
            contactPhone: row.contactPhone || null,
          });
        } else if (row.createdAt && existing.createdAt && row.createdAt > existing.createdAt) {
          latestListingById.set(row.userId, {
            location: row.location || null,
            createdAt: row.createdAt || null,
            contactPhone: row.contactPhone || null,
          });
        }
      }

      const deduped = new Map<
        string,
        {
          id: string;
          username: string;
          mobile: string;
          location: string;
          isVerified: boolean;
          createdAt: string;
        }
      >();
      idList.forEach((id) => {
        const meta = metaById.get(id);
        const activity = activityById.get(id);
        const latestListing = latestListingById.get(id);
        const mobile = normalizeMobile(meta?.mobile || latestListing?.contactPhone || id);
        if (!mobile) {
          return;
        }
        const existing = deduped.get(mobile);
        const candidate = {
          id: mobile,
          username: mobile, // Canonical: username == mobile to avoid identity duplication.
          mobile,
          location: latestListing?.location || meta?.location || '-',
          isVerified: Boolean(meta?.isVerified),
          createdAt:
            activity?.firstSeenAt?.toISOString() ||
            latestListing?.createdAt?.toISOString() ||
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
  app.get('/api/admin/users/:id', async (req: AuthRequest, res: Response) => {
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
          .orderBy(listings.createdAt)
          .limit(1),
      ]);

      if (meta.length === 0 && activity.length === 0 && latestListing.length === 0) {
        return notFound(res, 'User');
      }

      const userMeta = meta[0];
      const userActivityRow = activity[0];
      const latestListingRow = latestListing[0];
      const safeUser = {
        id,
        username: normalizeMobile(userMeta?.mobile || id) || id,
        mobile: normalizeMobile(userMeta?.mobile || id) || '-',
        location: latestListingRow?.location || userMeta?.location || '-',
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
  app.delete('/api/admin/users/:id', async (req: AuthRequest, res: Response) => {
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
  });

  /**
   * PUT /api/admin/users/:id
   * Update user data (admin only)
   */
  app.put('/api/admin/users/:id', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const { username, mobile, location, isVerified } = req.body;
      const normalizedMobile = normalizeMobile(mobile || id);

      if (!normalizedMobile || !location) {
        return res.status(400).json({
          success: false,
          message: 'Valid mobile number and location are required',
        });
      }

      const upserted = await db
        .insert(users)
        .values({
          id: normalizedMobile,
          username: normalizedMobile,
          password: 'admin-managed',
          mobile: normalizedMobile,
          location,
          isVerified: Boolean(isVerified),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            username: normalizedMobile,
            mobile: normalizedMobile,
            location,
            isVerified: Boolean(isVerified),
          },
        })
        .returning();

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
