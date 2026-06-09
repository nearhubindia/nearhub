CREATE TABLE IF NOT EXISTS "listing_attribute_values" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "listing_id" varchar NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
  "attribute_id" varchar NOT NULL REFERENCES "master_listing_attributes"("id") ON DELETE CASCADE,
  "text_value" text,
  "number_value" numeric(18, 6),
  "boolean_value" boolean,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "listing_attribute_values_listing_attribute_unique"
  ON "listing_attribute_values" ("listing_id", "attribute_id");
