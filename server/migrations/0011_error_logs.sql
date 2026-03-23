CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  app_name VARCHAR(100),
  environment VARCHAR(50) NOT NULL DEFAULT 'production',
  level VARCHAR(20) NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack_trace TEXT,
  endpoint VARCHAR(255),
  method VARCHAR(20),
  status_code INTEGER,
  user_id VARCHAR(100),
  device VARCHAR(255),
  os VARCHAR(100),
  app_version VARCHAR(50),
  build_number VARCHAR(50),
  screen VARCHAR(255),
  network_type VARCHAR(50),
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_error_logs_app_name ON error_logs(app_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
