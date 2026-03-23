ALTER TABLE error_logs
ADD COLUMN IF NOT EXISTS fingerprint varchar(64);
--> statement-breakpoint
ALTER TABLE error_logs
ADD COLUMN IF NOT EXISTS occurrence_count integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE error_logs
ADD COLUMN IF NOT EXISTS first_seen_at timestamp with time zone NOT NULL DEFAULT NOW();
--> statement-breakpoint
ALTER TABLE error_logs
ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone NOT NULL DEFAULT NOW();
--> statement-breakpoint
ALTER TABLE error_logs
ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE error_logs
SET
  first_seen_at = COALESCE(first_seen_at, created_at, NOW()),
  last_seen_at = COALESCE(last_seen_at, created_at, NOW()),
  occurrence_count = COALESCE(occurrence_count, 1)
WHERE first_seen_at IS NULL
   OR last_seen_at IS NULL
   OR occurrence_count IS NULL;
--> statement-breakpoint
UPDATE error_logs
SET fingerprint = md5(
  concat_ws(
    '|',
    COALESCE(app_name, ''),
    COALESCE(environment, ''),
    COALESCE(level, ''),
    COALESCE(message, ''),
    COALESCE(endpoint, ''),
    COALESCE(method, ''),
    COALESCE(status_code::text, ''),
    COALESCE(screen, '')
  )
)
WHERE fingerprint IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint_last_seen
ON error_logs (fingerprint, last_seen_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved_created_at
ON error_logs (resolved, created_at DESC);
