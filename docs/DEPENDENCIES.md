# NearHub — Dependencies & Libraries

> Expo SDK 54.0.27 · React Native 0.81.5 · Node.js · TypeScript 5.9

---

## Mobile App Dependencies

### Core Framework

| Package            | Version  | Purpose                                         |
| ------------------ | -------- | ----------------------------------------------- |
| `expo`             | ~54.0.27 | Expo SDK — managed native modules, build system |
| `react`            | 19.1.0   | UI rendering engine                             |
| `react-native`     | 0.81.5   | Native bridge (New Architecture enabled)        |
| `react-dom`        | 19.1.0   | Web rendering target                            |
| `react-native-web` | ^0.21.0  | React Native → Web compatibility                |
| `expo-router`      | ~6.0.17  | File-based routing (Expo Router v6)             |

### Navigation & UI

| Package                            | Version  | Purpose                      |
| ---------------------------------- | -------- | ---------------------------- |
| `react-native-screens`             | ~4.16.0  | Native screen containers     |
| `react-native-gesture-handler`     | ~2.28.0  | Touch gesture system         |
| `react-native-reanimated`          | ~4.1.1   | 60fps animations             |
| `react-native-safe-area-context`   | ~5.6.0   | Safe area insets             |
| `react-native-svg`                 | ^15.12.1 | SVG rendering                |
| `react-native-keyboard-controller` | ^1.20.6  | Keyboard-aware layouts       |
| `react-native-worklets`            | ^0.5.1   | JS worklet threading         |
| `expo-blur`                        | ~15.0.8  | Blur effects (tab bar)       |
| `expo-glass-effect`                | ~0.1.4   | Glass morphism effects       |
| `expo-linear-gradient`             | ~15.0.8  | Gradient backgrounds         |
| `expo-haptics`                     | ~15.0.8  | Haptic feedback              |
| `expo-symbols`                     | ~1.0.8   | SF Symbols (iOS)             |
| `expo-status-bar`                  | ~3.0.9   | Status bar control           |
| `expo-system-ui`                   | ~6.0.9   | System UI config             |
| `expo-splash-screen`               | ~31.0.12 | Splash screen                |
| `@expo/vector-icons`               | ^15.0.3  | Icon library (Feather, etc.) |
| `@expo-google-fonts/inter`         | ^0.4.2   | Inter font family            |

### Media

| Package                  | Version  | Purpose                         |
| ------------------------ | -------- | ------------------------------- |
| `expo-camera`            | ~17.0.10 | Camera capture (CameraView API) |
| `expo-image`             | ~3.0.11  | Optimized image rendering       |
| `expo-image-picker`      | ~17.0.9  | Photo/video picker              |
| `expo-image-manipulator` | ^14.0.8  | Image resize/crop/compress      |
| `expo-media-library`     | ^18.2.1  | Media library access            |
| `expo-video`             | ^3.0.15  | Video playback (expo-video API) |
| `expo-video-thumbnails`  | ^10.0.8  | Video thumbnail extraction      |
| `expo-av`                | ^16.0.8  | Audio/video utilities           |

### Device & Platform

| Package            | Version  | Purpose                       |
| ------------------ | -------- | ----------------------------- |
| `expo-location`    | ~19.0.8  | GPS location services         |
| `expo-linking`     | ~8.0.10  | Deep linking / URL handling   |
| `expo-web-browser` | ~15.0.10 | In-app browser                |
| `expo-constants`   | ~18.0.11 | App constants (version, etc.) |
| `expo-crypto`      | ^15.0.8  | Cryptographic operations      |
| `expo-font`        | ~14.0.10 | Custom font loading           |

### Data & Networking

| Package                                     | Version  | Purpose                               |
| ------------------------------------------- | -------- | ------------------------------------- |
| `@tanstack/react-query`                     | ^5.83.0  | Server state management / API caching |
| `@react-native-async-storage/async-storage` | 2.2.0    | Persistent key-value storage          |
| `axios`                                     | ^1.13.5  | HTTP client                           |
| `zod`                                       | ^3.25.76 | Runtime schema validation             |
| `zod-validation-error`                      | ^3.5.4   | User-friendly Zod errors              |

### Payments

| Package                 | Version | Purpose                      |
| ----------------------- | ------- | ---------------------------- |
| `react-native-razorpay` | ^2.3.1  | Razorpay payment SDK (India) |

### Polyfills

| Package                            | Version | Purpose                      |
| ---------------------------------- | ------- | ---------------------------- |
| `@stardazed/streams-text-encoding` | ^1.0.2  | TextEncoder/Decoder polyfill |
| `@ungap/structured-clone`          | ^1.3.0  | structuredClone polyfill     |

---

## Backend Dependencies

### Server Framework

| Package                 | Version | Purpose                                |
| ----------------------- | ------- | -------------------------------------- |
| `express`               | ^5.0.1  | HTTP server framework (Express 5)      |
| `http-proxy-middleware` | ^3.0.5  | Dev proxy middleware                   |
| `ws`                    | ^8.18.0 | WebSocket server (chat, notifications) |
| `tsx`                   | ^4.20.6 | TypeScript execution runtime           |

### Database

| Package       | Version | Purpose                       |
| ------------- | ------- | ----------------------------- |
| `pg`          | ^8.16.3 | PostgreSQL client             |
| `drizzle-orm` | ^0.39.3 | TypeScript ORM (schema-first) |
| `drizzle-zod` | ^0.7.1  | Drizzle ↔ Zod schema bridge   |

### Search & Cache

| Package                  | Version | Purpose                               |
| ------------------------ | ------- | ------------------------------------- |
| `@elastic/elasticsearch` | ^9.3.1  | Elasticsearch client v9               |
| `redis`                  | ^4.6.13 | Redis client (caching, rate limiting) |

### Authentication & Security

| Package        | Version | Purpose                        |
| -------------- | ------- | ------------------------------ |
| `jsonwebtoken` | ^9.0.3  | JWT token signing/verification |
| `bcryptjs`     | ^3.0.3  | Password hashing               |

### AI & ML

| Package         | Version | Purpose                                                   |
| --------------- | ------- | --------------------------------------------------------- |
| `@google/genai` | ^1.42.0 | Google GenAI (content moderation, description generation) |

### Utilities

| Package   | Version  | Purpose                         |
| --------- | -------- | ------------------------------- |
| `p-limit` | ^7.3.0   | Concurrency limiter             |
| `p-retry` | ^7.1.1   | Retry with backoff              |
| `zod`     | ^3.25.76 | Shared with client — validation |

---

## Dev Dependencies

| Package                       | Version      | Purpose                       |
| ----------------------------- | ------------ | ----------------------------- |
| `typescript`                  | ~5.9.2       | TypeScript compiler           |
| `@types/react`                | ~19.1.10     | React type definitions        |
| `@types/express`              | ^5.0.0       | Express type definitions      |
| `@types/pg`                   | ^8.16.0      | PostgreSQL type definitions   |
| `@types/jsonwebtoken`         | ^9.0.10      | JWT type definitions          |
| `@types/bcryptjs`             | ^2.4.6       | bcrypt type definitions       |
| `@babel/core`                 | ^7.25.2      | Babel compiler core           |
| `babel-plugin-react-compiler` | ^19.0.0-beta | React Compiler (experimental) |
| `eslint`                      | ^9.31.0      | Linter                        |
| `eslint-config-expo`          | ~10.0.0      | Expo ESLint preset            |
| `drizzle-kit`                 | ^0.18.1      | Drizzle migration generator   |
| `patch-package`               | ^8.0.0       | Patch node_modules packages   |
| `@expo/ngrok`                 | ^4.1.0       | Tunnel for remote testing     |

---

## Native / Build Toolchain

| Tool        | Version       | Purpose                    |
| ----------- | ------------- | -------------------------- |
| Gradle      | 8.14.3        | Android build system       |
| Kotlin      | 2.1.20        | Android native code        |
| Android SDK | compileSdk 36 | Android compilation target |
| Android NDK | 27.1.12297006 | Native code compilation    |
| Java        | OpenJDK 21    | JVM for Gradle             |
| minSdk      | 24            | Android 7.0+ support       |
| targetSdk   | 36            | Android 16 target          |

---

## Active Patches

| Patch                      | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `expo-asset+12.0.12.patch` | Fixes asset resolution issue in expo-asset |

---

## Expo Plugins

| Plugin                           | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| `expo-router`                    | File-based routing with origin disabled     |
| `expo-font`                      | Custom font auto-linking                    |
| `expo-web-browser`               | Browser intent handling                     |
| `./plugins/withCleartextTraffic` | Allow HTTP traffic on Android (dev backend) |

---

## Experimental Features

| Feature          | Config                                         |
| ---------------- | ---------------------------------------------- |
| Typed Routes     | `experiments.typedRoutes: true`                |
| React Compiler   | `experiments.reactCompiler: true`              |
| New Architecture | `newArchEnabled: true` (Fabric + TurboModules) |

---

## Environment Variables

| Variable                  | Required | Description                     |
| ------------------------- | -------- | ------------------------------- |
| `DATABASE_URL`            | Yes      | PostgreSQL connection string    |
| `EXPO_PUBLIC_DOMAIN`      | Yes      | Backend host:port for API calls |
| `MSG91_API_KEY`           | Yes      | MSG91 SMS API key               |
| `MSG91_SENDER_ID`         | Yes      | MSG91 sender ID                 |
| `MSG91_ROUTE`             | Yes      | MSG91 route                     |
| `MSG91_ENABLED`           | No       | Enable/disable MSG91            |
| `BSNL_DLT_ENABLED`        | No       | Enable BSNL DLT SMS             |
| `BSNL_DLT_USERNAME`       | Cond.    | BSNL DLT credentials            |
| `BSNL_DLT_PASSWORD`       | Cond.    | BSNL DLT credentials            |
| `BSNL_DLT_SENDER_ID`      | Cond.    | DLT registered sender           |
| `BSNL_DLT_TEMPLATE_ID`    | Cond.    | DLT registered template         |
| `BSNL_DLT_ROUTE`          | Cond.    | DLT route                       |
| `OTP_VALIDITY_MINUTES`    | No       | OTP expiry (default: 5)         |
| `OTP_MAX_ATTEMPTS`        | No       | Max OTP attempts                |
| `OTP_RATE_LIMIT_REQUESTS` | No       | Rate limit per window           |
| `OTP_RATE_LIMIT_WINDOW`   | No       | Rate limit window (seconds)     |
