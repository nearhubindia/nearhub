CREATE TABLE IF NOT EXISTS mobile_ai_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand varchar(80) NOT NULL,
  model varchar(120) NOT NULL,
  build_model varchar(120) NOT NULL DEFAULT '',
  ram_gb integer,
  storage_gb integer,
  release_date date,
  current_new_price_inr integer,
  market_low_inr integer,
  market_median_inr integer,
  market_high_inr integer,
  evidence_quality varchar(16) NOT NULL DEFAULT 'low',
  confidence integer NOT NULL DEFAULT 0,
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, model, build_model, ram_gb, storage_gb)
);
CREATE INDEX IF NOT EXISTS mobile_ai_knowledge_fresh_idx
  ON mobile_ai_knowledge (brand, model, expires_at);
