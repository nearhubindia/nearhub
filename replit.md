# Replit Agent Configuration - adlix Marketplace

## Overview

adlix is a local classifieds marketplace mobile app built with Expo (React Native) and an Express.js backend. Users can browse, create, save, and message about product listings. The app features a TikTok-style "Shorts" vertical scroll view for browsing listings, AI-powered listing image validation using Google Gemini, and an in-app chat system. Data is primarily stored client-side using AsyncStorage with sample data seeding, while the server provides AI integration endpoints and has a PostgreSQL database configured via Drizzle ORM for chat/conversation persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router v6 for file-based routing
- **Navigation**: Tab-based layout with 4 tabs: Browse (index), Sell (create), Saved, and Shorts
- **Detail screens**: `listing/[id]` for listing details, `chat/[listingId]` for messaging
- **Authentication**: OTP-based mobile registration flow with name, gender, email collection. Auth screens at `app/auth/register.tsx` and `app/auth/verify-otp.tsx`. Simulated OTP (shown on-screen, no SMS provider connected yet).
- **State management**: React Context API with three main providers:
  - `AuthProvider` — manages user authentication state, persisted to AsyncStorage
  - `ListingsProvider` — manages all listings and saved items, persisted to AsyncStorage
  - `MessagesProvider` — manages chat threads, persisted to AsyncStorage
- **Data fetching**: TanStack React Query is configured (`lib/query-client.ts`) with a helper `apiRequest` function for server communication, though most current data flows use local AsyncStorage
- **Fonts**: Inter font family (400, 500, 600, 700 weights) via `@expo-google-fonts/inter`
- **UI Libraries**: expo-image, expo-linear-gradient, expo-blur, expo-haptics, expo-image-picker, react-native-reanimated, react-native-gesture-handler, react-native-keyboard-controller
- **Icons**: @expo/vector-icons (Feather, Ionicons)
- **Styling**: Plain StyleSheet (no CSS-in-JS library), with a centralized color palette in `constants/colors.ts`
- **Platform support**: iOS, Android, and Web. Platform-specific adjustments are made inline (e.g., web top inset padding, keyboard handling)

### Backend (Express.js)

- **Runtime**: Node.js with TypeScript, compiled via `tsx` in dev and `esbuild` for production
- **Server entry**: `server/index.ts` — sets up CORS (Replit domain aware + localhost), JSON parsing, serves static web build in production
- **Routes** (`server/routes.ts`):
  - `POST /api/auth/send-otp` — Generates and stores a 6-digit OTP for a phone number (simulated, returns OTP in response since no SMS provider connected)
  - `POST /api/auth/verify-otp` — Verifies OTP and returns user object on success
  - `POST /api/validate-listing` — AI-powered image validation using Google Gemini (gemini-2.5-flash). Accepts base64 image data and listing metadata, returns validation JSON
- **Replit AI Integrations** (`server/replit_integrations/`):
  - `chat/` — Full CRUD for conversations and messages, with Gemini-powered AI chat (streaming SSE responses). Uses PostgreSQL via Drizzle
  - `image/` — Image generation endpoint using gemini-2.5-flash-image model
  - `batch/` — Batch processing utilities with concurrency limiting and retry logic for Gemini API calls
- **Storage**: `server/storage.ts` has an in-memory user storage (MemStorage) implementing an IStorage interface. This is a placeholder — not yet connected to the database for user management

### Database

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Config**: `drizzle.config.ts` reads `DATABASE_URL` environment variable
- **Schema** (`shared/schema.ts`): Currently defines a `users` table with id, username, password
- **Additional models** (`shared/models/chat.ts`): Defines `conversations` and `messages` tables for the AI chat feature
- **Migrations**: Output to `./migrations` directory via `drizzle-kit push`
- **Note**: The database connection module is at `server/db.ts` (imported by chat storage but not shown in the file listing — may need to be created if missing)

### Key Design Decisions

1. **Client-side data for listings**: Listings and saved items use AsyncStorage rather than the server database. This simplifies the initial implementation but means data is device-local. Sample data is seeded on first launch.

2. **Server-side data for AI chat**: The Replit AI integration chat feature uses PostgreSQL through Drizzle, providing persistent conversation history across sessions.

3. **Shared schema directory**: The `shared/` directory contains schemas accessible to both frontend and backend, enabling type sharing via path aliases (`@shared/*`).

4. **AI validation flow**: When creating a listing, the client can send the image to the server for AI-based content moderation before submission. The server uses Gemini multimodal capabilities to analyze the image against the listing metadata.

5. **File-based routing**: Expo Router maps the `app/` directory structure to routes. Dynamic segments use `[param]` syntax. The `(tabs)` group creates the bottom tab navigator.

### Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required for server database features)
- `AI_INTEGRATIONS_GEMINI_API_KEY` — API key for Replit's AI Integrations (Gemini)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` — Base URL for Replit's AI Integrations proxy
- `EXPO_PUBLIC_DOMAIN` — Public domain for the API server (set automatically on Replit)
- `REPLIT_DEV_DOMAIN` — Development domain (set automatically by Replit)

### Build & Run

- **Dev (mobile)**: `npm run expo:dev` — starts Expo dev server with Replit proxy config
- **Dev (server)**: `npm run server:dev` — starts Express server with tsx
- **Production build**: `npm run expo:static:build` — builds static web bundle; `npm run server:build` + `npm run server:prod` — builds and runs production server
- **Database**: `npm run db:push` — pushes Drizzle schema to PostgreSQL

## External Dependencies

- **Google Gemini AI** (via Replit AI Integrations): Used for listing image validation, AI chat responses, and image generation. Accessed through `@google/genai` SDK with Replit's proxy base URL
- **PostgreSQL**: Database for persistent storage (conversations, messages, users). Connected via `pg` driver and Drizzle ORM
- **AsyncStorage** (`@react-native-async-storage/async-storage`): Client-side persistent storage for listings, saved items, and chat threads
- **Expo Services**: Expo SDK for native module access (camera, image picker, haptics, location, etc.)
- **Unsplash**: Sample listing images reference Unsplash URLs (used in sample data only)