-- Migration: Add phone number to contact submissions

ALTER TABLE "contact_submissions"
ADD COLUMN IF NOT EXISTS "phone" varchar(30) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "idx_contact_submissions_phone"
  ON "contact_submissions" ("phone");
