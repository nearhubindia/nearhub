import { pgTable, text, varchar, decimal, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Admin Settings Table
 * Stores subscription pricing configuration
 */
export const adminSettings = pgTable('admin_settings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Subscription pricing - IMAGE LISTINGS (base fee per day)
  imageFeePerDay: decimal('image_fee_per_day', { precision: 8, scale: 2 }).notNull().default('99'),

  // IMAGE Dynamic pricing constraints (for AI-based pricing)
  imageMinPricePerDay: decimal('image_min_price_per_day', { precision: 8, scale: 2 })
    .notNull()
    .default('49'), // Min ₹49/day
  imageMaxPricePerDay: decimal('image_max_price_per_day', { precision: 8, scale: 2 })
    .notNull()
    .default('199'), // Max ₹199/day

  // IMAGE Duration options (in days)
  imageDuration15Days: decimal('image_duration_15_days', { precision: 8, scale: 2 })
    .notNull()
    .default('1485'), // 15 * 99
  imageDuration45Days: decimal('image_duration_45_days', { precision: 8, scale: 2 })
    .notNull()
    .default('4455'), // 45 * 99
  imageDuration90Days: decimal('image_duration_90_days', { precision: 8, scale: 2 })
    .notNull()
    .default('8910'), // 90 * 99
  imageDuration180Days: decimal('image_duration_180_days', { precision: 8, scale: 2 })
    .notNull()
    .default('17820'), // 180 * 99

  // Subscription pricing - VIDEO LISTINGS (base fee per day, higher than images)
  videoFeePerDay: decimal('video_fee_per_day', { precision: 8, scale: 2 }).notNull().default('149'), // ₹149/day for videos (50% more than images)

  // VIDEO Dynamic pricing constraints (for AI-based pricing)
  videoMinPricePerDay: decimal('video_min_price_per_day', { precision: 8, scale: 2 })
    .notNull()
    .default('79'), // Min ₹79/day
  videoMaxPricePerDay: decimal('video_max_price_per_day', { precision: 8, scale: 2 })
    .notNull()
    .default('299'), // Max ₹299/day

  // VIDEO Duration options (in days)
  videoDuration15Days: decimal('video_duration_15_days', { precision: 8, scale: 2 })
    .notNull()
    .default('2235'), // 15 * 149
  videoDuration45Days: decimal('video_duration_45_days', { precision: 8, scale: 2 })
    .notNull()
    .default('6705'), // 45 * 149
  videoDuration90Days: decimal('video_duration_90_days', { precision: 8, scale: 2 })
    .notNull()
    .default('13410'), // 90 * 149
  videoDuration180Days: decimal('video_duration_180_days', { precision: 8, scale: 2 })
    .notNull()
    .default('26820'), // 180 * 149

  // Free tier (first N listing days are free)
  freeListingDays: integer('free_listing_days').notNull().default(15), // First 15 days are free

  // Free tier threshold (listings below this price are free)
  freeTierThreshold: decimal('free_tier_threshold', { precision: 10, scale: 2 }).default('3000'),
  discountEnabled: boolean('discount_enabled').default(false),
  discountPercentage: integer('discount_percentage').default(0), // 0-100
  discountMinimumDuration: integer('discount_minimum_duration').default(45), // Apply discount for 45+ days
  discountMaxDiscount: decimal('discount_max_discount', { precision: 8, scale: 2 }).default('0'),

  // Expiration handling
  autoDeactivateOnExpiry: boolean('auto_deactivate_on_expiry').default(true),
  hideFromSearchOnExpiry: boolean('hide_from_search_on_expiry').default(true),
  hideFromShortsOnExpiry: boolean('hide_from_shorts_on_expiry').default(true),

  // Reactivation settings
  allowReactivation: boolean('allow_reactivation').default(true),
  reactivationPricingMultiplier: decimal('reactivation_pricing_multiplier', {
    precision: 4,
    scale: 2,
  }).default('1'), // 1.0 = same price, 1.1 = 10% more

  // Grace period (days before completely removing listing after expiry)
  gracePeriodDays: integer('grace_period_days').default(30),

  // Media deletion settings (delete videos/images after non-renewal)
  mediaDeleteAfterDays: integer('media_delete_after_days').default(60), // Delete media 60 days after expiry
  autoDeleteExpiredMedia: boolean('auto_delete_expired_media').default(true),

  // Dynamic pricing settings
  enableDynamicPricing: boolean('enable_dynamic_pricing').default(false), // Enable AI-based dynamic pricing
  dynamicPricingAlgorithm: varchar('dynamic_pricing_algorithm', { length: 50 }).default(
    'demand_supply'
  ), // Algorithm type

  // Geo-location settings
  geoRadiusKm: integer('geo_radius_km').default(50), // Radius in km for ad search filtering

  // Timestamps
  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * App Screen Banners Table
 * Stores configurable banners shown on app screens
 */
export const appScreenBanners = pgTable('app_screen_banners', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  title: varchar('title', { length: 150 }).notNull(),
  screen: varchar('screen', { length: 50 }).notNull().default('home'),
  imageUrl: text('image_url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),

  createdBy: varchar('created_by'),

  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Contact Form Submissions Table
 * Stores messages submitted from the web contact form.
 */
export const contactSubmissions = pgTable('contact_submissions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }).notNull().default(''),
  subject: varchar('subject', { length: 200 }).notNull(),
  message: text('message').notNull(),
  source: varchar('source', { length: 30 }).notNull().default('web'),
  contacted: boolean('contacted').notNull().default(false),
  adminComments: text('admin_comments'),
  contactedAt: timestamp('contacted_at'),

  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Contact Submission Comments Table
 * Stores multiple admin comments per enquiry.
 */
export const contactSubmissionComments = pgTable('contact_submission_comments', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  submissionId: varchar('submission_id')
    .notNull()
    .references(() => contactSubmissions.id, { onDelete: 'cascade' }),
  comment: text('comment').notNull(),
  createdBy: varchar('created_by'),

  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Subscription Configuration Schema
 */
export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdminSettings = typeof adminSettings.$inferSelect;
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;

/**
 * Pricing configuration that combines admin settings with calculations
 */
export interface PricingConfiguration {
  imagePricing: {
    feePerDay: number;
    durations: {
      15: number;
      45: number;
      90: number;
      180: number;
    };
  };
  videoPricing: {
    feePerDay: number;
    durations: {
      15: number;
      45: number;
      90: number;
      180: number;
    };
  };
  freeTierThreshold: number;
  discount: {
    enabled: boolean;
    percentage: number;
    minDuration: number;
    maxDiscount: number;
  };
  expiration: {
    autoDeactivate: boolean;
    hideFromSearch: boolean;
    hideFromShorts: boolean;
  };
  reactivation: {
    allowed: boolean;
    priceMultiplier: number;
  };
  mediaDeletion: {
    autoDelete: boolean;
    deleteAfterDays: number;
  };
}
/**
 * Coupons Table
 * Stores discount coupons created by admins
 */
export const coupons = pgTable('coupons', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Coupon details
  code: varchar('code', { length: 50 }).notNull().unique(), // e.g., "SAVE30", "WELCOME50"

  // Discount details
  discountPercentage: integer('discount_percentage').notNull(), // 0-100 (100 = free)

  // Plan restrictions (JSON array of tier IDs, or null for all plans)
  applicableTiers: text('applicable_tiers'), // JSON array of subscription_tier IDs, e.g., ["tier_id_1", "tier_id_2"] or null for all

  // Free listings (coupon grants N free listings to a user)
  freeListings: integer('free_listings').default(0).notNull(), // Number of free listings this coupon grants per user
  freeListingDurationDays: integer('free_listing_duration_days').default(30).notNull(), // Duration of each free listing in days

  // Usage limits
  maxUsageCount: integer('max_usage_count').notNull(), // Max number of times this coupon can be redeemed
  usageCount: integer('usage_count').default(0).notNull(), // Current usage count

  // Validity
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at'), // Optional expiry date

  // Creator info
  createdBy: varchar('created_by').notNull(), // Admin ID

  // Timestamps
  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Coupon Usage Tracking
 * Tracks which listings have used which coupons
 */
export const couponUsage = pgTable('coupon_usage', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // References
  couponId: varchar('coupon_id')
    .notNull()
    .references(() => coupons.id, { onDelete: 'cascade' }),
  listingId: varchar('listing_id').notNull(),
  subscriptionId: varchar('subscription_id').notNull(),
  userId: varchar('user_id').notNull(), // Track which user used the coupon

  // Usage info
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).notNull(), // Amount discounted in rupees

  // Timestamps
  usedAt: timestamp('used_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Coupon Schemas (Zod)
 */
export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export const couponCodeValidationSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
});

export const createCouponAdminSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  discountPercentage: z.number().min(0).max(100),
  applicableTiers: z.array(z.string()).optional(), // Array of tier IDs, or omit for all plans
  maxUsageCount: z.number().min(1),
  freeListings: z.number().min(0).default(0), // Number of free listings this coupon grants per user
  freeListingDurationDays: z.number().min(1).default(30), // Duration of each free listing in days
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Tax Invoices Table
 * Stores generated tax invoices for subscriptions
 */
export const invoices = pgTable('invoices', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  invoiceNumber: varchar('invoice_number').notNull().unique(),

  // Customer Info
  customerId: varchar('customer_id').notNull(),
  customerName: varchar('customer_name').notNull(),
  customerEmail: varchar('customer_email').notNull(),
  customerPhone: varchar('customer_phone').notNull(),
  customerAddress: text('customer_address'),
  customerCity: varchar('customer_city'),
  customerState: varchar('customer_state'),
  customerPincode: varchar('customer_pincode'),
  customerGST: varchar('customer_gst'),

  // Order/Payment Info
  subscriptionId: varchar('subscription_id'),
  orderId: varchar('order_id'),
  paymentId: varchar('payment_id'),
  paymentMethod: varchar('payment_method'),

  // Financial Info
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  sgst: decimal('sgst', { precision: 10, scale: 2 }).notNull().default('0'),
  cgst: decimal('cgst', { precision: 10, scale: 2 }).notNull().default('0'),
  igst: decimal('igst', { precision: 10, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),

  // Invoice Details (stored as JSON)
  items: text('items').notNull(), // JSON array
  invoiceData: text('invoice_data').notNull(), // Full invoice JSON

  // Status
  status: varchar('status').notNull().default('issued'), // issued, paid, cancelled
  invoiceUrl: varchar('invoice_url'),
  pdfUrl: varchar('pdf_url'),

  // Dates
  invoiceDate: timestamp('invoice_date').notNull().defaultNow(),
  dueDate: timestamp('due_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Subscription Tiers Table
 * Admin-configured subscription tiers for image/video listings
 */
export const subscriptionTiers = pgTable('subscription_tiers', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Tier info
  name: varchar('name', { length: 100 }).notNull(), // "Basic", "Standard", "Premium"
  type: varchar('type', { length: 20 }).notNull(), // "bundle" | "boost"
  description: text('description'),

  // Pricing (monthly and annual)
  monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).notNull(), // e.g., 2.99, 9.99, 24.99
  annualPrice: decimal('annual_price', { precision: 10, scale: 2 }).notNull(), // e.g., 29.99, 99.99, 249.99
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  offerPrice: decimal('offer_price', { precision: 10, scale: 2 }),
  durationDays: integer('duration_days').notNull(), // 15, 30, 90, 180

  // Features (JSON array for flexibility)
  features: text('features').notNull(), // JSON array of feature strings

  // Limits
  maxListings: integer('max_listings').notNull(), // -1 for unlimited
  featuredListingsPerMonth: integer('featured_listings_per_month').notNull(), // Number of featured listings allowed per month
  boostCredits: integer('boost_credits').notNull().default(0), // Total boost credits granted by this tier purchase

  // Display
  highlight: boolean('highlight').default(false), // "Most popular" badge

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Timestamps
  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * User Subscriptions Table
 * Tracks active subscriptions per user
 * Users can have multiple active subscriptions (e.g., multiple Basic 30-Day)
 */
export const userSubscriptions = pgTable('user_subscriptions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // References
  userId: varchar('user_id').notNull(), // Multiple subscriptions allowed per user
  subscriptionTierId: varchar('subscription_tier_id')
    .notNull()
    .references(() => subscriptionTiers.id),

  // Payment tracking
  paymentId: varchar('payment_id'),
  orderId: varchar('order_id'),
  invoiceId: varchar('invoice_id').references(() => invoices.id),

  // Coupon applied (optional promo code)
  couponId: varchar('coupon_id').references(() => coupons.id),

  // Validity
  expiresAt: timestamp('expires_at').notNull(),
  autoRenew: boolean('auto_renew').default(false).notNull(),

  // Status
  status: varchar('status', { length: 20 }).notNull().default('active'), // "active" | "expired" | "cancelled"
  boostsRemaining: integer('boosts_remaining').notNull().default(0), // Remaining boost credits for this subscription purchase

  // Timestamps
  subscribedAt: timestamp('subscribed_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Listings Table
 * Replaces in-memory storage with database persistence
 */
export const listings = pgTable('listings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Seller info
  sellerId: varchar('seller_id').notNull(),

  // Listing details
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(),
  listingType: varchar('listing_type', { length: 20 }).default('mixed'), // "image" | "video" | "mixed" - for categorization, not pricing

  // Pricing
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  offerPrice: decimal('offer_price', { precision: 10, scale: 2 }),
  priceUnit: varchar('price_unit', { length: 50 }),
  contactPhone: varchar('contact_phone', { length: 20 }),

  // Condition & location
  condition: varchar('condition', { length: 50 }).notNull(),
  location: varchar('location', { length: 200 }).notNull(),
  pincode: varchar('pincode', { length: 10 }),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),

  // Media (unified: up to 5 images + up to 2 videos per listing)
  images: text('images'), // JSON array of image URLs (up to 5 images)
  videos: text('videos'), // JSON array of video URLs (up to 2 videos)

  // Subscription & promotion
  subscriptionTierId: varchar('subscription_tier_id').references(() => subscriptionTiers.id),
  userSubscriptionId: varchar('user_subscription_id').references(() => userSubscriptions.id), // Specific subscription instance used
  couponId: varchar('coupon_id').references(() => coupons.id),

  // Status & expiration
  status: varchar('status', { length: 20 }).notNull().default('active'), // "active" | "sold" | "pending" | "expired"
  isActive: boolean('is_active').notNull().default(true),
  isPaid: boolean('is_paid').notNull().default(false),

  // Featured listing (requires subscription tier)
  featured: boolean('featured').notNull().default(false),
  sponsored: boolean('sponsored').notNull().default(false),
  boostedUntil: timestamp('boosted_until'),
  boostCount: integer('boost_count').notNull().default(0),

  durationDays: integer('duration_days'),
  expiresAt: timestamp('expires_at'),

  // Analytics
  viewCount: integer('view_count').notNull().default(0),

  // Timestamps
  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Location Index Table
 * Scrubbed pincode/city/state records derived from GeoJSON for fast lookups.
 */
export const locationIndex = pgTable('location_index', {
  pincode: varchar('pincode', { length: 6 }).primaryKey(),
  locationName: varchar('location_name', { length: 180 }).notNull(),
  city: varchar('city', { length: 120 }).notNull(),
  state: varchar('state', { length: 120 }).notNull(),
  district: varchar('district', { length: 120 }).notNull().default(''),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  region: varchar('region', { length: 120 }).notNull().default(''),
  searchText: text('search_text').notNull(),
  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Zod Schemas for Subscription Management
 */
export const insertSubscriptionTierSchema = createInsertSchema(subscriptionTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  subscribedAt: true,
  updatedAt: true,
});

export const insertListingSchema = createInsertSchema(listings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Accept both string (JSON) and array formats for images/videos
    images: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .nullable(),
    videos: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .nullable(),
  });

/**
 * Type Exports
 */
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type InsertSubscriptionTier = z.infer<typeof insertSubscriptionTierSchema>;

/**
 * Listing Views Table
 * Tracks individual views with IP-based deduplication
 */
export const listingViews = pgTable('listing_views', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  listingId: varchar('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),

  // Viewer info (nullable for anonymous views)
  viewerId: varchar('viewer_id'),
  ipAddress: varchar('ip_address', { length: 45 }), // IPv6 support
  userAgent: text('user_agent'),

  // Timestamps
  viewedAt: timestamp('viewed_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const insertListingViewSchema = createInsertSchema(listingViews).omit({
  id: true,
  viewedAt: true,
});

export type ListingView = typeof listingViews.$inferSelect;
export type InsertListingView = z.infer<typeof insertListingViewSchema>;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;

export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type LocationIndex = typeof locationIndex.$inferSelect;
export type InsertLocationIndex = typeof locationIndex.$inferInsert;

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type CreateCouponAdmin = z.infer<typeof createCouponAdminSchema>;

export type CouponUsage = typeof couponUsage.$inferSelect;
export type InsertCouponUsage = typeof couponUsage.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * Push Tokens Table
 * Stores push notification tokens for users
 */
export const pushTokens = pgTable('push_tokens', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // User reference
  userId: varchar('user_id').notNull(),

  // Token details
  token: text('token').notNull().unique(), // Expo push token
  platform: varchar('platform', { length: 20 }).notNull(), // 'ios' | 'android' | 'web'
  deviceId: varchar('device_id', { length: 255 }), // Optional device identifier

  // User role
  userType: varchar('user_type', { length: 20 }).notNull().default('buyer'), // 'buyer' | 'seller' | 'both'

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Timestamps
  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  lastUsedAt: timestamp('last_used_at'),
});

/**
 * Notification Logs Table
 * Tracks sent push notifications
 */
export const notificationLogs = pgTable('notification_logs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Target info
  userId: varchar('user_id'),
  userType: varchar('user_type', { length: 20 }), // 'buyer' | 'seller' | 'all'

  // Message details
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: text('data'), // JSON payload

  // Notification type
  notificationType: varchar('notification_type', { length: 50 }).notNull(), // 'new_listing' | 'price_drop' | 'message' | 'admin_broadcast'

  // Delivery status
  status: varchar('status', { length: 20 }).notNull().default('sent'), // 'sent' | 'delivered' | 'failed'
  sentCount: integer('sent_count').notNull().default(0),
  errorMessage: text('error_message'),

  // Admin info (if sent by admin)
  sentBy: varchar('sent_by'), // Admin user ID

  // Timestamps
  sentAt: timestamp('sent_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Push Token Schemas
 */
export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({
  id: true,
  sentAt: true,
});

/**
 * Type Exports for Push Notifications
 */
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;

export type AppScreenBanner = typeof appScreenBanners.$inferSelect;
export type InsertAppScreenBanner = typeof appScreenBanners.$inferInsert;
/**
 * In-App Notifications Table
 * Persistent notification feed visible in the app
 */
export const inAppNotifications = pgTable('in_app_notifications', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Target user (null = all users)
  userId: varchar('user_id'),
  userType: varchar('user_type', { length: 20 }), // 'buyer' | 'seller' | 'all'

  // Notification content
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('info'), // 'info' | 'success' | 'warning' | 'error'

  // Action/link (optional)
  actionLabel: varchar('action_label', { length: 50 }),
  actionUrl: varchar('action_url', { length: 255 }), // Deep link or route

  // Metadata
  category: varchar('category', { length: 50 }), // 'listing' | 'payment' | 'account' | 'system'
  referenceId: varchar('reference_id'), // ID of related listing/payment/etc

  // Status
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),

  // Analytics
  priority: varchar('priority', { length: 20 }).default('normal'), // 'urgent' | 'high' | 'normal' | 'low'
  expiresAt: timestamp('expires_at'), // Auto-delete after this date

  // Admin info
  createdBy: varchar('created_by'), // Admin user ID

  // Timestamps
  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * In-App Notification Schema
 */
export const insertInAppNotificationSchema = createInsertSchema(inAppNotifications).omit({
  id: true,
  createdAt: true,
});

/**
 * Type Exports for In-App Notifications
 */
export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type InsertInAppNotification = z.infer<typeof insertInAppNotificationSchema>;
