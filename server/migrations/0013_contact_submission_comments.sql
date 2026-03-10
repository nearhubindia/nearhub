-- Migration: Add multiple admin comments per enquiry

CREATE TABLE IF NOT EXISTS "contact_submission_comments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" varchar NOT NULL REFERENCES "contact_submissions"("id") ON DELETE CASCADE,
  "comment" text NOT NULL,
  "created_by" varchar,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_contact_submission_comments_submission_id"
  ON "contact_submission_comments" ("submission_id");

CREATE INDEX IF NOT EXISTS "idx_contact_submission_comments_created_at"
  ON "contact_submission_comments" ("created_at");
