# RDBMS Reference

## Overview
- Engine: PostgreSQL
- ORM/Migrations: Drizzle ORM + drizzle-kit
- Baseline migration strategy: single squashed baseline + forward migrations
- Current baseline migration: `server/migrations/0000_lucky_sentry.sql`
- Detailed schema dictionary: `docs/SCHEMA_REFERENCE_GUIDE.md`

## Canonical Schema Sources
Use these files as source-of-truth for table shapes:
- `server/features/admin/models/admin-settings.ts`
- `server/features/users/models/users.ts`

Drizzle config:
- `server/drizzle.config.js`
- `server/drizzle.config.ts`

## Migration Workflow (Standard)
Run from `server/`:

```bash
npm run db:status      # drizzle schema/migration consistency check
npm run db:create      # generate migration SQL from schema changes
npm run db:migrate     # apply pending migrations
npm run db:refresh     # local reset + migrate + seed (destructive)
```

Notes:
- `db:refresh` is destructive and should be used only for local/dev reset.
- Production should use `db:migrate` only.

## Core Tables

### Identity and Lifecycle
- `users`
  - Primary user records.
  - Canonical identity policy: mobile-based usage.
- `user_activity`
  - Last-seen activity tracking for lifecycle governance.
- `user_deletion_reviews`
  - Admin review queue for inactive user deletion decisions.
- `user_starter_credits`
  - Per-user starter listing/boost credits.

### Listings and Discovery
- `listings`
  - Main listing entity (seller, pricing, media, location, status, boosts).
- `listing_views`
  - Detailed listing view telemetry.
- `location_index`
  - Normalized pincode/city/state index for search lookups.

### Subscription and Billing
- `subscription_tiers`
  - Plan definitions.
- `user_subscriptions`
  - Subscription purchases/entitlements.
- `invoices`
  - Invoice and payment record snapshots.

### Promotions and Offers
- `coupons`
  - Coupon definitions and eligibility restrictions.
- `coupon_usage`
  - Coupon redemption audit rows.

### Messaging and Notifications
- `chat_conversations`
  - Buyer-seller conversation per listing.
- `chat_messages`
  - Message rows within conversation.
- `push_tokens`
  - Device token registry.
- `notification_logs`
  - Push delivery logs.
- `in_app_notifications`
  - In-app notification feed.

### Admin and CMS
- `admin_settings`
  - Runtime platform settings (pricing, lifecycle, behavior flags).
- `app_screen_banners`
  - Configurable banner assets.
- `contact_submissions`
  - Contact form submissions.
- `contact_submission_comments`
  - Admin comments on submissions.

## Key Relationships
- `chat_conversations.listing_id -> listings.id`
- `chat_messages.conversation_id -> chat_conversations.id`
- `listing_views.listing_id -> listings.id`
- `listings.subscription_tier_id -> subscription_tiers.id`
- `listings.user_subscription_id -> user_subscriptions.id`
- `listings.coupon_id -> coupons.id`
- `user_subscriptions.subscription_tier_id -> subscription_tiers.id`
- `user_subscriptions.invoice_id -> invoices.id`
- `user_subscriptions.coupon_id -> coupons.id`
- `invoices.customer_id -> users.id`
- `coupon_usage.coupon_id -> coupons.id`
- `contact_submission_comments.submission_id -> contact_submissions.id`

## Integrity and Indexing Highlights
- Mobile integrity for users:
  - `users_mobile_format_chk`
  - `idx_users_mobile_unique_nonempty`
- Conversation uniqueness:
  - `uq_chat_conversation` on (`listing_id`, `buyer_id`, `seller_id`)
- Listing hot-path indexes:
  - active/category/date composite indexes
  - seller/date indexes
  - active expiry indexes
- Lifecycle/admin indexes:
  - user activity last seen
  - deletion review status

## Operational Runbook

### Local reset and reseed
```bash
cd server
npm run db:refresh
```

### Production migration
```bash
cd server
npm run db:migrate
```

### After deploy checks
- API health endpoint returns 200.
- PM2 process is online.
- `drizzle.__drizzle_migrations` contains latest migration hash.
- If retention is enabled: worker `data-retention-cleanup` appears in `/api/workers/status`.

## Maintenance Rules
- Do not create ad-hoc SQL migration runners for normal schema work.
- Keep migration generation via `drizzle-kit generate` only.
- Prefer additive, forward-only migrations after the squashed baseline.
- Keep one canonical definition per table in schema source files.
- Canonical actor references are now enforced through `users.id` with FK-backed integrity.
