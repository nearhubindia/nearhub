-- Migration: Add contact form submissions table for web contact page

CREATE TABLE IF NOT EXISTS "contact_submissions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "email" varchar(255) NOT NULL,
  "subject" varchar(200) NOT NULL,
  "message" text NOT NULL,
  "source" varchar(30) DEFAULT 'web' NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_contact_submissions_created_at"
  ON "contact_submissions" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_contact_submissions_email"
  ON "contact_submissions" ("email");
