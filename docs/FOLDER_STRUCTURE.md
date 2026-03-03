# NearHub - Feature-Based Architecture

This document describes the reorganized, feature-based folder structure for better maintainability and scalability.

## Principles

1. **Feature-based organization** - Code is grouped by feature/domain, not by file type
2. **Self-contained features** - Each feature should be as independent as possible
3. **Shared services** - Common functionality is in `/shared` directories
4. **Clear imports** - Each feature should have an `index.ts` for clean exports
5. **Easier refactoring** - Changing a feature only affects that feature's directory

## Web Portal (Admin Panel)

```
web/src/
├── features/                          # Feature modules
│   ├── admin/                         # Admin Dashboard
│   │   ├── components/                # Admin-specific components
│   │   ├── pages/
│   │   │   ├── Admin.tsx             # Main dashboard
│   │   │   └── AdminLogin.tsx        # Login page
│   │   ├── services/                  # API calls specific to admin
│   │   ├── hooks/                     # Custom hooks for admin
│   │   └── index.ts                   # Barrel export
│   │
│   ├── auth/                          # Authentication feature
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── hooks/
│   │
│   ├── listings/                      # Listing Management
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── hooks/
│   │
│   ├── coupons/                       # Coupon Management
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── hooks/
│   │
│   ├── users/                         # User Management
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── hooks/
│   │
│   ├── analytics/                     # Analytics & Reporting
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── hooks/
│   │
│   ├── landing/                       # Landing page
│   │   ├── components/
│   │   ├── pages/
│   │   │   └── Landing.tsx
│   │   └── services/
│   │
│   └── shared/                        # Shared between features
│       ├── components/
│       ├── hooks/
│       └── services/
│
├── shared/                            # Global shared code
│   ├── components/                    # Global components (ProtectedRoute, etc)
│   ├── hooks/                         # Global hooks
│   ├── services/                      # Global API services
│   ├── types/                         # TypeScript types
│   └── utils/                         # Utility functions
│
├── styles/                            # Global and shared styles
├── assets/                            # Images, fonts, etc
├── lib/                               # Library utilities
├── App.tsx                            # Root component
├── App.css
└── main.tsx                           # Entry point
```

## Backend Server

```
server/
├── features/                          # Feature modules
│   ├── admin/                         # Admin functionality
│   │   ├── routes/
│   │   │   ├── admin-auth.ts         # Admin authentication routes
│   │   │   ├── admin-settings.ts     # Settings management
│   │   │   └── admin.ts              # Admin dashboard routes
│   │   ├── services/
│   │   │   ├── admin-auth.ts         # Auth logic
│   │   │   └── admin-settings.ts     # Settings logic
│   │   ├── models/
│   │   │   └── admin-settings.ts     # Database schema
│   │   └── index.ts                  # Barrel export
│   │
│   ├── auth/                          # User authentication
│   │   ├── routes/
│   │   │   └── auth.ts               # Auth endpoints
│   │   ├── services/
│   │   └── models/
│   │
│   ├── listings/                      # Listing management
│   │   ├── routes/
│   │   │   ├── listings.ts           # CRUD endpoints
│   │   │   └── listing-expiration.ts # Expiration logic
│   │   ├── services/
│   │   │   ├── listings.ts
│   │   │   └── listings-storage.ts
│   │   ├── models/
│   │   └── index.ts
│   │
│   ├── subscriptions/                 # Subscription management
│   │   ├── routes/
│   │   │   ├── subscriptions.ts
│   │   │   └── subscription-admin.ts
│   │   ├── services/
│   │   │   ├── subscription.ts
│   │   │   ├── subscription-plans.ts
│   │   │   ├── subscription-tiers.ts
│   │   │   └── pricing.ts
│   │   ├── models/
│   │   │   └── subscription.ts
│   │   └── index.ts
│   │
│   ├── payments/                      # Payment processing
│   │   ├── routes/
│   │   │   └── dynamic-pricing.ts
│   │   ├── services/
│   │   │   ├── razorpay.ts           # Razorpay integration
│   │   │   └── dynamic-pricing.ts    # Pricing logic
│   │   └── index.ts
│   │
│   ├── search/                        # Search & geo-search
│   │   ├── routes/
│   │   │   ├── search.ts
│   │   │   └── geo-search.ts
│   │   ├── services/
│   │   │   ├── elasticsearch.ts      # Full-text search
│   │   │   ├── geo-search.ts
│   │   ├── geolocation.ts
│   │   │   └── location.ts
│   │   └── index.ts
│   │
│   ├── coupons/                       # Coupon management
│   │   ├── routes/
│   │   │   └── coupons.ts
│   │   ├── services/
│   │   │   └── coupons.ts
│   │   ├── models/
│   │   └── index.ts
│   │
│   ├── users/                         # User management
│   │   ├── routes/
│   │   │   ├── users.ts              # User endpoints
│   │   │   └── invoices.ts           # Invoice endpoints
│   │   ├── services/
│   │   │   ├── spam-detector.ts      # Spam detection
│   │   │   └── invoice.ts            # Invoice generation
│   │   ├── models/
│   │   │   └── users.ts
│   │   └── index.ts
│   │
│   ├── media/                         # Media & uploads
│   │   ├── routes/
│   │   │   ├── video-upload.ts
│   │   │   └── media-cleanup.ts
│   │   ├── services/
│   │   │   ├── video-upload.ts
│   │   │   ├── video-streaming.ts
│   │   │   └── media-cleanup.ts
│   │   └── index.ts
│   │
│   └── shared/                        # Shared between features
│       └── routes/
│           └── ai.ts                 # AI-related endpoints
│
├── shared/                            # Global shared services
│   ├── cache/                         # Caching (Redis, DB cache)
│   │   ├── redis-cache.ts
│   │   ├── db-cache.ts
│   │   ├── cache-middleware.ts
│   │   └── cache-invalidation.ts
│   │
│   ├── notifications/                 # SMS & Email notifications
│   │   ├── msg91.ts                  # MSG91 SMS gateway
│   │   ├── bsnl-dlt.ts               # BSNL DLT SMS
│   │   └── email.ts                  # Email service (when added)
│   │
│   ├── ai/                            # AI services
│   │   └── ai.ts                     # Google GenAI integration
│   │
│   ├── geo/                           # Geolocation utilities
│   │   └── geolocation.ts
│   │
│   ├── utils/                         # General utilities
│   │   ├── otp.ts                    # OTP generation
│   │   └── chat.ts                   # Chat utilities
│   │
│   ├── types/                         # Shared TypeScript types
│   │   └── index.ts
│   │
│   └── elasticsearch-hooks.ts         # Elasticsearch hooks
│
├── models/                            # Global data models
│   └── admin-settings.ts              # Keep only truly global models
│
├── data/                              # Database layer
│   ├── db.ts                          # Database connection
│   └── migrations/                    # Database migrations
│
├── config/                            # Configuration
│   └── config.ts                      # Server configuration (moved from lib)
│
├── lib/                               # Library utilities
│   └── (other utilities)
│
├── migrations/                        # Drizzle migrations
├── templates/                         # Email/SMS templates
├── scripts/                           # Utility scripts
├── index.ts                           # Main server file
├── routes.ts                          # Route registration
└── storage.ts                         # Storage interface
```

## Import Examples

### Web Portal

**Before (flat structure):**
```typescript
import Admin from '../pages/Admin';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { fetchListings } from '../services/listings';
```

**After (feature-based):**
```typescript
// From features
import { Admin, AdminLogin } from '../features/admin';
import { ProtectedRoute } from '../features/shared';

// Or more specific
import Admin from '../features/admin/pages/Admin';
import { fetchListings } from '../features/listings/services';
```

### Backend Server

**Before (flat structure):**
```typescript
import { adminAuthRoutes } from './routes/admin-auth';
import { subscriptionsService } from './services/subscription';
import { razorpayService } from './services/razorpay';
```

**After (feature-based):**
```typescript
// Via barrel exports
import { adminAuthRoutes } from './features/admin';
import { subscriptionsService } from './features/subscriptions';
import { razorpayService } from './features/payments';

// Or more specific
import { subscriptionsService } from './features/subscriptions/services/subscription';
```

## Migration Guide

### For Developers

1. **Feature-specific code** always goes in `features/{featureName}/`
2. **Shared code** goes in the appropriate `shared/` subdirectory
3. **Always use barrel exports** (`index.ts`) for cleaner imports
4. **Keep features decoupled** - minimize cross-feature dependencies
5. **Use TypeScript paths** in `tsconfig.json` for cleaner imports:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@server/features/*": ["features/*"],
      "@server/shared/*": ["shared/*"]
    }
  }
}
```

### Adding a New Feature

1. Create the feature directory: `features/{featureName}/`
2. Create subdirectories: `components/`, `pages/`, `services/`, `hooks/`
3. Create `index.ts` with barrel exports
4. Import from other features using the barrel exports

Example:
```typescript
// features/myfeature/index.ts
export * from './pages';
export * from './services';
export * from './components';

// In App.tsx
import { MyFeaturePage, myFeatureService } from '@features/myfeature';
```

## FAQ

**Q: Where should I put a utility that's used by multiple features?**
A: Put it in `shared/utils/` for web or `shared/utils/` for server.

**Q: What if a service is used by multiple features?**
A: If it's domain-specific, put it in one feature and export it. If it's truly shared, move it to `shared/`.

**Q: How do I structure the models?**
A: Data models specific to a feature go in `features/{featureName}/models/`. Only truly global models go in `models/`.

**Q: Why separate `components/`, `pages/`, and `services/`?**
A: This makes it clear what each file does and helps with tree-shaking and code splitting.

## Benefits

✅ **Better organization** - Related code is together  
✅ **Easier refactoring** - Change a feature without affecting others  
✅ **Scalability** - Adding new features is straightforward  
✅ **Testability** - Features can be tested independently  
✅ **Team collaboration** - Teams can work on separate features without conflicts  
✅ **Code discovery** - Easy to understand what code handles what feature  

## See Also

- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - System-level architecture
- [ENVIRONMENT_SETUP.md](../ENVIRONMENT_SETUP.md) - Environment configuration
