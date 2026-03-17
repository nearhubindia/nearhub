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
- Architecture overview: `docs/ARCHITECTURE.md`
