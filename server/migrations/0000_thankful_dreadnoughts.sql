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
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" varchar NOT NULL,
	"listing_id" varchar NOT NULL,
	"subscription_id" varchar NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"used_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_percentage" integer NOT NULL,
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
CREATE TABLE "listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"listing_type" varchar(20) DEFAULT 'image',
	"price" numeric(10, 2) NOT NULL,
	"offer_price" numeric(10, 2),
	"price_unit" varchar(50),
	"condition" varchar(50) NOT NULL,
	"location" varchar(200) NOT NULL,
	"pincode" varchar(10),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"images" text,
	"subscription_tier_id" varchar,
	"coupon_id" varchar,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"duration_days" integer,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"duration_days" integer NOT NULL,
	"features" text NOT NULL,
	"max_listings" integer NOT NULL,
	"highlight" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
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
	"subscribed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_subscription_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_subscription_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;