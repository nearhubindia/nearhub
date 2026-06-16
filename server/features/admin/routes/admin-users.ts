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
import {
  getUserById,
  getUserByPhone,
  pickMeaningfulDisplayName,
} from '../../users/services/user-profiles';
import {
  grantUserSubscription,
  getSubscriptionTierById,
  getUserActiveSubscriptions,
} from '../../subscriptions/services/subscription-tiers';
import { invalidateUserSubscriptionCache } from '../../subscriptions/services/subscription-cache';

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
  profileName?: string | null;
}): string {
  const displayName = pickMeaningfulDisplayName(
    input.profileName,
    input.displayName,
    input.username
  );
  if (displayName) return displayName;

  if (input.mobile) {
    return input.mobile;
  }

  return '-';
}

function resolveAdminIdentity(meta: {
  id: string;
  username?: string | null;
  displayName?: string | null;
  mobile?: string | null;
}): {
  mobile: string;
  displayName: string;
} {
  const id = String(meta.id || '').trim();
  const profileUser = getUserById(id) || getUserByPhone(meta.mobile || meta.username || id);
  const mobile = normalizeMobile(meta.mobile || profileUser?.phone || meta.username || id);
  const profileName = String(profileUser?.name || '').trim();
  const displayName = resolveDisplayName({
    mobile,
    username: meta.username,
    displayName: meta.displayName,
    profileName,
  });

  return {
    mobile,
    displayName,
  };
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

type UserRow = typeof users.$inferSelect;

type AdminUserWriteInput = {
  id?: string;
  username?: string;
  displayName?: string;
  mobile?: string;
  location?: string;
  isVerified?: boolean;
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveStoredDisplayName(params: {
  displayName?: string | null;
  username?: string | null;
  mobile?: string | null;
  existing?: UserRow | null;
}): string | null {
  const displayName = pickMeaningfulDisplayName(
    params.displayName,
    params.existing?.displayName,
    params.username,
    params.existing?.username,
    params.mobile
  );
  return displayName || null;
}

async function upsertAdminUserRecord(input: AdminUserWriteInput): Promise<UserRow> {
  const normalizedId = normalizeText(input.id);
  const normalizedUsername = normalizeText(input.username);
  const normalizedDisplayName = normalizeText(input.displayName);
  const normalizedMobile = normalizeMobile(input.mobile || normalizedId);
  const normalizedLocation = normalizeText(input.location);

  if (!normalizedMobile || !normalizedLocation) {
    throw new Error('Valid mobile number and location are required');
  }

  const lookupFilters = [eq(users.mobile, normalizedMobile)];
  if (normalizedId) lookupFilters.push(eq(users.id, normalizedId));
  if (normalizedUsername) lookupFilters.push(eq(users.username, normalizedUsername));

  const existing = await db.query.users.findFirst({
    where: or(...lookupFilters),
  });

  const resolvedDisplayName = resolveStoredDisplayName({
    displayName: normalizedDisplayName,
    username: normalizedUsername,
    mobile: normalizedMobile,
    existing,
  });
  const resolvedUsername = normalizedUsername || normalizedMobile || existing?.username || '';

  if (existing) {
    const [updatedUser] = await db
      .update(users)
      .set({
        username: resolvedUsername || existing.username,
        displayName: resolvedDisplayName ?? existing.displayName,
        mobile: normalizedMobile,
        location: normalizedLocation,
        isVerified: Boolean(input.isVerified),
      })
      .where(eq(users.id, existing.id))
      .returning();

    return updatedUser;
  }

  const nextId = normalizedId && isUuid(normalizedId) ? normalizedId : crypto.randomUUID();
  const [createdUser] = await db
    .insert(users)
    .values({
      id: nextId,
      username: resolvedUsername || normalizedMobile || nextId,
      displayName: resolvedDisplayName,
      password: 'admin-managed',
      mobile: normalizedMobile,
      location: normalizedLocation,
      isVerified: Boolean(input.isVerified),
    })
    .returning();

  return createdUser;
}

function toAdminUserResponse(user: UserRow) {
  const mobile = normalizeMobile(user.mobile || '');
  const displayName = resolveStoredDisplayName({
    displayName: user.displayName || undefined,
    username: user.username || undefined,
    mobile: mobile || undefined,
    existing: user,
  });

  return {
    id: String(user.id),
    username: String(user.username || mobile || ''),
    displayName: displayName || mobile || '-',
    mobile: mobile || '-',
    location: String(user.location || '-'),
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
  };
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
        const resolvedIdentity = resolveAdminIdentity({
          id: String(meta.id || '').trim(),
          username: meta.username,
          displayName: meta.displayName,
          mobile: meta.mobile,
        });
        const normalizedMobile = resolvedIdentity.mobile;
        const keys = [
          ...new Set(
            [String(meta.id).trim(), normalizedMobile, String(meta.username || '').trim()].filter(
              Boolean
            )
          ),
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
        const resolvedIdentity = resolveAdminIdentity({
          id: String(meta.id || '').trim(),
          username: meta.username,
          displayName: meta.displayName,
          mobile: meta.mobile,
        });
        const userMobile = resolvedIdentity.mobile || '-';
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
        return {
          id: String(meta.id),
          username: userMobile || '',
          displayName: resolvedIdentity.displayName || userMobile,
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
   * POST /api/admin/users
   * Create user (admin only)
   */
  app.post('/api/admin/users', adminAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id, username, displayName, mobile, location, isVerified } = req.body;
      const normalizedMobile = normalizeMobile(mobile || id);
      const normalizedLocation = normalizeText(location);

      if (!normalizedMobile || !normalizedLocation) {
        return res.status(400).json({
          success: false,
          message: 'Valid mobile number and location are required',
        });
      }

      const user = await upsertAdminUserRecord({
        id,
        username,
        displayName,
        mobile: normalizedMobile,
        location: normalizedLocation,
        isVerified: Boolean(isVerified),
      });

      return res.status(201).json({
        success: true,
        data: toAdminUserResponse(user),
        message: 'User created successfully',
      });
    } catch (error) {
      console.error('[Admin Users] Error creating user:', error);
      handleError(res, error, '[Admin Users]', 'Failed to create user');
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
      const resolvedUserId = userMeta?.id || id;
      const subscriptions = resolvedUserId
        ? await getUserActiveSubscriptions(String(resolvedUserId)).catch((error) => {
            console.error('[Admin Users] Failed to load user subscriptions:', error);
            return [];
          })
        : [];
      const resolvedIdentity = resolveAdminIdentity({
        id,
        username: userMeta?.username,
        displayName: userMeta?.displayName,
        mobile: userMeta?.mobile,
      });
      const mobile = resolvedIdentity.mobile || '-';
      const autoDetectedLocation = latestListingRow?.location || userMeta?.location || '-';
      const safeUser = {
        id,
        username: mobile,
        displayName: resolvedIdentity.displayName || mobile,
        mobile,
        autoDetectedLocation,
        location: autoDetectedLocation,
        listingsCount: latestListingRow ? 1 : 0,
        listings: latestListingRow ? 1 : 0,
        listingLocations: latestListingRow?.location ? [latestListingRow.location] : [],
        isVerified: Boolean(userMeta?.isVerified),
        subscriptions: subscriptions.map((subscription) => ({
          id: String(subscription.id),
          userId: String(subscription.userId),
          subscriptionTierId: String(subscription.subscriptionTierId),
          status: String(subscription.status || 'active'),
          expiresAt: subscription.expiresAt?.toISOString() || new Date().toISOString(),
          subscribedAt: subscription.subscribedAt?.toISOString() || null,
          updatedAt: subscription.updatedAt?.toISOString() || null,
          autoRenew: Boolean(subscription.autoRenew),
          boostsRemaining: Number(subscription.boostsRemaining || 0),
          paymentId: subscription.paymentId || null,
          orderId: subscription.orderId || null,
          invoiceId: subscription.invoiceId || null,
          tier: subscription.tier
            ? {
                id: String(subscription.tier.id),
                name: String(subscription.tier.name || ''),
                type: subscription.tier.type || null,
                description: subscription.tier.description || null,
                price: subscription.tier.price ?? null,
                offerPrice: subscription.tier.offerPrice ?? null,
                durationDays: Number(subscription.tier.durationDays || 0),
                maxListings: Number(subscription.tier.maxListings || 0),
                boostCredits: Number(subscription.tier.boostCredits || 0),
                features: subscription.tier.features || [],
                highlight: Boolean(subscription.tier.highlight),
              }
            : null,
        })),
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
   * POST /api/admin/users/:id/subscriptions
   * Grant an active subscription to a user (admin only)
   */
  app.post(
    '/api/admin/users/:id/subscriptions',
    adminAuthMiddleware,
    async (req: AuthRequest, res: Response) => {
      try {
        const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
        const { tierId, durationDays } = req.body;
        const resolvedUser = await db.query.users.findFirst({
          where: or(eq(users.id, id), eq(users.mobile, id), eq(users.username, id)),
        });

        if (!resolvedUser?.id) {
          return notFound(res, 'User');
        }

        const normalizedTierId = typeof tierId === 'string' ? tierId.trim() : '';
        if (!normalizedTierId) {
          return res.status(400).json({
            success: false,
            error: 'Subscription tier is required',
          });
        }

        const tier = await getSubscriptionTierById(normalizedTierId);
        if (!tier || !tier.isActive) {
          return res.status(400).json({
            success: false,
            error: 'Invalid or inactive subscription tier',
          });
        }

        const parsedDurationDays = Number(durationDays);
        const effectiveDurationDays =
          Number.isFinite(parsedDurationDays) && parsedDurationDays > 0
            ? Math.floor(parsedDurationDays)
            : Number(tier.durationDays || 30);
        const expiresAt = new Date(
          Date.now() + effectiveDurationDays * 24 * 60 * 60 * 1000
        );
        const subscription = await grantUserSubscription(resolvedUser.id, normalizedTierId, expiresAt, {
          paymentId: `admin-grant:${(req as AuthRequest & { admin?: { id?: string } }).admin?.id || 'admin'}`,
        });

        await invalidateUserSubscriptionCache(resolvedUser.id).catch((error) => {
          console.error('[Admin Users] Failed to invalidate user subscription cache:', error);
        });

        res.status(201).json({
          success: true,
          data: {
            id: subscription.id,
            userId: subscription.userId,
            tierId: subscription.subscriptionTierId,
            status: subscription.status,
            boostsRemaining: subscription.boostsRemaining,
            expiresAt: subscription.expiresAt?.toISOString() || null,
            subscribedAt: subscription.subscribedAt?.toISOString() || null,
          },
          message: 'Subscription granted successfully',
        });
      } catch (error) {
        console.error('[Admin Users] Error granting subscription:', error);
        handleError(res, error, '[Admin Users]', 'Failed to grant subscription');
      }
    }
  );

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
      const { username, displayName, mobile, location, isVerified } = req.body;
      const normalizedMobile = normalizeMobile(mobile || id);
      const normalizedLocation = normalizeText(location);

      if (!normalizedMobile || !normalizedLocation) {
        return res.status(400).json({
          success: false,
          message: 'Valid mobile number and location are required',
        });
      }

      const updatedUser = await upsertAdminUserRecord({
        id,
        username,
        displayName,
        mobile: normalizedMobile,
        location: normalizedLocation,
        isVerified: Boolean(isVerified),
      });

      res.json({
        success: true,
        data: toAdminUserResponse(updatedUser),
        message: 'User updated successfully',
      });
    } catch (error) {
      console.error('[Admin Users] Error updating user:', error);
      handleError(res, error, '[Admin Users]', 'Failed to update user');
    }
  });
}
