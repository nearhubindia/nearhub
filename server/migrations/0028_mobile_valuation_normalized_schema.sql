CREATE TABLE IF NOT EXISTS mobile_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand varchar(80) NOT NULL, model varchar(120) NOT NULL,
  model_number varchar(80), release_date date, launch_price_inr integer, launch_android_version varchar(32),
  latest_official_android_version varchar(32), chipset varchar(160), processor_tier varchar(32),
  battery_capacity_mah integer, manufacturer_support_ended boolean NOT NULL DEFAULT false,
  specification_source text, specification_confidence numeric(5,4), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_devices_brand_model_idx ON mobile_devices (brand, model);

CREATE TABLE IF NOT EXISTS mobile_device_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
  ram_gb integer NOT NULL, storage_gb integer NOT NULL, variant_code varchar(100), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, ram_gb, storage_gb)
);

CREATE TABLE IF NOT EXISTS mobile_market_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid NOT NULL REFERENCES mobile_device_variants(id) ON DELETE CASCADE,
  source_name varchar(80) NOT NULL, source_type varchar(32) NOT NULL, source_reference text, price_inr integer NOT NULL,
  listing_condition varchar(32), battery_health integer, price_type varchar(24) NOT NULL DEFAULT 'asking', seller_type varchar(24),
  region_code varchar(40), is_accepted boolean NOT NULL DEFAULT true, rejection_reason text, source_confidence numeric(5,4), raw_evidence text,
  observed_at timestamptz NOT NULL, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_market_observations_variant_date_idx ON mobile_market_observations (variant_id, observed_at);

CREATE TABLE IF NOT EXISTS mobile_market_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid NOT NULL REFERENCES mobile_device_variants(id) ON DELETE CASCADE,
  region_code varchar(40) NOT NULL DEFAULT 'IN', market_low_inr integer NOT NULL, market_median_inr integer NOT NULL, market_high_inr integer NOT NULL,
  observation_count integer NOT NULL DEFAULT 0, evidence_quality varchar(16) NOT NULL DEFAULT 'low', confidence numeric(5,4) NOT NULL,
  calculation_version varchar(64) NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_market_benchmarks_lookup_idx ON mobile_market_benchmarks (variant_id, region_code, expires_at);
