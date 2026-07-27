import type { Express, Request, Response } from 'express';
import { aiLimiter } from '../../../lib/rate-limiter';
import { getRequestUserId } from '../../../lib/request-user';
import { createMobileValuation, mobileValuationInputSchema } from '../services/mobile-valuation';

export function registerMobileValuationRoutes(app: Express) {
  app.post('/api/valuations/mobile', aiLimiter, async (req: Request, res: Response) => {
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const parsed = mobileValuationInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid valuation input', details: parsed.error.flatten() });
    try {
      const report = await createMobileValuation(parsed.data, userId);
      return res.status(201).json({ success: true, report });
    } catch (error) {
      console.error('[MobileValuation] Failed to create report:', error);
      return res.status(500).json({ success: false, error: 'Unable to create valuation report' });
    }
  });
}
