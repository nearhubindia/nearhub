import type { Express } from 'express';
import { createServer, type Server } from 'node:http';
// Location routes from search feature
import { registerLocationRoutes } from './features/search/services/location';
// Admin feature routes
import { registerAdminAuthRoutes, adminAuthMiddleware } from './features/admin/routes/admin-auth';
import { registerAdminSettingsRoutes } from './features/admin/routes/admin-settings';
import { registerAdminRoutes } from './features/admin/routes/admin';
import { registerAdminUsersRoutes } from './features/admin/routes/admin-users';
import { registerAdminListingsRoutes } from './features/admin/routes/admin-listings';
import { registerAdminBannersRoutes } from './features/admin/routes/admin-banners';
import { registerAdminContactSubmissionRoutes } from './features/admin/routes/admin-contact-submissions';
import { registerReportsRoutes } from './features/admin/routes/reports';
// Auth feature routes
import { registerAuthRoutes } from './features/auth/routes/auth';
// AI feature routes (shared)
import { registerAIRoutes } from './features/shared/routes/ai';
import { registerContactRoutes } from './features/shared/routes/contact';
// Listings feature routes
import { registerListingRoutes } from './features/listings/routes/listings';
import { registerListingExpirationRoutes } from './features/listings/routes/listing-expiration';
// Media feature routes
import { registerMediaCleanupRoutes } from './features/media/routes/media-cleanup';
import { registerCloudflareMediaRoutes } from './features/media/routes/cloudflare-media';
import { registerVideoUploadRoutes } from './features/media/routes/video-upload';
// Payments feature routes
import { registerDynamicPricingRoutes } from './features/payments/routes/dynamic-pricing';
// Search feature routes
import { registerGeoSearchRoutes } from './features/search/routes/geo-search';
import { registerSearchRoutes } from './features/search/routes/search';
// Subscriptions feature routes
import { registerSubscriptionRoutes } from './features/subscriptions/routes/subscriptions';
import { registerSubscriptionPlansRoutes } from './features/subscriptions/routes/subscription-admin';
// Coupons feature routes
import { registerCouponRoutes } from './features/coupons/routes/coupons';
// Invoices feature routes (in users)
import { registerInvoiceRoutes } from './features/users/routes/invoices';
// Users feature routes
import { registerUserRoutes } from './features/users/routes/users';
// Push notifications feature routes
import { registerPushNotificationRoutes } from './features/push/routes/push';
// In-app notifications feature routes
import { registerInAppNotificationRoutes } from './features/notifications/routes/in-app';
// Worker management routes
import { registerWorkerRoutes } from './features/workers/routes/workers';
import { registerApiDocsRoutes } from './shared/routes/api-docs';

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      origin: req.header('origin') || '(no origin header)',
    });
  });

  // Domain route modules
  registerApiDocsRoutes(app);
  registerAuthRoutes(app);
  registerAIRoutes(app);
  registerContactRoutes(app);
  registerAdminRoutes(app);
  registerAdminUsersRoutes(app);
  registerAdminListingsRoutes(app);
  registerAdminBannersRoutes(app);
  registerAdminContactSubmissionRoutes(app);
  registerReportsRoutes(app);
  registerListingRoutes(app);

  // Location
  await registerLocationRoutes(app);

  // Admin auth + protected settings middleware (only for POST/update)
  registerAdminAuthRoutes(app);
  // Allow public READ of settings, but protect UPDATE endpoints with auth
  registerAdminSettingsRoutes(app); // Registers GET (public) and POST (will add auth check inside)

  // Feature-domain routes
  registerListingExpirationRoutes(app);
  registerVideoUploadRoutes(app);
  registerMediaCleanupRoutes(app);
  registerCloudflareMediaRoutes(app);
  registerDynamicPricingRoutes(app);
  registerUserRoutes(app);
  registerGeoSearchRoutes(app);
  registerSearchRoutes(app);

  // Subscription & payment
  registerSubscriptionRoutes(app);
  registerSubscriptionPlansRoutes(app);
  registerCouponRoutes(app);
  registerInvoiceRoutes(app);

  // Push notifications
  registerPushNotificationRoutes(app);

  // In-app notifications
  registerInAppNotificationRoutes(app);

  // Background workers
  registerWorkerRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
