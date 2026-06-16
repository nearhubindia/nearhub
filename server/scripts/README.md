# Server Scripts

These scripts are grouped by purpose rather than by feature area.

## Database and migrations

- `apply-indexes.ts`
- `apply-starter-credits-migration.ts`
- `apply-coupon-user-migration.ts`
- `apply-coupon-tier-migration.ts`
- `backfill-transactions.ts`
- `refresh-db.sh`

## Seeding and sample data

- `seed.ts`
- `seed-db-listings.ts`
- `seed-deals.ts`
- `seed-expired-listing.ts`
- `seed-free30-coupon.ts`
- `seed-listings.ts`
- `seed-subscription-tiers.ts`
- `generate-seed-data.ts`
- `generate-sample-listings.ts`

## Imports and sync jobs

- `import-location-index.ts`
- `import-pincodes.js`
- `sync-elasticsearch.ts`

## Operational helpers

- `disk-cleanup.sh`
- `run-media-cleanup.sh`
- `setup-ai-moderation.sh`
- `setup-redis.sh`
- `create-coupons.sql`
- `ensure-sourcemap-file.mjs`

## Notes

- Keep one-off experiments out of this folder unless they are meant to stay available.
- When a script becomes part of the regular workflow, add it to `server/package.json` and document it here.
