import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { otpService } from '../../../shared/utils/otp';
import { validateImageWithPhi2, validateVideoWithPhi2 } from '../../../shared/ai/ai';
import { authLimiter } from '../../../lib/rate-limiter';
import { grantStarterCreditsIfEligible } from '../../subscriptions/services/starter-credits';
import { db } from '../../../data/db';
import { listings, userStarterCredits, userSubscriptions } from '../../admin/models/admin-settings';
import {
  getStableUserIdFromPhone,
  getUserByPhone,
  normalizePhone,
  upsertUserFromAuth,
} from '../../users/services/user-profiles';
import { touchUserActivity } from '../../users/services/user-lifecycle';

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

export function registerAuthRoutes(app: Express) {
  /**
   * POST /api/auth/send-otp
   * Rate limited: 5 attempts per 15 minutes
   */
  app.post('/api/auth/send-otp', authLimiter, async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      const result = await otpService.sendOTP(phone);
      res.json({
        success: result.success,
        message: result.message,
        expiresIn: result.expiresIn,
        sentVia: result.sentVia,
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  });

  /**
   * POST /api/auth/verify-otp
   * Rate limited: 5 attempts per 15 minutes
   */
  app.post('/api/auth/verify-otp', authLimiter, async (req: Request, res: Response) => {
    try {
      const { phone, otp, name, email, gender } = req.body;
      const normalizedPhone = normalizePhone(phone);
      const userId = getStableUserIdFromPhone(normalizedPhone);
      const verifyResult = otpService.verifyOTP(normalizedPhone, otp);

      if (!verifyResult.isValid) {
        return res.json({ success: verifyResult.success, message: verifyResult.message });
      }

      const existingUser = getUserByPhone(normalizedPhone);
      if (existingUser) {
        await touchUserActivity({
          userId: existingUser.id,
          ip: (req.ip || req.socket.remoteAddress || '').replace('::ffff:', ''),
          userAgent: req.get('user-agent') || '',
        }).catch((error) => console.error('[Auth] Failed to update user activity:', error));
        return res.json({ success: true, user: existingUser, isNewUser: false });
      }

      const hasFootprint = await hasExistingAccountFootprint(userId);
      if (hasFootprint) {
        const user = upsertUserFromAuth({
          phone: normalizedPhone,
          name: typeof name === 'string' ? name.trim() : '',
          email: typeof email === 'string' ? email.trim() : '',
          gender: gender === 'male' || gender === 'female' || gender === 'other' ? gender : 'other',
        });
        await touchUserActivity({
          userId: user.id,
          ip: (req.ip || req.socket.remoteAddress || '').replace('::ffff:', ''),
          userAgent: req.get('user-agent') || '',
        }).catch((error) => console.error('[Auth] Failed to update user activity:', error));
        return res.json({ success: true, user, isNewUser: false });
      }

      const user = upsertUserFromAuth({
        phone: normalizedPhone,
        name: typeof name === 'string' ? name.trim() : '',
        email: typeof email === 'string' ? email.trim() : '',
        gender: gender === 'male' || gender === 'female' || gender === 'other' ? gender : 'other',
      });
      try {
        await grantStarterCreditsIfEligible(user.id, { grantedBy: 'system' });
      } catch (starterError) {
        console.error('[Auth] Failed to grant starter credits on verify-otp:', starterError);
      }
      await touchUserActivity({
        userId: user.id,
        ip: (req.ip || req.socket.remoteAddress || '').replace('::ffff:', ''),
        userAgent: req.get('user-agent') || '',
      }).catch((error) => console.error('[Auth] Failed to update user activity:', error));

      res.json({ success: true, user, isNewUser: true });
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
      const nowIso = new Date().toISOString();

      const updatedUser = upsertUserFromAuth({
        phone: normalizedPhone,
        name,
        email,
        gender: gender as 'male' | 'female' | 'other',
        createdAt: existingUser?.createdAt || nowIso,
        updatedAt: nowIso,
      });
      try {
        await grantStarterCreditsIfEligible(updatedUser.id, { grantedBy: 'system' });
      } catch (starterError) {
        console.error('[Auth] Failed to grant starter credits on complete-profile:', starterError);
      }
      await touchUserActivity({
        userId: updatedUser.id,
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
