-- Migration: Add admin workflow fields for enquiries

ALTER TABLE "contact_submissions"
ADD COLUMN IF NOT EXISTS "contacted" boolean NOT NULL DEFAULT false;

ALTER TABLE "contact_submissions"
ADD COLUMN IF NOT EXISTS "admin_comments" text;

ALTER TABLE "contact_submissions"
ADD COLUMN IF NOT EXISTS "contacted_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_contact_submissions_contacted"
  ON "contact_submissions" ("contacted");
