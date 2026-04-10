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
import { registerAdminListingsRoutes } from '../../features/admin/routes/admin-listings';
import { registerReportsRoutes } from '../../features/admin/routes/reports';
import { registerAdminUsersRoutes } from '../../features/admin/routes/admin-users';
import { registerWorkerRoutes } from '../../features/workers/routes/workers';
import { registerSubscriptionRoutes } from '../../features/subscriptions/routes/subscriptions';
import { registerListingRoutes } from '../../features/listings/routes/listings';
import { registerUserRoutes } from '../../features/users/routes/users';
import { registerInvoiceRoutes } from '../../features/users/routes/invoices';
import { registerMessageRoutes } from '../../features/messages/routes/messages';
import { registerInAppNotificationRoutes } from '../../features/notifications/routes/in-app';

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
  app.use(['/api/admin/reports', '/api/admin/revenue'], adminAuthMiddleware);
  registerAdminSettingsRoutes(app);
  registerReportsRoutes(app);
  registerAdminUsersRoutes(app);
  registerAdminListingsRoutes(app);
  registerCouponRoutes(app);

  // Subscription and listing routes
  registerSubscriptionRoutes(app);
  registerListingRoutes(app);
  registerMessageRoutes(app);
  registerInAppNotificationRoutes(app);
  registerUserRoutes(app);
  registerInvoiceRoutes(app);

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
