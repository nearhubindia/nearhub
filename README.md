# NearHub

NearHub is a multi-app repo with three independently runnable projects:

- `app/` - Expo React Native mobile app
- `server/` - Express + TypeScript API
- `web/` - Vite + React admin web app

## Quick Start

### 1. Server

```bash
cd server
npm install
npm run db:migrate
npm run dev
```

### 2. Mobile App

```bash
cd app
npm install
npm run dev
```

For native Android build/install:

```bash
cd app
npx expo prebuild -p android
npx expo run:android
```

### 3. Web Admin

```bash
cd web
npm install
npm run dev
```

## Feature tests

From the repository root:

```bash
npm run test:unit       # backend feature units + web feature units
npm run test:coverage   # thresholded feature coverage reports
npm run test:all        # coverage + production-bundle Playwright tests
npm run e2e             # web Playwright suite
```

Backend unit tests live under `server/features/**/tests`, web unit tests live
under `web/src/features/**/tests`, and browser workflows live under `web/e2e`.

## Current Important Notes

- Listings now expose live metrics:
  - `viewCount`
  - `chatCount`
  - `likeCount` / `saveCount`
- Likes/Saves are now persisted in DB via `listing_likes` table.
- Run server migration before testing likes:

```bash
cd server
npm run db:migrate
```

## Quality Checks

Run per project:

```bash
npm run type-check
npm run lint
npm run format:check
```

## Key Docs

- Mobile dev workflow: `app/MOBILE_DEV_GUIDE.md`
- AI moderation setup: `server/AI_MODERATION_SETUP.md`
- Server script map: `server/scripts/README.md`
- Architecture overview: `docs/ARCHITECTURE.md`
- Push gates: `docs/GIT_GATES.md`
- CI/CD setup: `docs/CICD_SETUP.md`
