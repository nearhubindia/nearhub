import type { Express } from 'express';
import {
  adminAuthMiddleware,
  registerAdminAuthRoutes,
  registerAdminBannersRoutes,
  registerAdminContactSubmissionRoutes,
  registerAdminListingsRoutes,
  registerAdminRoutes,
  registerAdminSettingsRoutes,
  registerAdminUserLifecycleRoutes,
  registerAdminUsersRoutes,
  registerErrorLogRoutes,
  registerReportsRoutes,
} from './admin';
import { registerAuthRoutes } from './auth';
import { registerCouponRoutes } from './coupons';
import {
  registerListingRoutes,
  registerDealRoutes,
  registerListingExpirationRoutes,
} from './listings';
import { registerMediaCleanupRoutes, registerCloudflareMediaRoutes } from './media';
import { registerMessageRoutes } from './messages';
import { registerInAppNotificationRoutes } from './notifications';
import { registerDynamicPricingRoutes } from './payments';
import { registerPushNotificationRoutes } from './push';
import { registerGeoSearchRoutes, registerLocationRoutes, registerSearchRoutes } from './search';
import { registerAIRoutes, registerContactRoutes } from './shared';
import { registerSubscriptionPlansRoutes, registerSubscriptionRoutes } from './subscriptions';
import { registerInvoiceRoutes, registerUserRoutes } from './users';
import { registerMobileValuationRoutes } from './valuations';
import { registerWorkerRoutes } from './workers';
import { registerApiDocsRoutes } from '../shared/routes/api-docs';

/**
 * Registers every HTTP route owned by a backend feature.
 *
 * Keeping this list in the feature layer leaves `routes.ts` responsible only
 * for cross-cutting health checks and server construction.
 */
export async function registerFeatureRoutes(app: Express): Promise<void> {
  registerApiDocsRoutes(app);
  registerAuthRoutes(app);
  registerAIRoutes(app);
  registerMobileValuationRoutes(app);
  registerContactRoutes(app);

  registerAdminRoutes(app);
  registerAdminUsersRoutes(app);
  registerAdminListingsRoutes(app);
  registerAdminBannersRoutes(app);
  registerAdminContactSubmissionRoutes(app);
  app.use(['/api/admin/reports', '/api/admin/revenue'], adminAuthMiddleware);
  registerReportsRoutes(app);
  registerAdminUserLifecycleRoutes(app);
  registerErrorLogRoutes(app);
  registerListingRoutes(app);
  registerDealRoutes(app);

  await registerLocationRoutes(app);

  registerAdminAuthRoutes(app);
  registerAdminSettingsRoutes(app);

  registerListingExpirationRoutes(app);
  registerMediaCleanupRoutes(app);
  registerCloudflareMediaRoutes(app);
  registerDynamicPricingRoutes(app);
  registerUserRoutes(app);
  registerGeoSearchRoutes(app);
  registerSearchRoutes(app);

  registerSubscriptionRoutes(app);
  registerSubscriptionPlansRoutes(app);
  registerCouponRoutes(app);
  registerInvoiceRoutes(app);
  registerPushNotificationRoutes(app);
  registerInAppNotificationRoutes(app);
  registerMessageRoutes(app);
  registerWorkerRoutes(app);
}
