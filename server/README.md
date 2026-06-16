# NearHub Server

Express + TypeScript API for NearHub.

## Main commands

```bash
npm run dev
npm run build
npm run lint
npm run type-check
npm run test
```

## Database

- `npm run db:migrate`
- `npm run db:create`
- `npm run db:status`
- `npm run db:push`

## Seeds and maintenance

- `npm run seed`
- `npm run seed:users`
- `npm run seed:listings`
- `npm run seed:deals`
- `npm run seed:expired-listing`
- `npm run search:sync`
- `npm run backfill:transactions`

## Layout

- `features/` - feature-specific routes and services
- `shared/` - reusable utilities, cache, notifications, AI, and docs
- `migrations/` - database migrations
- `scripts/` - one-off ops and maintenance scripts
- `templates/` - HTML templates used by the server
- `data/` - seed data and local data helpers

## Notes

- Keep temporary experiment files out of the repo.
- Put reusable backend logic in `shared/` instead of repeating helpers.
- Keep operational scripts in `scripts/` and document them here when they become part of the regular workflow.
