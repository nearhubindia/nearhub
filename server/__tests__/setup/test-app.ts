/**
 * Test Application Setup
 * Creates a test Express app with all routes registered
 */

import express, { type Express } from 'express';
import { registerAuthRoutes } from '../../features/auth/routes/auth';
import { registerCouponRoutes } from '../../features/coupons/routes/coupons';
import {
  registerAdminAuthRoutes,
  adminAuthMiddleware,
} from '../../features/admin/routes/admin-auth';
import { registerAdminSettingsRoutes } from '../../features/admin/routes/admin-settings';
import { registerWorkerRoutes } from '../../features/workers/routes/workers';
import { registerSubscriptionRoutes } from '../../features/subscriptions/routes/subscriptions';
import { registerListingRoutes } from '../../features/listings/routes/listings';

/**
 * Create a test application instance
 */
export function createTestApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Test server is running',
      timestamp: new Date().toISOString(),
    });
  });

  // Register routes
  registerAuthRoutes(app);

  // Admin auth + protected settings middleware
  registerAdminAuthRoutes(app);
  app.use('/api/admin/settings', adminAuthMiddleware);
  registerAdminSettingsRoutes(app);
  registerCouponRoutes(app);

  // Subscription and listing routes
  registerSubscriptionRoutes(app);
  registerListingRoutes(app);

  // Worker management routes
  registerWorkerRoutes(app);

  return app;
}

/**
 * Create and cleanup test app
 */
export function setupTestApp(): Express & { cleanup: () => void } {
  const app = createTestApp() as Express & { cleanup: () => void };

  app.cleanup = () => {
    // Cleanup logic if needed
  };

  return app;
}
