import type { Express, Request, Response } from 'express';
import { eq, or } from 'drizzle-orm';
import { otpService } from '../../../shared/utils/otp';
import { validateImageWithPhi2, validateVideoWithPhi2 } from '../../../shared/ai/ai';
import { authLimiter } from '../../../lib/rate-limiter';
import { grantStarterCreditsIfEligible } from '../../subscriptions/services/starter-credits';
import { db } from '../../../data/db';
import { listings, userStarterCredits, userSubscriptions } from '../../admin/models/admin-settings';
import { users } from '../../users/models/users';
import {
  getStableUserIdFromPhone,
  getUserByPhone,
  normalizePhone,
  type AppUser,
  upsertUserFromAuth,
} from '../../users/services/user-profiles';
import { touchUserActivity } from '../../users/services/user-lifecycle';

async function upsertAuthUserRecord(input: {
  phone: string;
  email?: string;
  avatarUrl?: string;
  name?: string;
  preferredId?: string;
}): Promise<void> {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) return;
  const preferredId = String(input.preferredId || '').trim();
  const canLookupById = preferredId && isUuid(preferredId);

  const match = await db.query.users.findFirst({
    where: canLookupById
      ? or(
          eq(users.mobile, normalizedPhone),
          eq(users.username, normalizedPhone),
          eq(users.id, preferredId)
        )
      : or(eq(users.mobile, normalizedPhone), eq(users.username, normalizedPhone)),
    columns: { id: true, username: true },
  });

  if (match?.id) {
    await db
      .update(users)
      .set({
        mobile: normalizedPhone,
        email: input.email ? String(input.email).trim() : undefined,
      })
      .where(eq(users.id, match.id));
    return;
  }

  await db
    .insert(users)
    .values({
      ...(preferredId && isUuid(preferredId) ? { id: preferredId } : {}),
      username: normalizedPhone,
      password: 'otp-auth',
      mobile: normalizedPhone,
      email: input.email ? String(input.email).trim() : null,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: users.username });
}

async function getDbUserByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  return db.query.users.findFirst({
    where: or(eq(users.mobile, normalizedPhone), eq(users.username, normalizedPhone)),
    columns: { id: true },
  });
}

async function hasExistingAccountFootprint(userId: string): Promise<boolean> {
  const [starterRow, listingRow, subscriptionRow] = await Promise.all([
    db
      .select({ id: userStarterCredits.id })
      .from(userStarterCredits)
      .where(eq(userStarterCredits.userId, userId))
      .limit(1),
    db.select({ id: listings.id }).from(listings).where(eq(listings.sellerId, userId)).limit(1),
    db
      .select({ id: userSubscriptions.id })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1),
  ]);

  return starterRow.length > 0 || listingRow.length > 0 || subscriptionRow.length > 0;
}

async function userExistsInDb(userId: string): Promise<boolean> {
  const normalizedId = String(userId || '').trim();
  if (!normalizedId || !isUuid(normalizedId)) return false;
  const row = await db.query.users.findFirst({
    where: eq(users.id, normalizedId),
    columns: { id: true },
  });
  return Boolean(row?.id);
}

function isPlaceholderName(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized || normalized === 'user' || normalized === 'seller' || normalized === 'unknown'
  );
}

async function hydrateAuthUserFromDb(userId: string, seed: AppUser): Promise<AppUser> {
  const normalizedId = String(userId || '').trim();
  if (!normalizedId || !isUuid(normalizedId)) return seed;

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, normalizedId),
    columns: {
      id: true,
      mobile: true,
      username: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      address: true,
      gstin: true,
      isVerified: true,
      createdAt: true,
    },
  });
  if (!dbUser?.id) return seed;

  const dbName = String(dbUser.displayName || '').trim();
  const nextName = dbName && !isPlaceholderName(dbName) ? dbName : seed.name;

  return {
    ...seed,
    id: String(dbUser.id),
    phone: normalizePhone(dbUser.mobile || seed.phone || ''),
    name: nextName || seed.name,
    email: String(dbUser.email || seed.email || '').trim(),
    avatarUrl: String(dbUser.avatarUrl || seed.avatarUrl || '').trim(),
    address: String(dbUser.address || seed.address || '').trim(),
    gstin: String(dbUser.gstin || seed.gstin || '').trim(),
    isVerified: Boolean(dbUser.isVerified || seed.isVerified),
    createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).toISOString() : seed.createdAt,
  };
}

function hasCompletedOnboarding(user: AppUser | undefined): boolean {
  if (!user) return false;
  const name = String(user.name || '').trim();
  const email = String(user.email || '').trim();
  const gender = user.gender;
  const hasValidName = !!name && !/^user$/i.test(name);
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const hasValidGender = gender === 'male' || gender === 'female' || gender === 'other';
  return hasValidName && hasValidEmail && hasValidGender;
}

export function registerAuthRoutes(app: Express) {
  /**
   * POST /api/auth/send-otp
   * Rate limited: 5 attempts per 15 minutes
   */
  app.post('/api/auth/send-otp', authLimiter, async (req: Request, res: Response) => {
    try {
      const body =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const phoneValue =
        typeof body.phone === 'string' || typeof body.phone === 'number' ? String(body.phone) : '';

      if (!phoneValue.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required',
          expiresIn: 0,
        });
      }

      const result = await otpService.sendOTP(phoneValue);
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json({
        success: result.success,
        message: result.message,
        expiresIn: result.expiresIn,
        sentVia: result.sentVia,
      });
    } catch (error) {
      console.error('Error sending OTP:', {
        error: error instanceof Error ? error.message : String(error),
        body: req.body,
        rawBody: (req as any).rawBody,
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP due to a server error',
        expiresIn: 0,
      });
    }
  });

  /**
   * POST /api/auth/verify-otp
   * Rate limited: 5 attempts per 15 minutes
   */
  app.post('/api/auth/verify-otp', authLimiter, async (req: Request, res: Response) => {
    try {
      const body =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const phone =
        typeof body.phone === 'string' || typeof body.phone === 'number' ? String(body.phone) : '';
      const otp =
        typeof body.otp === 'string' || typeof body.otp === 'number' ? String(body.otp) : '';
      const name = typeof body.name === 'string' ? body.name : undefined;
      const email = typeof body.email === 'string' ? body.email : undefined;
      const gender = body.gender;

      if (!phone.trim() || !otp.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Phone and OTP are required',
        });
      }

      const normalizedPhone = normalizePhone(phone);
      const verifyResult = otpService.verifyOTP(normalizedPhone, otp);

      if (!verifyResult.isValid) {
        return res.json({ success: verifyResult.success, message: verifyResult.message });
      }

      const dbUser = await getDbUserByPhone(normalizedPhone);
      const existingUser = getUserByPhone(normalizedPhone);
      let canonicalUserId = dbUser?.id || getStableUserIdFromPhone(normalizedPhone);

      let authUser = upsertUserFromAuth({
        preferredId: canonicalUserId,
        phone: normalizedPhone,
        name:
          typeof name === 'string' && name.trim()
            ? name.trim()
            : String(existingUser?.name || '').trim(),
        email: typeof email === 'string' ? email.trim() : existingUser?.email || '',
        gender: gender === 'male' || gender === 'female' || gender === 'other' ? gender : 'other',
        avatarUrl: existingUser?.avatarUrl || '',
      });
      await upsertAuthUserRecord({
        phone: normalizedPhone,
        email: authUser.email,
        name: authUser.name,
        avatarUrl: authUser.avatarUrl,
        preferredId: canonicalUserId,
      }).catch((error) => console.error('[Auth] Failed to persist new user to DB:', error));
      const resolvedDbUser = await getDbUserByPhone(normalizedPhone);
      if (resolvedDbUser?.id && resolvedDbUser.id !== canonicalUserId) {
        canonicalUserId = resolvedDbUser.id;
        authUser = upsertUserFromAuth({
          preferredId: canonicalUserId,
          phone: normalizedPhone,
          name: authUser.name,
          email: authUser.email,
          gender: authUser.gender,
          avatarUrl: authUser.avatarUrl,
        });
      }
      const user = await hydrateAuthUserFromDb(canonicalUserId, authUser);
      await touchUserActivity({
        userId: canonicalUserId,
        ip: (req.ip || req.socket.remoteAddress || '').replace('::ffff:', ''),
        userAgent: req.get('user-agent') || '',
      }).catch((error) => console.error('[Auth] Failed to update user activity:', error));

      const hasFootprint = await hasExistingAccountFootprint(canonicalUserId);
      const isNewUser = !dbUser?.id && !hasFootprint;
      const requiresProfileCompletion = isNewUser ? !hasCompletedOnboarding(user) : false;

      if (isNewUser) {
        try {
          if (await userExistsInDb(canonicalUserId)) {
            await grantStarterCreditsIfEligible(canonicalUserId, { grantedBy: 'system' });
          } else {
            console.warn('[Auth] Skipping starter credits: user does not exist in DB', {
              userId: canonicalUserId,
            });
          }
        } catch (starterError) {
          console.error('[Auth] Failed to grant starter credits on verify-otp:', starterError);
        }
      }

      res.json({
        success: true,
        user,
        isNewUser,
        requiresProfileCompletion,
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).json({ success: false, message: 'Verification failed' });
    }
  });

  /**
   * POST /api/auth/complete-profile
   * Complete profile details for new users after OTP verification
   */
  app.post('/api/auth/complete-profile', authLimiter, async (req: Request, res: Response) => {
    try {
      const normalizedPhone = normalizePhone(req.body?.phone);
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl.trim() : '';
      const gender = req.body?.gender;

      if (!normalizedPhone || !/^[6-9]\d{9}$/.test(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number' });
      }
      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Valid email is required' });
      }
      if (gender !== 'male' && gender !== 'female' && gender !== 'other') {
        return res.status(400).json({ success: false, message: 'Valid gender is required' });
      }

      const existingUser = getUserByPhone(normalizedPhone);
      const dbUser = await getDbUserByPhone(normalizedPhone);
      const nowIso = new Date().toISOString();
      let canonicalUserId = dbUser?.id || getStableUserIdFromPhone(normalizedPhone);

      let updatedAuthUser = upsertUserFromAuth({
        preferredId: canonicalUserId,
        phone: normalizedPhone,
        name,
        email,
        avatarUrl,
        gender: gender as 'male' | 'female' | 'other',
        createdAt: existingUser?.createdAt || nowIso,
        updatedAt: nowIso,
      });
      await upsertAuthUserRecord({
        phone: normalizedPhone,
        email,
        name,
        avatarUrl,
        preferredId: canonicalUserId,
      }).catch((error) => console.error('[Auth] Failed to persist user profile to DB:', error));
      const resolvedDbUser = await getDbUserByPhone(normalizedPhone);
      if (resolvedDbUser?.id && resolvedDbUser.id !== canonicalUserId) {
        canonicalUserId = resolvedDbUser.id;
        updatedAuthUser = upsertUserFromAuth({
          preferredId: canonicalUserId,
          phone: normalizedPhone,
          name,
          email,
          avatarUrl,
          gender: gender as 'male' | 'female' | 'other',
          createdAt: existingUser?.createdAt || nowIso,
          updatedAt: nowIso,
        });
      }
      const updatedUser = await hydrateAuthUserFromDb(canonicalUserId, updatedAuthUser);
      try {
        if (await userExistsInDb(canonicalUserId)) {
          await grantStarterCreditsIfEligible(canonicalUserId, { grantedBy: 'system' });
        } else {
          console.warn('[Auth] Skipping starter credits: user does not exist in DB', {
            userId: canonicalUserId,
          });
        }
      } catch (starterError) {
        console.error('[Auth] Failed to grant starter credits on complete-profile:', starterError);
      }
      await touchUserActivity({
        userId: canonicalUserId,
        ip: (req.ip || req.socket.remoteAddress || '').replace('::ffff:', ''),
        userAgent: req.get('user-agent') || '',
      }).catch((error) => console.error('[Auth] Failed to update user activity:', error));
      return res.json({ success: true, user: updatedUser, isNewUser: false });
    } catch (error) {
      console.error('Error completing profile:', error);
      res.status(500).json({ success: false, message: 'Failed to complete profile' });
    }
  });

  /**
   * POST /api/validate-listing
   * AI-powered listing content validation
   */
  app.post('/api/validate-listing', async (req: Request, res: Response) => {
    try {
      const { category, title, description, isVideo, videoDuration } = req.body;

      if (!title || !category) {
        return res.status(400).json({ error: 'Title and category are required' });
      }

      try {
        const validation = isVideo
          ? await validateVideoWithPhi2(title, description || '', category, videoDuration)
          : await validateImageWithPhi2(title, description || '', category);

        res.json({ ...validation, detectedItems: (validation as any).detectedItems || [] });
      } catch {
        // Graceful degradation — allow listing to proceed if AI is unavailable
        res.json({
          isValid: true,
          isAppropriate: true,
          matchesCategory: true,
          confidence: 0.5,
          detectedItems: [],
          suggestion: '',
          reason: 'Validation service temporarily unavailable',
        });
      }
    } catch (error) {
      console.error('Error validating listing:', error);
      res.status(500).json({ error: 'Failed to validate listing' });
    }
  });
}
const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
