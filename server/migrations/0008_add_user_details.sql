ALTER TABLE "users" ADD COLUMN "mobile" varchar;
ALTER TABLE "users" ADD COLUMN "location" text;
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now();
