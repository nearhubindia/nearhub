# Mobile App (app/) - Feature-Based Folder Structure

This document describes the feature-based architecture of the mobile application, organized to promote modularity, maintainability, and scalability.

## Directory Structure

```
app/
├── features/                    # Feature-specific code
│   ├── home/                   # Home/Browse listings feature
│   │   ├── screens/            # Screen components
│   │   │   └── Home.tsx
│   │   ├── components/         # Feature-specific components
│   │   ├── services/           # API calls & business logic
│   │   ├── hooks/              # Feature-specific custom hooks
│   │   └── index.ts            # Barrel export file
│   │
│   ├── create/                 # Create/Post listing feature
│   │   ├── screens/
│   │   │   └── Create.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── shorts/                 # Video feed/Shorts feature
│   │   ├── screens/
│   │   │   └── Shorts.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── saved/                  # Saved listings feature
│   │   ├── screens/
│   │   │   └── Saved.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── invoices/               # Invoice/Orders feature
│   │   ├── screens/
│   │   │   └── Invoices.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── auth/                   # Authentication feature
│   │   ├── screens/
│   │   │   ├── register.tsx
│   │   │   ├── verify-otp.tsx
│   │   │   └── select-plan.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── chat/                   # Messaging feature
│   │   ├── screens/
│   │   │   ├── index.tsx       # Chat list
│   │   │   └── [listingId].tsx # Chat detail
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── listings/               # Listing detail feature
│   │   ├── screens/
│   │   │   ├── [id].tsx        # Listing detail
│   │   │   └── my-listings.tsx # User's listings
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── profile/                # User profile feature
│   │   ├── screens/
│   │   │   └── profile.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── subscriptions/          # Subscription management
│   │   ├── screens/
│   │   │   └── subscriptions.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── settings/               # App settings feature
│   │   ├── screens/
│   │   │   └── settings.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   └── search/                 # Search feature
│       ├── screens/
│       │   └── search-results.tsx
│       ├── components/
│       ├── services/
│       ├── hooks/
│       └── index.ts
│
├── shared/                      # Shared code across features
│   ├── components/             # Reusable UI components
│   │   ├── AnimatedSplash.tsx
│   │   ├── AppHeader.tsx
│   │   ├── CategoryPill.tsx
│   │   ├── CouponInput.tsx
│   │   ├── DiscountSummary.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── ErrorFallback.tsx
│   │   ├── KeyboardAwareScrollViewCompat.tsx
│   │   ├── ListingCard.tsx
│   │   ├── MediaCarousel.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── NotificationCenter.tsx
│   │   ├── PaymentHandler.tsx
│   │   ├── PricingDisplay.tsx
│   │   ├── ProfileMenuModal.tsx
│   │   ├── ReportUserModal.tsx
│   │   ├── RichTextEditor.tsx
│   │   ├── ShortsCard.tsx
│   │   ├── UploadProgressBar.tsx
│   │   ├── UserProfileHeader.tsx
│   │   ├── VideoRecorderModal.tsx
│   │   └── index.ts
│   │
│   ├── contexts/               # Global state management
│   │   ├── auth-context.tsx    # Auth state (user, login, signup)
│   │   ├── listings-context.tsx # Listings state
│   │   ├── messages-context.tsx # Chat messages state
│   │   ├── notifications-context.tsx # Push notifications state
│   │   ├── search-history-context.tsx # Search history state
│   │   ├── user-interests-context.tsx # User interests for personalization
│   │   └── index.ts
│   │
│   ├── hooks/                  # Custom React hooks
│   │   └── index.ts
│   │
│   ├── services/               # API services
│   │   └── index.ts
│   │
│   ├── types/                  # Shared TypeScript types
│   │   └── index.ts
│   │
│   └── utils/                  # Utility functions
│       ├── image-compressor.ts
│       ├── image-hasher.ts
│       ├── personalization.ts
│       ├── query-client.ts
│       └── index.ts
│
├── constants/                   # App constants
│   └── colors.ts
│
├── lib/                         # Core libraries (non-feature specific)
│   ├── config.ts               # Environment configuration
│   ├── location-data.ts        # Location utilities
│   ├── types.ts                # Core type definitions
│   ├── utils.ts                # General utilities
│   ├── use-admin-settings.ts   # Admin settings hook
│   ├── query-client.ts         # React Query setup
│   ├── chunked-video-upload.ts
│   ├── image-storage.ts
│   ├── invoice-storage.ts
│   ├── sample-data.ts
│   └── ...other utilities
│
├── assets/                      # Static assets
│   └── images/
│
├── android/                     # Android native code
│
├── _layout.tsx                  # Root layout (providers wrapper)
├── (+native-intent).tsx
├── (+not-found).tsx
├── my-listings.tsx              # [OLD - to be removed]
├── profile.tsx                  # [OLD - to be removed]
├── search-results.tsx           # [OLD - to be removed]
├── settings.tsx                 # [OLD - to be removed]
├── subscriptions.tsx            # [OLD - to be removed]
├── (tabs)/                      # [OLD - to be removed]
├── auth/                        # [OLD - to be removed]
├── chat/                        # [OLD - to be removed]
├── components/                  # [OLD - to be removed]
├── listing/                     # [OLD - to be removed]
├── app.json                     # Expo config
├── babel.config.js
├── eas.json                     # EAS build config
├── expo-env.d.ts
├── index.js                     # Expo entry point
├── metro.config.js
├── package.json
└── tsconfig.json
```

## Import Patterns

### Importing Feature Screens
```tsx
// Feature barrel imports
import { HomeScreen } from '@/features/home';
import { CreateScreen } from '@/features/create';
```

### Importing Shared Components
```tsx
// Shared component imports
import { ListingCard, AppHeader, NotificationCenter } from '@/shared/components';

// Or individual imports
import { ListingCard } from '@/shared/components/ListingCard';
```

### Importing Contexts
```tsx
// Context imports
import { useAuth } from '@/shared/contexts/auth-context';
import { useListings } from '@/shared/contexts/listings-context';
import { useMessages } from '@/shared/contexts/messages-context';
import { useSearchHistory } from '@/shared/contexts/search-history-context';
import { useUserInterests } from '@/shared/contexts/user-interests-context';
import { useNotifications } from '@/shared/contexts/notifications-context';
```

### Importing Lib Utils
```tsx
// Library utilities
import { getApiUrl } from '@/lib/query-client';
import { calculateDistance } from '@/lib/location-data';
import type { Category } from '@/lib/types';
import { getTimeAgo } from '@/lib/utils';
```

## Feature Development Guidelines

### When Creating a New Feature

1. **Create Feature Directory**
   ```bash
   mkdir -p app/features/{featureName}/{screens,components,services,hooks}
   ```

2. **Add Feature Barrel** (`index.ts`)
   ```typescript
   // features/featureName/index.ts
   export * from './screens/ScreenName';
   export { default as ScreenNameScreen } from './screens/ScreenName';
   ```

3. **Structure Within Feature**
   - `screens/`: Screen/page components (exported for navigation)
   - `components/`: Feature-specific components used only in this feature
   - `services/`: API calls and business logic for this feature
   - `hooks/`: Custom hooks used only in this feature

4. **Use Shared APIs**
   - Use hooks from `@/shared/contexts` for global state
   - Use components from `@/shared/components` for common UI
   - Use utilities from `@/shared/utils` for common functions

5. **Avoid Cross-Feature Imports**
   - Don't import from one feature's screens into another feature
   - Use shared contexts to communicate between features
   - Create shared components for reusable UI

## Context API Structure

The app uses React Context for state management organized by domain:

- **AuthContext**: User authentication, profile, login/signup
- **ListingsContext**: Browse listings, filtering, search
- **MessagesContext**: Chat conversations, messages
- **NotificationsContext**: Push notifications, notification state
- **SearchHistoryContext**: Recent searches, trending searches
- **UserInterestsContext**: User interests for personalization

## Component Organization

### Shared Components
Located in `shared/components/`, these are used across multiple features:
- UI primitives (buttons, cards, modals, headers)
- Feature-agnostic containers (error boundary, splash screen)
- Cross-feature components (notification center, user avatars)

### Feature-Specific Components
Located within `features/{name}/components/`, these are used only within their feature:
- Composed from shared components
- Feature business logic
- Feature-specific layouts and arrangements

## Environment Configuration

Configuration is centralized in `lib/config.ts`:
```typescript
import { ENV_CONFIG } from '@/lib/config';

// Access environment variables
const apiUrl = ENV_CONFIG.apiUrl;
const environment = ENV_CONFIG.environment;
```

## Benefits of This Structure

1. **Modularity**: Each feature is self-contained and independent
2. **Maintainability**: Easy to locate code and understand feature boundaries
3. **Scalability**: Easy to add new features without affecting existing code
4. **Testability**: Feature boundaries make unit testing clearer
5. **Collaboration**: Team members can work on different features without conflicts
6. **Reusability**: Shared components and utilities avoid duplication
7. **Performance**: Code splitting and lazy loading can be optimized per feature

## Migration Status

✅ **Completed Migration**:
- All screens moved to feature directories
- All components moved to shared directory
- All contexts moved to shared directory
- All imports updated to use new paths
- TypeScript compilation passing

⚠️ **Cleanup Pending**:
- Remove old root-level screen files
- Remove old directory structure
- Update Expo Router configuration if needed

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Folder Structure](./FOLDER_STRUCTURE.md)
- [Environment Setup](./ENVIRONMENT_SETUP.md)
