import type { Express, Response } from 'express';
import { desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../../data/db';
import { users } from '../../users/models/users';
import type { AuthRequest } from '../../../lib/types';
import { handleError, notFound } from '../../../lib/error-handler';
import { adminAuthMiddleware } from './admin-auth';
import { listings, userActivity } from '../models/admin-settings';
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
  locations: Set<string>;
};

function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function getSearchFilter(searchTerm: string) {
  const normalized = searchTerm.trim();
  if (!normalized) return undefined;
  const pattern = `%${normalized.replace(/[%_]/g, '').trim()}%`;
  if (!pattern || pattern === '%%') return undefined;
  return or(
    ilike(users.username, pattern),
    ilike(users.mobile, pattern),
    ilike(users.displayName, pattern),
    ilike(users.location, pattern)
  )!;
}

export function registerAdminUsersRoutes(app: Express) {
  /**
   * GET /api/admin/users
   * Get all users (admin only)
   */
  app.get('/api/admin/users', adminAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const limit = toPositiveInt(req.query.limit, 100, 250);
      const offset = toNonNegativeInt(req.query.offset, 0);
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const searchFilter = getSearchFilter(search);

      const totalRows = searchFilter
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(searchFilter)
        : await db.select({ count: sql<number>`count(*)` }).from(users);
      const total = Number(totalRows[0]?.count || 0);

      const userQuery = db.select().from(users);
      const metaRows = await (searchFilter ? userQuery.where(searchFilter) : userQuery)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      if (metaRows.length === 0) {
        return res.json({
          success: true,
          data: [],
          total,
          limit,
          offset,
          hasMore: false,
        });
      }

      const userIds = metaRows.map((row) => String(row.id).trim()).filter(Boolean);
      const activityRows =
        userIds.length > 0
          ? await db
              .select({ userId: userActivity.userId, firstSeenAt: userActivity.firstSeenAt })
              .from(userActivity)
              .where(inArray(userActivity.userId, userIds))
          : [];
      const activityById = new Map(activityRows.map((row) => [String(row.userId), row]));

      const listingLookupKeysByUser = new Map<string, string[]>();
      const listingLookupKeys: string[] = [];
      for (const meta of metaRows) {
        const normalizedMobile = normalizeMobile(meta.mobile || meta.username || meta.id);
        const rawUsername = String(meta.username || '').trim();
        const keys = [
          ...new Set([String(meta.id).trim(), normalizedMobile, rawUsername].filter(Boolean)),
        ];
        listingLookupKeysByUser.set(String(meta.id), keys);
        listingLookupKeys.push(...keys);
      }
      const uniqueListingLookupKeys = [...new Set(listingLookupKeys)];
      const listingRows =
        uniqueListingLookupKeys.length > 0
          ? await db
              .select({
                userId: listings.sellerId,
                createdAt: listings.createdAt,
                location: listings.location,
              })
              .from(listings)
              .where(inArray(listings.sellerId, uniqueListingLookupKeys))
          : [];
      const listingAggregateByKey = new Map<string, ListingAggregate>();
      for (const row of listingRows) {
        const key = String(row.userId || '').trim();
        if (!key) continue;
        const existing = listingAggregateByKey.get(key) || {
          count: 0,
          latestCreatedAt: null,
          latestLocation: null,
          locations: new Set<string>(),
        };

        const createdAt = row.createdAt || null;
        const location = String(row.location || '').trim();
        existing.count += 1;
        if (location) existing.locations.add(location);
        if (
          !existing.latestCreatedAt ||
          (createdAt && createdAt.getTime() > existing.latestCreatedAt.getTime())
        ) {
          existing.latestCreatedAt = createdAt;
          existing.latestLocation = location || null;
        }
        listingAggregateByKey.set(key, existing);
      }

      const safeUsers = metaRows.map((meta) => {
        const normalizedMobile = normalizeMobile(meta.mobile || meta.username || meta.id);
        const fallbackMobile = String(meta.mobile || meta.username || '').trim();
        const userMobile = normalizedMobile || fallbackMobile || '-';
        const listingAggregates = (listingLookupKeysByUser.get(String(meta.id)) || [])
          .map((key) => listingAggregateByKey.get(key))
          .filter((value): value is ListingAggregate => Boolean(value));
        const mergedAggregate = listingAggregates.reduce<ListingAggregate>(
          (acc, current) => {
            acc.count += current.count;
            for (const location of current.locations) {
              acc.locations.add(location);
            }
            if (
              !acc.latestCreatedAt ||
              (current.latestCreatedAt &&
                current.latestCreatedAt.getTime() > acc.latestCreatedAt.getTime())
            ) {
              acc.latestCreatedAt = current.latestCreatedAt;
              acc.latestLocation = current.latestLocation;
            }
            return acc;
          },
          {
            count: 0,
            latestCreatedAt: null,
            latestLocation: null,
            locations: new Set<string>(),
          }
        );
        const listingLocations = [...mergedAggregate.locations].sort((a, b) => a.localeCompare(b));
        const autoDetectedLocation = mergedAggregate.latestLocation || meta?.location || '-';
        const displayName = resolveDisplayName({
          mobile: userMobile,
          username: meta?.username,
          displayName: meta?.displayName,
        });
        return {
          id: String(meta.id),
          username: meta.username || userMobile,
          displayName,
          mobile: userMobile,
          autoDetectedLocation,
          location: autoDetectedLocation, // Backward compatibility for old admin UI.
          listingsCount: mergedAggregate.count || 0,
          listings: mergedAggregate.count || 0, // Backward compatibility alias.
          listingLocations,
          isVerified: Boolean(meta?.isVerified),
          createdAt:
            activityById.get(String(meta.id))?.firstSeenAt?.toISOString() ||
            mergedAggregate.latestCreatedAt?.toISOString() ||
            meta?.createdAt?.toISOString() ||
            new Date().toISOString(),
        };
      });
      res.json({
        success: true,
        data: safeUsers,
        total,
        limit,
        offset,
        hasMore: offset + safeUsers.length < total,
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
