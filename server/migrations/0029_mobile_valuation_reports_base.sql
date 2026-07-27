CREATE TABLE IF NOT EXISTS mobile_valuation_reports (
  id varchar PRIMARY KEY,
  report_id varchar(64) NOT NULL UNIQUE,
  user_id varchar,
  input_data jsonb NOT NULL,
  result_data jsonb NOT NULL,
  model_version varchar(64) NOT NULL,
  ai_provider varchar(32),
  ai_model varchar(80),
  ai_validated boolean NOT NULL DEFAULT false,
  confidence integer NOT NULL,
  signature varchar(128) NOT NULL,
  valid_until timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE mobile_valuation_reports ALTER COLUMN ai_provider DROP NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_valuation_reports_user_idx ON mobile_valuation_reports (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_valuation_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id varchar NOT NULL REFERENCES mobile_valuation_reports(id) ON DELETE CASCADE,
  factor varchar(40) NOT NULL,
  factor_type varchar(20) NOT NULL,
  multiplier numeric(8,6),
  deduction_inr integer,
  value_before_inr integer NOT NULL,
  value_after_inr integer NOT NULL,
  rationale text NOT NULL,
  source varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_valuation_adjustments_report_idx ON mobile_valuation_adjustments (report_id);
