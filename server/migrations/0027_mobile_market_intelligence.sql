CREATE TABLE IF NOT EXISTS mobile_market_intelligence (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  brand varchar(80) NOT NULL,
  model varchar(120) NOT NULL,
  ram integer NOT NULL,
  storage integer NOT NULL,
  market_median integer,
  market_low integer,
  market_high integer,
  evidence_quality varchar(16) NOT NULL DEFAULT 'low',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale text,
  captured_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (brand, model, ram, storage)
);

CREATE INDEX IF NOT EXISTS mobile_market_intelligence_fresh_idx
  ON mobile_market_intelligence (brand, model, ram, storage, expires_at);
