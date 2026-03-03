/**
 * Worker Management Routes
 * Admin API for managing background workers and monitoring system health
 */

import type { Express, Request, Response } from 'express';
import { taskScheduler } from '../../../lib/task-scheduler';
import { checkAndExpireSubscriptions, getSubscriptionExpirationStats } from '../../subscriptions/workers/subscription-expiration';
import { checkAndDeactivateListings, getListingExpirationStats } from '../../listings/workers/listing-expiration';

export function registerWorkerRoutes(app: Express): void {
  /**
   * GET /api/workers/status
   * Get status of all background workers
   */
  app.get('/api/workers/status', async (req: Request, res: Response) => {
    try {
      const tasks = taskScheduler.getStatus() as Array<{
        name: string;
        enabled: boolean;
        running: boolean;
        lastRun: string | null;
        nextRun: string | null;
        errorCount: number;
      }>;

      return res.json({
        success: true,
        workers: tasks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Workers] Error getting status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get worker status',
      });
    }
  });

  /**
   * POST /api/workers/subscriptions/expire
   * Manually trigger subscription expiration check
   */
  app.post('/api/workers/subscriptions/expire', async (req: Request, res: Response) => {
    try {
      console.log('[Workers] Manual trigger: subscription expiration');
      const result = await checkAndExpireSubscriptions();

      return res.json({
        success: true,
        result,
        message: `Expired ${result.expiredCount} subscriptions`,
      });
    } catch (error) {
      console.error('[Workers] Error expiring subscriptions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to expire subscriptions',
      });
    }
  });

  /**
   * POST /api/workers/listings/deactivate
   * Manually trigger listing deactivation check
   */
  app.post('/api/workers/listings/deactivate', async (req: Request, res: Response) => {
    try {
      console.log('[Workers] Manual trigger: listing deactivation');
      const result = await checkAndDeactivateListings();

      return res.json({
        success: true,
        result,
        message: `Deactivated ${result.deactivatedCount} listings`,
      });
    } catch (error) {
      console.error('[Workers] Error deactivating listings:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to deactivate listings',
      });
    }
  });

  /**
   * GET /api/workers/subscriptions/stats
   * Get subscription expiration statistics
   */
  app.get('/api/workers/subscriptions/stats', async (req: Request, res: Response) => {
    try {
      const stats = await getSubscriptionExpirationStats();

      return res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[Workers] Error getting subscription stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get subscription stats',
      });
    }
  });

  /**
   * GET /api/workers/listings/stats
   * Get listing expiration statistics
   */
  app.get('/api/workers/listings/stats', async (req: Request, res: Response) => {
    try {
      const stats = await getListingExpirationStats();

      return res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[Workers] Error getting listing stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get listing stats',
      });
    }
  });

  /**
   * POST /api/workers/:name/enable
   * Enable a specific worker
   */
  app.post('/api/workers/:name/enable', (req: Request, res: Response) => {
    try {
      const name = typeof req.params.name === 'string' ? req.params.name : req.params.name[0];
      taskScheduler.enable(name);

      return res.json({
        success: true,
        message: `Worker "${name}" enabled`,
      });
    } catch (error) {
      console.error('[Workers] Error enabling worker:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable worker',
      });
    }
  });

  /**
   * POST /api/workers/:name/disable
   * Disable a specific worker
   */
  app.post('/api/workers/:name/disable', (req: Request, res: Response) => {
    try {
      const name = typeof req.params.name === 'string' ? req.params.name : req.params.name[0];
      taskScheduler.disable(name);

      return res.json({
        success: true,
        message: `Worker "${name}" disabled`,
      });
    } catch (error) {
      console.error('[Workers] Error disabling worker:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable worker',
      });
    }
  });

  /**
   * POST /api/workers/:name/run
   * Manually run a specific worker
   */
  app.post('/api/workers/:name/run', async (req: Request, res: Response) => {
    try {
      const name = typeof req.params.name === 'string' ? req.params.name : req.params.name[0];
      await taskScheduler.runNow(name);

      return res.json({
        success: true,
        message: `Worker "${name}" executed`,
      });
    } catch (error) {
      console.error('[Workers] Error running worker:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run worker',
      });
    }
  });
}
