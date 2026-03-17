# NearHub Architecture (Current)

## Repository Shape

NearHub is a multi-project repo:

- `app/` - Expo React Native client
- `server/` - Express + TypeScript API
- `web/` - Vite React admin app

Each project has its own dependencies and scripts.

## Mobile (`app/`)

Current app structure is feature-first:

- `src/app/` - Expo Router route entry files
- `features/` - screen/domain modules
- `shared/` - reusable UI + contexts + hooks
- `lib/` - utilities, API helpers, config, types

Important current flows:

- Home feed + category/search
- Listing creation/editing
- Shorts feed
- Saved/favorites
- Profile + My Listings
- Invoices and subscriptions

## Server (`server/`)

Feature-based route/service organization:

- `features/*/routes` - HTTP endpoints
- `features/*/services` - domain logic
- `features/*/models` - Drizzle schema
- `data/db.ts` - DB connection
- `routes.ts` - feature route registration
- `index.ts` - app bootstrap

Recent live listing metrics:

- `viewCount` from `listing_views`
- `chatCount` from `chat_conversations`
- `likeCount/saveCount` from `listing_likes`

Migration added:

- `server/migrations/0009_listing_likes.sql`

## Web (`web/`)

- `src/features/` - admin feature modules
- `src/shared/` - shared components/utilities

Used for moderation/admin/reporting/configuration screens.

## Runtime Dependencies

- PostgreSQL (primary datastore)
- Redis (cache)
- Razorpay (payments)
- Ollama (`llava-phi3`) for vision/text moderation support

## Quality/Validation

Per project checks:

```bash
npm run type-check
npm run lint
npm run format:check
```
