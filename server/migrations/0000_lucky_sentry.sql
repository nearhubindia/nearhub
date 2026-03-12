CREATE TABLE "admin_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_fee_per_day" numeric(8, 2) DEFAULT '99' NOT NULL,
	"image_min_price_per_day" numeric(8, 2) DEFAULT '49' NOT NULL,
	"image_max_price_per_day" numeric(8, 2) DEFAULT '199' NOT NULL,
	"image_duration_15_days" numeric(8, 2) DEFAULT '1485' NOT NULL,
	"image_duration_45_days" numeric(8, 2) DEFAULT '4455' NOT NULL,
	"image_duration_90_days" numeric(8, 2) DEFAULT '8910' NOT NULL,
	"image_duration_180_days" numeric(8, 2) DEFAULT '17820' NOT NULL,
	"video_fee_per_day" numeric(8, 2) DEFAULT '149' NOT NULL,
	"video_min_price_per_day" numeric(8, 2) DEFAULT '79' NOT NULL,
	"video_max_price_per_day" numeric(8, 2) DEFAULT '299' NOT NULL,
	"video_duration_15_days" numeric(8, 2) DEFAULT '2235' NOT NULL,
	"video_duration_45_days" numeric(8, 2) DEFAULT '6705' NOT NULL,
	"video_duration_90_days" numeric(8, 2) DEFAULT '13410' NOT NULL,
	"video_duration_180_days" numeric(8, 2) DEFAULT '26820' NOT NULL,
	"free_listing_days" integer DEFAULT 15 NOT NULL,
	"starter_credits_enabled" boolean DEFAULT true NOT NULL,
	"starter_listings_count" integer DEFAULT 2 NOT NULL,
	"starter_boosts_count" integer DEFAULT 2 NOT NULL,
	"free_tier_threshold" numeric(10, 2) DEFAULT '3000',
	"discount_enabled" boolean DEFAULT false,
	"discount_percentage" integer DEFAULT 0,
	"discount_minimum_duration" integer DEFAULT 45,
	"discount_max_discount" numeric(8, 2) DEFAULT '0',
	"auto_deactivate_on_expiry" boolean DEFAULT true,
	"hide_from_search_on_expiry" boolean DEFAULT true,
	"hide_from_shorts_on_expiry" boolean DEFAULT true,
	"allow_reactivation" boolean DEFAULT true,
	"reactivation_pricing_multiplier" numeric(4, 2) DEFAULT '1',
	"grace_period_days" integer DEFAULT 30,
	"media_delete_after_days" integer DEFAULT 60,
	"auto_delete_expired_media" boolean DEFAULT true,
	"enable_dynamic_pricing" boolean DEFAULT false,
	"dynamic_pricing_algorithm" varchar(50) DEFAULT 'demand_supply',
	"geo_radius_km" integer DEFAULT 50,
	"inactive_user_review_days" integer DEFAULT 90 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_screen_banners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(150) NOT NULL,
	"screen" varchar(50) DEFAULT 'home' NOT NULL,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"buyer_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"last_message" text,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_submission_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(30) DEFAULT '' NOT NULL,
	"subject" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"source" varchar(30) DEFAULT 'web' NOT NULL,
	"contacted" boolean DEFAULT false NOT NULL,
	"admin_comments" text,
	"contacted_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" varchar NOT NULL,
	"listing_id" varchar NOT NULL,
	"subscription_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"used_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_percentage" integer NOT NULL,
	"applicable_tiers" text,
	"free_listings" integer DEFAULT 0 NOT NULL,
	"free_listing_duration_days" integer DEFAULT 30 NOT NULL,
	"max_usage_count" integer NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "in_app_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"user_type" varchar(20),
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" varchar(20) DEFAULT 'info' NOT NULL,
	"action_label" varchar(50),
	"action_url" varchar(255),
	"category" varchar(50),
	"reference_id" varchar,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"priority" varchar(20) DEFAULT 'normal',
	"expires_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"customer_name" varchar NOT NULL,
	"customer_email" varchar NOT NULL,
	"customer_phone" varchar NOT NULL,
	"customer_address" text,
	"customer_city" varchar,
	"customer_state" varchar,
	"customer_pincode" varchar,
	"customer_gst" varchar,
	"subscription_id" varchar,
	"order_id" varchar,
	"payment_id" varchar,
	"payment_method" varchar,
	"subtotal" numeric(10, 2) NOT NULL,
	"sgst" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cgst" numeric(10, 2) DEFAULT '0' NOT NULL,
	"igst" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"items" text NOT NULL,
	"invoice_data" text NOT NULL,
	"status" varchar DEFAULT 'issued' NOT NULL,
	"invoice_url" varchar,
	"pdf_url" varchar,
	"invoice_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "listing_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"viewer_id" varchar,
	"ip_address" varchar(45),
	"user_agent" text,
	"viewed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"listing_type" varchar(20) DEFAULT 'mixed',
	"price" numeric(10, 2) NOT NULL,
	"offer_price" numeric(10, 2),
	"price_unit" varchar(50),
	"contact_phone" varchar(20),
	"condition" varchar(50) NOT NULL,
	"location" varchar(200) NOT NULL,
	"pincode" varchar(10),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"images" text,
	"videos" text,
	"subscription_tier_id" varchar,
	"user_subscription_id" varchar,
	"coupon_id" varchar,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sponsored" boolean DEFAULT false NOT NULL,
	"boosted_until" timestamp,
	"boost_count" integer DEFAULT 0 NOT NULL,
	"duration_days" integer,
	"expires_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_index" (
	"pincode" varchar(6) PRIMARY KEY NOT NULL,
	"location_name" varchar(180) NOT NULL,
	"city" varchar(120) NOT NULL,
	"state" varchar(120) NOT NULL,
	"district" varchar(120) DEFAULT '' NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"region" varchar(120) DEFAULT '' NOT NULL,
	"search_text" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"user_type" varchar(20),
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" text,
	"notification_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"sent_by" varchar,
	"sent_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(20) NOT NULL,
	"device_id" varchar(255),
	"user_type" varchar(20) DEFAULT 'buyer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"description" text,
	"monthly_price" numeric(10, 2) NOT NULL,
	"annual_price" numeric(10, 2) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"offer_price" numeric(10, 2),
	"duration_days" integer NOT NULL,
	"features" text NOT NULL,
	"max_listings" integer NOT NULL,
	"featured_listings_per_month" integer NOT NULL,
	"boost_credits" integer DEFAULT 0 NOT NULL,
	"highlight" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_ip" varchar(64),
	"last_seen_user_agent" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_deletion_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar(120),
	"reviewed_at" timestamp,
	"processed_at" timestamp,
	"notes" text,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_starter_credits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"listings_total" integer DEFAULT 0 NOT NULL,
	"listings_used" integer DEFAULT 0 NOT NULL,
	"boosts_total" integer DEFAULT 0 NOT NULL,
	"boosts_used" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"granted_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"granted_by" varchar(40) DEFAULT 'system' NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_starter_credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_tier_id" varchar NOT NULL,
	"payment_id" varchar,
	"order_id" varchar,
	"invoice_id" varchar,
	"coupon_id" varchar,
	"expires_at" timestamp NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"boosts_remaining" integer DEFAULT 0 NOT NULL,
	"subscribed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"mobile" varchar,
	"location" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submission_comments" ADD CONSTRAINT "contact_submission_comments_submission_id_contact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."contact_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_views" ADD CONSTRAINT "listing_views_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_subscription_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_user_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("user_subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_subscription_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "users"
ADD CONSTRAINT "users_mobile_format_chk"
CHECK ("mobile" IS NULL OR "mobile" = '' OR "mobile" ~ '^[0-9]{10}$');

--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_mobile_unique_nonempty"
ON "users" ("mobile")
WHERE "mobile" IS NOT NULL AND "mobile" <> '';

--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_conversation"
ON "chat_conversations" ("listing_id", "buyer_id", "seller_id");

--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_buyer_updated"
ON "chat_conversations" ("buyer_id", "updated_at" DESC);

--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_seller_updated"
ON "chat_conversations" ("seller_id", "updated_at" DESC);

--> statement-breakpoint
CREATE INDEX "idx_chat_messages_conversation_created"
ON "chat_messages" ("conversation_id", "created_at" ASC);

--> statement-breakpoint
CREATE INDEX "idx_chat_messages_recipient_created"
ON "chat_messages" ("recipient_id", "created_at" DESC);

--> statement-breakpoint
CREATE INDEX "idx_listings_active_category_created"
ON "listings" ("is_active", "category", "created_at" DESC);

--> statement-breakpoint
CREATE INDEX "idx_listings_active_only"
ON "listings" ("created_at" DESC)
WHERE "is_active" = true AND "status" = 'active';

--> statement-breakpoint
CREATE INDEX "idx_listings_seller_created"
ON "listings" ("seller_id", "created_at" DESC);

--> statement-breakpoint
CREATE INDEX "idx_listings_expires_at_active"
ON "listings" ("expires_at")
WHERE "expires_at" IS NOT NULL AND "is_active" = true;

--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_user_status_expires"
ON "user_subscriptions" ("user_id", "status", "expires_at" DESC);

--> statement-breakpoint
CREATE INDEX "idx_user_activity_last_seen_at"
ON "user_activity" ("last_seen_at");

--> statement-breakpoint
CREATE INDEX "idx_user_deletion_reviews_status"
ON "user_deletion_reviews" ("status");
