CREATE TABLE IF NOT EXISTS "master_listing_categories" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "master_listing_categories_name_unique"
  ON "master_listing_categories" ("name");

CREATE TABLE IF NOT EXISTS "master_listing_subcategories" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" varchar NOT NULL REFERENCES "master_listing_categories"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "master_listing_subcategories_category_name_unique"
  ON "master_listing_subcategories" ("category_id", "name");

CREATE TABLE IF NOT EXISTS "master_listing_units" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "master_listing_units_name_unique"
  ON "master_listing_units" ("name");

CREATE TABLE IF NOT EXISTS "master_listing_attributes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subcategory_id" varchar NOT NULL REFERENCES "master_listing_subcategories"("id") ON DELETE CASCADE,
  "name" varchar(160) NOT NULL,
  "field_type" varchar(40) DEFAULT 'Text' NOT NULL,
  "unit_id" varchar REFERENCES "master_listing_units"("id") ON DELETE SET NULL,
  "required" boolean DEFAULT false NOT NULL,
  "status" varchar(20) DEFAULT 'Active' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "master_listing_attributes_subcategory_name_unique"
  ON "master_listing_attributes" ("subcategory_id", "name");
