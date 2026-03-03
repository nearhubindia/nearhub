# NearHub — System Architecture

## Overview

NearHub is a hyperlocal classifieds marketplace app (buy/sell/service/job) built with **Expo SDK 54** (React Native 0.81) for mobile and a **Node.js/Express** backend. Users create listings with images or short videos, browse by category or location, and pay for extended visibility via Razorpay.

> **Architecture Status (2026-03):** The repository is now feature-first.
> - Mobile routes live in `app/src/app`, feature logic in `app/features`, shared code in `app/shared`, and low-level utilities in `app/lib`.
> - Web follows `web/src/features` + `web/src/shared`.
> - Server routes/services are organized under `server/features/*` and registered centrally via `server/routes.ts`.
>
> Some legacy sections below still show earlier folder snapshots; treat the file/folder layout in the repo as source of truth.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Mobile App (Expo)                         │
│  React Native 0.81 · Expo Router v6 · New Architecture enabled  │
├──────────────────────────────────────────────────────────────────┤
│  Tabs: Home · Create · Shorts · Saved · Invoices                │
│  Screens: Auth · Listing Detail · Chat · Profile · Settings     │
│  Admin: Dashboard · Pricing · Spam · Videos                     │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP/JSON (REST)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Backend (Express 5)                            │
│  Node.js · TypeScript · tsx runtime                              │
├──────────────────────────────────────────────────────────────────┤
│  Routes: listings · subscriptions · invoices · coupons · search  │
│          admin-auth · admin-settings · video-upload · geo-search │
│          users · media-cleanup · dynamic-pricing · expiration    │
├──────────────────────────────────────────────────────────────────┤
│  Services: AI (Google GenAI) · OTP (MSG91/BSNL DLT) · Razorpay  │
│            Elasticsearch · Redis cache · Spam detection          │
│            Geo-search · Video streaming · Pricing engine         │
└────────┬──────────┬──────────┬──────────┬────────────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
    PostgreSQL   Redis    Elasticsearch   Object Storage
    (Drizzle)   (Cache)   (Full-text)    (Images/Video)
```

---

## Project Structure

```
nearhub/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (providers, fonts)
│   ├── (tabs)/                   # Bottom tab navigator
│   │   ├── index.tsx             # Home — browse listings
│   │   ├── create.tsx            # Create listing (photo/video)
│   │   ├── shorts.tsx            # Short-form video feed
│   │   ├── saved.tsx             # Saved/bookmarked listings
│   │   └── invoices.tsx          # User invoices
│   ├── auth/                     # Authentication flow
│   │   ├── register.tsx          # Phone number entry
│   │   ├── verify-otp.tsx        # OTP verification
│   │   └── select-plan.tsx       # Subscription plan picker
│   ├── admin/                    # Admin panel
│   │   ├── dashboard.tsx         # Admin overview
│   │   ├── pricing.tsx           # Pricing management
│   │   ├── spam-dashboard.tsx    # Spam moderation
│   │   └── videos.tsx            # Video moderation
│   ├── listing/[id].tsx          # Listing detail
│   ├── chat/[listingId].tsx      # Chat per listing
│   ├── profile.tsx               # User profile
│   ├── my-listings.tsx           # My active listings
│   ├── settings.tsx              # App settings
│   └── subscriptions.tsx         # Subscription management
│
├── components/                   # Reusable UI components
│   ├── ListingCard.tsx           # Listing card (grid/list)
│   ├── ShortsCard.tsx            # Video player card
│   ├── AppHeader.tsx             # Global header
│   ├── CategoryPill.tsx          # Category filter chips
│   ├── PhotoSlideshow.tsx        # Image carousel
│   ├── VideoRecorderModal.tsx    # Camera for video capture
│   ├── PaymentHandler.tsx        # Razorpay payment flow
│   ├── PricingDisplay.tsx        # Price breakdown UI
│   ├── CouponInput.tsx           # Coupon code entry
│   ├── DiscountSummary.tsx       # Discount visualization
│   ├── NotificationBell.tsx      # Notification indicator
│   ├── NotificationCenter.tsx    # Notification list
│   ├── AdminPricingSettings.tsx  # Admin pricing form
│   ├── AdminSpamDashboard.tsx    # Spam review panel
│   ├── ReportUserModal.tsx       # User reporting
│   ├── UserProfileHeader.tsx     # Profile display
│   ├── ProfileMenuModal.tsx      # Profile menu
│   ├── UploadProgressBar.tsx     # Upload progress
│   ├── ErrorBoundary.tsx         # Error boundary
│   ├── ErrorFallback.tsx         # Error fallback UI
│   ├── AnimatedSplash.tsx        # Splash screen animation
│   └── KeyboardAwareScrollViewCompat.tsx
│
├── lib/                          # Client-side logic & state
│   ├── config.ts                 # Backend URL resolution
│   ├── types.ts                  # Shared TypeScript types
│   ├── auth-context.tsx          # Authentication state (React Context)
│   ├── admin-auth-context.tsx    # Admin auth state
│   ├── listings-context.tsx      # Listings CRUD + API sync
│   ├── messages-context.tsx      # Chat messages state
│   ├── notifications-context.tsx # Push notifications
│   ├── search-history-context.tsx# Search history
│   ├── user-interests-context.tsx# Personalization prefs
│   ├── personalization.ts        # Feed ranking
│   ├── use-cache.tsx             # Cache hook
│   ├── use-payment.ts            # Razorpay hook
│   ├── use-spam-detection.tsx    # Client-side spam check
│   ├── query-client.ts           # TanStack Query client
│   ├── sample-data.ts            # Offline fallback data
│   ├── image-compressor.ts       # Image resize/compress
│   ├── image-hasher.ts           # Image deduplication hash
│   ├── image-storage.ts          # Local image cache
│   ├── invoice-storage.ts        # Local invoice cache
│   ├── video-compressor.ts       # Video compression
│   ├── video-editor.ts           # Video trimming
│   ├── video-recorder.ts         # Camera recording helpers
│   ├── chunked-video-upload.ts   # Chunked video upload
│   ├── location-data.ts          # Location helpers
│   └── utils.ts                  # General utilities
│
├── constants/
│   └── colors.ts                 # Design tokens (light/dark)
│
├── server/                       # Backend server
│   ├── index.ts                  # Express app + HTTP server
│   ├── routes.ts                 # Route registration hub
│   ├── storage.ts                # Storage interface
│   ├── routes/                   # Route modules
│   │   ├── admin-auth.ts         # POST /api/admin/login
│   │   ├── admin-settings.ts     # GET/PUT /api/admin/settings
│   │   ├── subscriptions.ts      # POST /api/subscriptions/*
│   │   ├── subscription-admin.ts # Admin subscription mgmt
│   │   ├── coupons.ts            # Coupon CRUD
│   │   ├── invoices.ts           # Invoice generation/retrieval
│   │   ├── users.ts              # User CRUD + spam reports
│   │   ├── search.ts             # GET /api/search
│   │   ├── geo-search.ts         # GET /api/search/nearby
│   │   ├── video-upload.ts       # POST /api/upload/video
│   │   ├── listing-expiration.ts # Expiry cron + cleanup
│   │   ├── media-cleanup.ts      # Orphan media cleanup
│   │   └── dynamic-pricing.ts    # AI-driven pricing
│   ├── services/                 # Business logic
│   │   ├── ai.ts                 # Google GenAI integration
│   │   ├── otp.ts                # OTP generation/validation
│   │   ├── msg91.ts              # MSG91 SMS gateway
│   │   ├── bsnl-dlt.ts           # BSNL DLT SMS registration
│   │   ├── razorpay.ts           # Razorpay payment gateway
│   │   ├── elasticsearch.ts      # ES index/search
│   │   ├── elasticsearch-hooks.ts# Listing sync hooks
│   │   ├── redis-cache.ts        # Redis connection + ops
│   │   ├── cache-middleware.ts    # Express caching middleware
│   │   ├── cache-invalidation.ts # Cache bust on mutation
│   │   ├── db-cache.ts           # DB query caching layer
│   │   ├── listings-storage.ts   # Listing persistence
│   │   ├── subscription.ts       # Subscription logic
│   │   ├── subscription-plans.ts # Plan definitions
│   │   ├── pricing.ts            # Price calculation
│   │   ├── dynamic-pricing.ts    # Demand-based pricing
│   │   ├── invoice.ts            # Invoice generation
│   │   ├── coupons.ts            # Coupon validation
│   │   ├── admin-auth.ts         # Admin JWT auth
│   │   ├── admin-settings.ts     # Settings with cache
│   │   ├── spam-detector.ts      # Spam scoring
│   │   ├── geolocation.ts        # Geocoding / reverse
│   │   ├── geo-search.ts         # PostGIS radius search
│   │   ├── location.ts           # Pincode location mapping
│   │   ├── video-upload.ts       # Video storage
│   │   └── video-streaming.ts    # Video HLS streaming
│   ├── data/                     # Data layer
│   │   ├── db.ts                 # Drizzle + pg connection
│   │   ├── pincodes.ts           # Pincode lookup
│   │   ├── pincodes.json         # India pincode DB
│   │   ├── pincode_geo.geojson   # Pincode geo boundaries
│   │   ├── seed-listings.json    # Seed data
│   │   └── subscription-plans.json
│   ├── scripts/                  # Server-side scripts
│   │   ├── generate-sample-listings.ts
│   │   ├── generate-seed-data.ts
│   │   ├── import-pincodes.js
│   │   └── seed-listings.ts
│   └── templates/
│       └── landing-page.html     # Marketing landing page
│
├── scripts/                      # Dev/ops scripts
│   ├── build.js                  # Static web build
│   ├── migrate.ts                # DB migration runner
│   ├── create-coupons.sql        # Coupon seed SQL
│   ├── sync-elasticsearch.ts     # ES index sync
│   ├── setup-redis.sh            # Redis setup
│   └── run-media-cleanup.sh      # Media cleanup cron
│
├── plugins/
│   └── withCleartextTraffic.js   # Android cleartext config plugin
│
├── patches/
│   └── expo-asset+12.0.12.patch  # Patch for expo-asset
│
├── web/                          # Admin web dashboard (Vite + React)
│   ├── src/                      # React SPA source
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── android/                      # Native Android project
│   ├── app/build.gradle
│   ├── build.gradle
│   └── gradle.properties
│
├── assets/images/                # App icons & splash
├── app.json                      # Expo config
├── eas.json                      # EAS Build profiles
├── drizzle.config.ts             # Drizzle ORM config
├── metro.config.js               # Metro bundler config
├── babel.config.js               # Babel config
├── tsconfig.json                 # TypeScript config
├── eslint.config.js              # ESLint config
├── index.js                      # App entry point
└── build-local.sh                # Local APK build script
```

---

## Navigation Architecture

```
RootLayout (_layout.tsx)
├── Providers: AuthProvider → ListingsProvider → …
│
├── (tabs)/ — Bottom Tab Navigator
│   ├── Home        — Category grid, search, infinite scroll
│   ├── Create (+)  — Photo/video capture → listing form → payment
│   ├── Shorts      — Vertical video feed (TikTok-style)
│   ├── Saved       — Bookmarked listings
│   └── Invoices    — Payment receipts
│
├── auth/ — Stack Navigator
│   ├── register    — Phone input
│   ├── verify-otp  — OTP entry
│   └── select-plan — Plan selection
│
├── admin/ — Stack Navigator (JWT-protected)
│   ├── login       — Admin credentials
│   ├── dashboard   — Stats overview
│   ├── pricing     — Price management
│   ├── spam-dashboard — Content moderation
│   └── videos      — Video moderation
│
├── listing/[id]    — Listing detail (deep-linkable)
├── chat/[listingId]— In-app messaging
├── profile         — User profile + location
├── my-listings     — User's active listings
├── settings        — App preferences
└── subscriptions   — Manage subscription
```

---

## Data Flow

### Listing Creation Flow

```
User → Create screen
  ├── Capture photo/video (expo-camera, expo-image-picker)
  ├── Compress media (image-compressor, video-compressor)
  ├── Deduplicate images (image-hasher → SHA256)
  ├── Fill form (title, price, category, condition, location)
  ├── AI validation (Google GenAI — content moderation)
  ├── Submit → ListingsContext.addListing()
  │     ├── POST /api/subscriptions/create-listing
  │     │     ├── Free tier check (< ₹3000 or first 15 days)
  │     │     ├── Paid → Razorpay order creation
  │     │     └── Store in PostgreSQL (Drizzle ORM)
  │     ├── Elasticsearch sync (via hooks)
  │     └── Cache invalidation (Redis)
  └── Refresh listing feed
```

### Authentication Flow

```
User → Register (phone number)
  → POST /api/auth/send-otp
    → OTP via MSG91 (or BSNL DLT fallback)
  → Verify OTP screen
    → POST /api/auth/verify-otp
    → JWT token issued
    → AuthContext stores token
```

---

## Backend API Routes

| Method  | Endpoint                            | Description                      |
| ------- | ----------------------------------- | -------------------------------- |
| GET     | `/api/health`                       | Health check                     |
| GET     | `/api/listings`                     | Paginated listings               |
| POST    | `/api/auth/send-otp`                | Send OTP to phone                |
| POST    | `/api/auth/verify-otp`              | Verify OTP, issue JWT            |
| POST    | `/api/subscriptions/create-listing` | Create listing (free/paid)       |
| POST    | `/api/subscriptions/verify-payment` | Razorpay callback                |
| GET     | `/api/search`                       | Full-text search (Elasticsearch) |
| GET     | `/api/search/nearby`                | Geo-radius search                |
| POST    | `/api/upload/video`                 | Chunked video upload             |
| GET/PUT | `/api/admin/settings`               | Admin settings CRUD              |
| POST    | `/api/admin/login`                  | Admin authentication             |
| GET     | `/api/invoices/:userId`             | User invoices                    |
| POST    | `/api/coupons/validate`             | Coupon validation                |
| POST    | `/api/users/report`                 | Report user/spam                 |
| GET     | `/api/pricing/calculate`            | Dynamic price calculation        |

---

## State Management

| State          | Mechanism                                    | Scope         |
| -------------- | -------------------------------------------- | ------------- |
| Auth           | React Context (`auth-context.tsx`)           | Global        |
| Admin Auth     | React Context (`admin-auth-context.tsx`)     | Admin screens |
| Listings       | React Context (`listings-context.tsx`)       | App-wide      |
| Messages       | React Context (`messages-context.tsx`)       | Chat screens  |
| Notifications  | React Context (`notifications-context.tsx`)  | Global        |
| Search History | React Context (`search-history-context.tsx`) | Search        |
| User Interests | React Context (`user-interests-context.tsx`) | Feed          |
| Server Data    | TanStack Query (`query-client.ts`)           | API cache     |
| Local Storage  | AsyncStorage                                 | Persistence   |

---

## External Services

| Service           | Purpose                                    | Integration                              |
| ----------------- | ------------------------------------------ | ---------------------------------------- |
| **Razorpay**      | Payment processing                         | `react-native-razorpay` + server SDK     |
| **Google GenAI**  | Content moderation, description generation | `@google/genai`                          |
| **MSG91**         | SMS OTP delivery                           | REST API (`server/services/msg91.ts`)    |
| **BSNL DLT**      | DLT-registered SMS (India compliance)      | REST API (`server/services/bsnl-dlt.ts`) |
| **Elasticsearch** | Full-text search, geo-queries              | `@elastic/elasticsearch` v9              |
| **Redis**         | API response caching, rate limiting        | `redis` v4                               |

---

## Database Schema (Drizzle ORM)

Primary table defined in `server/models/admin-settings.ts`:

**`admin_settings`** — Platform configuration:

- Pricing tiers (image/video × 15/45/90/180 days)
- Free tier rules (`free_listing_days`, `free_tier_threshold`)
- Discount settings
- Expiration/reactivation policies
- Media cleanup settings
- Dynamic pricing toggles
- Geo-radius configuration

Additional tables managed via Drizzle migrations:

- `users` — Phone, name, auth tokens
- `listings` — Title, price, category, images, location, expiry
- `subscriptions` — User-listing payment records
- `invoices` — Payment receipts
- `coupons` — Discount codes
- `spam_reports` — User reports

---

## Build & Deploy

### Development

```bash
npm run server:dev          # Start backend (tsx)
npm run expo:dev            # Start Expo + Metro
```

### Android Debug (Emulator)

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=~/android-sdk
EXPO_PUBLIC_DOMAIN=192.168.29.58:5000 \
  android/gradlew -p android assembleDebug
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Production APK (EAS Local)

```bash
./build-local.sh            # EAS local build → .apk
```

### Database

```bash
npm run db:generate         # Generate migration SQL
npm run db:push             # Push schema to PostgreSQL
npm run db:migrate          # Run migrations
npm run search:sync         # Sync Elasticsearch index
```
