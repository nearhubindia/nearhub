# GitHub Copilot Instructions - NearHub

**Project:** NearHub - Local marketplace platform
**Architecture:** Feature-based monorepo (app, web, server)
**Stack:** React Native (Expo), React (Vite), Express, PostgreSQL

---

## Critical Rules

### 0. Mandatory Strict Index
- **Before creating any file/route**, follow `.github/COPILOT_STRICT_INDEX.md`
- Treat it as canonical ownership + anti-duplication policy
- Prefer **edit existing file** over creating sibling/parallel files
- For server routes, never add an endpoint without checking method+path uniqueness

### 1. Feature-Based Structure
- **All new code** goes in `features/` or `shared/`, never in root directories
- Each feature has: `screens/` (or `pages/`), `components/`, `services/`, `hooks/`
- **Never import between features** - use `shared/` for cross-feature code

### 2. Import Paths
- **Always use absolute paths** with `@/` alias
- Example: `import { useAuth } from '@/shared/contexts/auth-context';`
- **Never use relative paths** like `../../shared/contexts/auth-context`

### 3. TypeScript Strict Mode
- **No `any` types** - use `unknown` or explicit types
- **Explicit function return types** for all functions
- **Interface for objects**, `type` for unions/intersections
- **Use shared types** from `@/lib/types` for common patterns (AuthRequest, ApiResponse, etc.)

### 4. File Naming
- **Components:** PascalCase - `ListingCard.tsx`, `AppHeader.tsx`
- **Utilities/Services:** kebab-case - `image-compressor.ts`, `auth-context.tsx`
- **Screens/Pages:** PascalCase - `HomeScreen.tsx`, `AdminDashboard.tsx`

### 5. Error Handling
- **Use shared error utilities** from `@/lib/error-handler`
- Example: `handleError(res, error, '[Feature]', 'Default message')`
- **Available utilities:**
  - `handleError()` - Standard error response
  - `notFound()` - 404 responses
  - `unauthorized()` - 401 responses
  - `forbidden()` - 403 responses
  - `validationError()` - 400 responses
  - `asyncHandler()` - Async wrapper to eliminate try-catch
- **Never duplicate** error handling patterns

### 6. Working Directories (CRITICAL)
**ALWAYS run commands from the correct directory:**

- **Mobile App commands:** `/home/pavanprasad/Downloads/nearhub/app`
  ```bash
  cd /home/pavanprasad/Downloads/nearhub/app && npx expo run:android
  cd /home/pavanprasad/Downloads/nearhub/app && npm run type-check
  cd /home/pavanprasad/Downloads/nearhub/app && npx expo prebuild
  ```

- **Web commands:** `/home/pavanprasad/Downloads/nearhub/web`
  ```bash
  cd /home/pavanprasad/Downloads/nearhub/web && npm run dev
  cd /home/pavanprasad/Downloads/nearhub/web && npm run build
  ```

- **Server commands:** `/home/pavanprasad/Downloads/nearhub/server`
  ```bash
  cd /home/pavanprasad/Downloads/nearhub/server && npm run dev
  cd /home/pavanprasad/Downloads/nearhub/server && npm run seed:users
  cd /home/pavanprasad/Downloads/nearhub/server && npm run migrate
  ```

**⚠️ NEVER run `npx expo` commands from `/home/pavanprasad/Downloads/nearhub`**
**✅ ALWAYS include `cd /home/pavanprasad/Downloads/nearhub/app &&` prefix for Expo commands**

### 7. Package-Specific Patterns

#### Mobile App (`app/`)
```typescript
// Component structure
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/shared/contexts/auth-context';

export default function FeatureScreen() {
  const { user } = useAuth();
  
  return (
    <View style={styles.container}>
      <Text>Content</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

#### Web (`web/src/`)
```typescript
// Component structure
import { useState } from 'react';

export function FeaturePage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">Title</h1>
    </div>
  );
}
```

#### Server (`server/`)
```typescript
// Route structure with shared utilities
import type { Express, Response } from 'express';
import type { AuthRequest } from '@/lib/types';
import { handleError, notFound } from '@/lib/error-handler';

export function registerFeatureRoutes(app: Express) {
  app.get('/api/feature/:id', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId; // Type-safe with AuthRequest
      const result = await getFeature(req.params.id);
      
      if (!result) {
        return notFound(res, 'Feature');
      }
      
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error, '[Feature]', 'Failed to fetch feature');
    }
  });
}
```

### 8. Environment Variables
- **Mobile:** `EXPO_PUBLIC_` prefix (e.g., `EXPO_PUBLIC_API_URL`)
- **Web:** `VITE_` prefix (e.g., `VITE_API_URL`)
- **Server:** No prefix (e.g., `DATABASE_URL`)

### 9. Shared Utilities (Server)
- **Config:** Use `@/lib/config` for SERVER_CONFIG (never duplicate)
- **Types:** Use `@/lib/types` for AuthRequest, ApiResponse, PaginatedResponse
- **Error Handler:** Use `@/lib/error-handler` for consistent error responses
- **Env Loader:** Use `@/lib/load-env` in scripts (never duplicate env loading logic)
- **Location:** All utilities live in `server/lib/`
- **Never create duplicate utility functions** - check lib/ first

### 10. Adding New Features

#### Mobile
1. Create `features/new-feature/screens/NewFeatureScreen.tsx`
2. Create `features/new-feature/index.ts` (barrel export)
3. Create `app/new-feature.tsx` (route wrapper re-export)
4. Update `app/_layout.tsx` if needed

#### Web
1. Create `features/new-feature/pages/NewFeature.tsx`
2. Create `features/new-feature/index.ts` (barrel export)
3. Add route in `App.tsx`

#### Server
1. Create `features/new-feature/routes/feature-name.ts`
2. Create `features/new-feature/services/feature-name.ts`
3. Create `features/new-feature/index.ts` (barrel export)
4. Register in `routes.ts`

### 11. Import Order
```typescript
// 1. External libraries
import React, { useState } from 'react';
import { View } from 'react-native';

// 2. Shared contexts/hooks
import { useAuth } from '@/shared/contexts/auth-context';

// 3. Shared components
import { ListingCard } from '@/shared/components/ListingCard';

// 4. Lib/utils
import { config } from '@/lib/config';
import type { Listing } from '@/lib/types';

// 5. Constants
import Colors from '@/constants/colors';

// 6. Local (rarely used)
import { Helper } from './helper';
```

### 12. Key Context Locations
- **Auth:** `@/shared/contexts/auth-context`
- **Listings:** `@/shared/contexts/listings-context`
- **Messages:** `@/shared/contexts/messages-context`
- **Notifications:** `@/shared/contexts/notifications-context`
- **Search History:** `@/shared/contexts/search-history-context`
- **User Interests:** `@/shared/contexts/user-interests-context`
- **Query Client:** `@/lib/query-client` (React Query with 5min stale, 10min GC)

### 13. Admin Feature Architecture (React Query Pattern)
- **API Layer:** `/features/admin/api/index.ts` - 8 resource modules with fetch + auth
- **Hooks Layer:** `/features/admin/hooks/index.ts` - 40+ React Query hooks
- **Components:** 12 refactored components using hooks (no inline fetch)
- **Utils:** `formatters.ts` (prices, dates) + `validators.ts` (forms)
- **Types:** `admin-types.ts` - Shared interfaces

**Hook Pattern:**
```typescript
// Query hooks
const { data, isLoading, error } = useListings();
const { data: userById } = useUserById(id);

// Mutation hooks
const createListing = useCreateListing();
const updateUser = useUpdateUser();

// Usage in component
const handleCreate = async () => {
  await createListing.mutateAsync(payload);
};
```

### 14. Common Shared Components (Mobile)
- `ListingCard`, `ShortsCard`, `CategoryPill`
- `AppHeader`, `NotificationBell`, `NotificationCenter`
- `MediaCarousel`, `PhotoSlideshow`, `VideoRecorderModal`
- `RichTextEditor`, `PaymentHandler`, `UploadProgressBar`
- `UserProfileHeader`, `ProfileMenuModal`, `ReportUserModal`

### 15. Web Admin Components (React Query)
- **Views:** `DashboardView`, `ListingsView`, `UsersView`, `RevenueView`
- **Modals:** `CreateListingModal`, `EditListingModal` (hook-based, minimal props)
- **Management:** `CouponsView`, `SubscriptionPlansView`, `SpamDetectionView`
- **Analytics:** `ReportsView`, `VideoManagementView`, `SettingsView`

### 16. API Endpoint Architecture (Server)

#### Listing Creation Endpoints
**⚠️ IMPORTANT: Use the correct endpoint for creating listings**

1. **`POST /api/subscriptions/create-listing`** ✅ **RECOMMENDED**
   - **Location:** `server/features/subscriptions/routes/subscriptions.ts`
   - **Purpose:** Production listing creation with full business logic
   - **Features:**
     - ✅ Subscription limit validation
     - ✅ Coupon code support with free listings
     - ✅ Tier-based restrictions (video uploads, featured listings)
     - ✅ Usage tracking and analytics
     - ✅ Payment integration
   - **Used by:** Mobile app, Web app (production)
   - **Body params:** `sellerId, title, description, category, price, condition, location, images?, videos?, subscriptionTierId?, couponCode?, featured?`

2. **`POST /api/listings`** ❌ **REMOVED**
   - This endpoint must not be reintroduced.
   - Use `POST /api/subscriptions/create-listing` for listing creation.

#### Listing Read Endpoints (Consolidated)
**Single source of truth:** All in `server/features/listings/routes/listings.ts`

- `GET /api/listings` - Get listings with pagination, filters, geo-search
- `GET /api/listings/:id` - Get single listing by ID
- `GET /api/listings/category/:category` - Get by category
- `GET /api/listings/:id/analytics` - Get listing analytics
- `POST /api/listings/:id/view` - Track listing view

**Note:** Duplicate endpoints previously in `subscriptions.ts` have been removed to maintain single source of truth.

### 17. Date Serialization (Server)

**CRITICAL:** Always convert Date objects to ISO strings in API responses to prevent JSON serialization errors.

#### Problem
```typescript
// ❌ BAD - Date objects may fail JSON serialization
return res.json({
  listing: {
    createdAt: listing.createdAt,  // Date object
    expiresAt: listing.expiresAt,  // Date object
  }
});
```

#### Solution
```typescript
// ✅ GOOD - Convert to ISO strings
return res.json({
  listing: {
    createdAt: listing.createdAt?.toISOString() || new Date().toISOString(),
    expiresAt: listing.expiresAt?.toISOString() || null,
  }
});
```

#### Why This Matters
- Database returns Date objects
- Express `res.json()` may fail to serialize them properly
- Causes 500 errors AFTER successful database operations
- Results in data saved but error response sent to client

#### Best Practice
- **Always** use `.toISOString()` for Date fields in responses
- Use `|| null` for optional dates
- Use `|| new Date().toISOString()` for required dates with fallback

### 18. API Response Patterns

#### Standard Success Response
```typescript
res.json({
  success: true,
  data: { /* payload */ },
  message?: 'Optional success message'
});
```

#### Standard Error Response
```typescript
res.status(400).json({
  success: false,
  error: 'User-friendly error message',
  code?: 'ERROR_CODE',  // Optional error code
  details?: {}  // Optional additional context
});
```

#### Paginated Response
```typescript
res.json({
  success: true,
  data: items,
  pagination: {
    limit: 50,
    offset: 0,
    total: 250
  }
});
```

---

## Quick Reference

**Full Guide:** See `.github/COPILOT_GUIDE.md` for comprehensive documentation

**Structure:**
- `features/` - Domain features (independent modules)
- `shared/` - Cross-feature reusable code
- `lib/` - Core utilities and configuration
- `constants/` - App constants

**Never do:**
- ❌ Import from one feature to another
- ❌ Use relative imports for shared/lib
- ❌ Use `any` types
- ❌ Create files outside feature/shared structure
- ❌ Mix kebab-case and PascalCase incorrectly
- ❌ Run expo commands from root directory
- ❌ Reintroduce `POST /api/listings` (removed endpoint)
- ❌ Return raw Date objects in API responses (use `.toISOString()`)
- ❌ Duplicate API endpoints across features (maintain single source of truth)

**Always do:**
- ✅ Use absolute imports with `@/`
- ✅ Put shared code in `shared/`
- ✅ Follow TypeScript strict mode
- ✅ Create barrel exports (`index.ts`)
- ✅ Type every function parameter and return
- ✅ Run commands from correct directory (see section 6)
- ✅ Use `POST /api/subscriptions/create-listing` for listing creation (with subscription validation)
- ✅ Convert Date objects to ISO strings in API responses
- ✅ Check for existing endpoints before creating new ones
- ✅ Follow `.github/COPILOT_STRICT_INDEX.md` before creating files/routes
