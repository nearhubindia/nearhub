import { pgTable, text, varchar, integer, timestamp, boolean, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Listings table - stores all product listings
 */
export const listings = pgTable('listings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sellerId: varchar('seller_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  offerPrice: decimal('offer_price', { precision: 12, scale: 2 }), // Discounted offer price (must be < price)
  condition: text('condition').notNull(), // new, like-new, good, fair
  images: text('images')
    .array()
    .default(sql`'{}'::text[]`), // JSON array of image URLs (max 5)
  videos: text('videos'), // JSON array of video URLs (max 5)
  listingType: text('listing_type').notNull().default('image'), // "image" or "video"
  location: text('location').notNull(),
  isActive: boolean('is_active').default(true),

  // Subscription info
  isPaid: boolean('is_paid').default(false), // true if listing >= 3000 and paid
  durationDays: integer('duration_days'), // 15, 45, 90, 180
  subscriptionId: varchar('subscription_id'), // Reference to subscriptions table
  expiresAt: timestamp('expires_at'), // When listing expires (only for paid listings)
  mediaDeletedAt: timestamp('media_deleted_at'), // When media was deleted due to non-renewal (60 days after expiry)

  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Subscriptions table - tracks paid listing subscriptions
 */
export const subscriptions = pgTable('subscriptions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sellerId: varchar('seller_id').notNull(),
  listingId: varchar('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),

  // Listing type and pricing info
  listingType: text('listing_type').notNull().default('image'), // "image" or "video"
  durationDays: integer('duration_days').notNull(), // 15, 45, 90, 180
  basePrice: decimal('base_price', { precision: 12, scale: 2 }).notNull(), // Product price
  feePerDay: decimal('fee_per_day', { precision: 8, scale: 2 }).notNull(), // ₹99 for images, ₹149 for videos
  totalFee: decimal('total_fee', { precision: 12, scale: 2 }).notNull(), // durationDays * feePerDay

  // Payment status
  paymentStatus: text('payment_status').notNull(), // pending, completed, failed, refunded
  paymentMethod: text('payment_method').default('razorpay'), // razorpay, upi, card
  razorpayOrderId: varchar('razorpay_order_id'), // For Razorpay integration
  razorpayPaymentId: varchar('razorpay_payment_id'), // After payment confirmed

  // Dates
  startDate: timestamp('start_date').notNull(),
  expiresAt: timestamp('expires_at').notNull(), // startDate + durationDays
  autoRenew: boolean('auto_renew').default(false),

  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Transactions table - payment history
 */
export const transactions = pgTable('transactions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  subscriptionId: varchar('subscription_id').references(() => subscriptions.id, {
    onDelete: 'cascade',
  }),
  sellerId: varchar('seller_id').notNull(),

  // Payment details
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text('payment_status').notNull(), // pending, completed, failed, refunded
  paymentId: varchar('payment_id'), // External payment ID (Razorpay)
  orderId: varchar('order_id'), // External order ID (Razorpay)

  // Razorpay webhook data
  razorpayData: text('razorpay_data'), // JSON stringified response
  failureReason: text('failure_reason'),

  // Refund info
  refundId: varchar('refund_id'),
  refundStatus: text('refund_status'), // pending, completed, failed
  refundedAt: timestamp('refunded_at'),

  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  completedAt: timestamp('completed_at'),
});

/**
 * Seller wallets - track seller balance
 */
export const sellerWallets = pgTable('seller_wallets', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sellerId: varchar('seller_id').notNull().unique(),

  // Balance tracking
  totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 }).default('0').notNull(),
  totalFeesPaid: decimal('total_fees_paid', { precision: 12, scale: 2 }).default('0').notNull(),
  netBalance: decimal('net_balance', { precision: 12, scale: 2 }).default('0').notNull(),

  // Stats
  totalListings: integer('total_listings').default(0),
  paidListings: integer('paid_listings').default(0),
  activeListings: integer('active_listings').default(0),

  createdAt: timestamp('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ============= Zod Schemas =============

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

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

// ============= Type Exports =============

export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type SellerWallet = typeof sellerWallets.$inferSelect;
