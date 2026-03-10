# GitHub Copilot Project Guide - NearHub

**Last Updated:** March 2, 2026  
**Project:** NearHub - Local marketplace platform  
**Stack:** React Native (Expo), React (Vite), Node.js (Express), PostgreSQL

---

## Table of Contents
> Before implementing anything, follow `.github/COPILOT_STRICT_INDEX.md` for canonical file/route ownership and no-duplicate rules.

1. [Project Overview](#project-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Coding Standards](#coding-standards)
4. [Feature-Based Architecture](#feature-based-architecture)
5. [Adding New Features](#adding-new-features)
6. [Import Patterns](#import-patterns)
7. [Environment Configuration](#environment-configuration)
8. [Common Patterns](#common-patterns)
9. [Testing & Deployment](#testing--deployment)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

### What is NearHub?
A local marketplace mobile app (iOS/Android) with admin web portal for buying/selling items nearby. Features include:
- Location-based listing search
- Video shorts for listings
- Subscription-based pricing
- Coupon system
- Spam detection
- Real-time chat

### Tech Stack
```
Mobile:  Expo SDK 54, React Native 0.81, Expo Router v6
Web:     React 18, Vite 6, TailwindCSS, React Query v5
Server:  Express 5, TypeScript, PostgreSQL, Drizzle ORM
Storage: PostgreSQL, Redis, Elasticsearch
Payment: Razorpay
AI:      Google GenAI (Gemini)
```

### Workspace Layout
```
nearhub/
├── app/          → Mobile app (React Native + Expo)
├── web/          → Admin web portal (React + Vite)
├── server/       → Backend API (Express + TypeScript)
└── docs/         → Documentation
```

---

## Monorepo Structure

### 📱 Mobile App (`app/`)

```
app/
├── features/                    # Feature-based modules
│   ├── home/                   # Browse/search listings
│   ├── create/                 # Create new listing
│   ├── shorts/                 # Video feed
│   ├── saved/                  # Bookmarked listings
│   ├── invoices/               # Payment history
│   ├── auth/                   # Authentication
│   ├── chat/                   # Messaging
│   ├── listings/               # Listing details
│   ├── profile/                # User profile
│   ├── subscriptions/          # Subscription management
│   ├── settings/               # App settings
│   └── search/                 # Search results
│
├── shared/                      # Shared across features
│   ├── components/             # Reusable UI components (23 files)
│   │   ├── ListingCard.tsx
│   │   ├── AppHeader.tsx
│   │   ├── NotificationCenter.tsx
│   │   └── ...
│   ├── contexts/               # Global state (6 contexts)
│   │   ├── auth-context.tsx
│   │   ├── listings-context.tsx
│   │   ├── messages-context.tsx
│   │   ├── notifications-context.tsx
│   │   ├── search-history-context.tsx
│   │   └── user-interests-context.tsx
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # Shared TypeScript types
│   └── utils/                  # Utility functions
│
├── lib/                         # Core utilities (19 files)
│   ├── config.ts               # Environment configuration
│   ├── types.ts                # Core type definitions
│   ├── utils.ts                # General utilities
│   ├── location-data.ts        # Location services
│   ├── personalization.ts      # AI personalization
│   ├── query-client.ts         # React Query setup
│   └── ...
│
├── constants/                   # App constants
│   └── colors.ts
│
├── (tabs)/                      # Tab navigation (re-exports)
├── auth/, chat/, listing/       # Route wrappers (re-exports)
├── _layout.tsx                  # Root layout with providers
└── app.json                     # Expo configuration
```

### 🌐 Web Admin (`web/src/`)

```
web/src/
├── features/                    # Feature modules
│   ├── admin/                  # Admin dashboard (React Query architecture)
│   │   ├── api/                # API layer (8 resource modules)
│   │   │   └── index.ts        # Centralized fetch functions with auth
│   │   ├── hooks/               # React Query hooks layer
│   │   │   └── index.ts        # 40+ custom hooks (queries + mutations)
│   │   ├── components/         # 12 Admin view components
│   │   │   ├── DashboardView.tsx
│   │   │   ├── ListingsView.tsx
│   │   │   ├── UsersView.tsx
│   │   │   ├── RevenueView.tsx
│   │   │   ├── ReportsView.tsx
│   │   │   ├── CouponsView.tsx
│   │   │   ├── SubscriptionPlansView.tsx
│   │   │   ├── SpamDetectionView.tsx
│   │   │   ├── VideoManagementView.tsx
│   │   │   ├── SettingsView.tsx
│   │   │   ├── CreateListingModal.tsx
│   │   │   └── EditListingModal.tsx
│   │   ├── pages/              # Admin route pages
│   │   │   └── Admin.tsx       # Main admin layout
│   │   ├── utils/              # Formatters & validators
│   │   │   ├── formatters.ts   # Price/date formatting
│   │   │   ├── validators.ts   # Form validation
│   │   │   └── index.ts        # Barrel export
│   │   ├── types/              # TypeScript definitions
│   │   │   └── admin-types.ts  # Shared admin interfaces
│   │   ├── constants/          # Admin constants
│   │   │   └── admin-constants.ts
│   │   ├── services/           # Legacy service files
│   │   ├── README.md           # Admin feature documentation
│   │   └── index.ts            # Feature barrel export
│   ├── landing/                # Public landing page
│   └── shared/                 # Cross-feature shared code
│
├── shared/                      # Shared across all features
│   ├── components/             # Reusable UI components
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # Shared API services
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Utility functions
│   └── index.ts                # Barrel export
│
├── lib/                         # Core utilities
│   ├── config.ts               # Environment configuration
│   └── query-client.ts         # React Query setup (5min stale, 10min GC)
│
├── styles/                      # Styling files
├── assets/                      # Static assets
├── App.tsx                      # Root component with QueryClientProvider
├── index.css                    # Global styles (Tailwind)
└── main.tsx                     # Entry point
```

### 🔌 Server (`server/`)

```
server/
├── features/                    # Feature modules
│   ├── admin/                  # Admin operations
│   │   ├── routes/             # Admin routes
│   │   ├── services/           # Admin services
│   │   └── models/             # Admin database models
│   ├── auth/                   # Authentication
│   ├── listings/               # Listing CRUD
│   ├── subscriptions/          # Subscription logic
│   ├── payments/               # Payment processing
│   ├── search/                 # Search & geolocation
│   ├── coupons/                # Coupon system
│   ├── users/                  # User management
│   └── media/                  # Media upload/streaming
│
├── shared/                      # Shared services
│   ├── ai/                     # AI services (Google GenAI)
│   ├── cache/                  # Redis caching
│   ├── notifications/          # SMS (MSG91, BSNL)
│   └── utils/                  # Utility functions
│
├── data/                        # Database & data files
│   ├── db.ts                   # Drizzle connection
│   ├── pincodes.json           # Indian pincode database
│   └── seed-listings.json      # Sample data
│
├── lib/                         # Core utilities
│   └── config.ts               # Environment config
│
├── migrations/                  # Drizzle migrations
├── scripts/                     # Utility scripts
├── index.ts                     # Server entry point
└── routes.ts                    # Route registration
```

---

## Coding Standards

### TypeScript
- **Strict mode enabled** - All type safety checks on
- **Explicit types** - Prefer explicit over inferred types for function parameters/returns
- **No `any`** - Use `unknown` or proper types
- **Interface over Type** - Use `interface` for object shapes, `type` for unions/intersections

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User> {
  // ...
}

// ❌ Bad
function getUser(id: any) {
  // ...
}
```

### Naming Conventions

#### Files
- **Components:** PascalCase - `ListingCard.tsx`, `AppHeader.tsx`
- **Utilities:** kebab-case - `image-compressor.ts`, `location-data.ts`
- **Contexts:** kebab-case - `auth-context.tsx`, `listings-context.tsx`
- **Routes:** kebab-case - `subscriptions.ts`, `admin-settings.ts`

#### Code
- **Components:** PascalCase - `<ListingCard />`, `<AppHeader />`
- **Functions:** camelCase - `getUserData()`, `calculateDistance()`
- **Constants:** SCREAMING_SNAKE_CASE - `API_URL`, `MAX_RETRIES`
- **Context Hooks:** use prefix - `useAuth()`, `useListings()`

#### Imports
- **Absolute paths preferred** - Use `@/` alias
- **Barrel exports** - Use feature `index.ts` files

```typescript
// ✅ Good
import { useAuth } from '@/shared/contexts/auth-context';
import { ListingCard } from '@/shared/components/ListingCard';
import { HomeScreen } from '@/features/home';

// ❌ Bad
import { useAuth } from '../../../shared/contexts/auth-context';
import ListingCard from '../../components/ListingCard';
```

### Component Structure (React Native)

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/shared/contexts/auth-context';
import { ListingCard } from '@/shared/components/ListingCard';
import Colors from '@/constants/colors';

interface HomeScreenProps {
  // Props interface
}

export default function HomeScreen({ }: HomeScreenProps) {
  // 1. Hooks (context, state, effects)
  const { user } = useAuth();
  const [listings, setListings] = useState([]);

  useEffect(() => {
    // Side effects
  }, []);

  // 2. Event handlers
  const handlePress = () => {
    // Handler logic
  };

  // 3. Render helpers
  const renderItem = (item) => (
    <ListingCard listing={item} />
  );

  // 4. Main render
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      {/* Components */}
    </View>
  );
}

// 5. Styles at bottom
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
```

### Component Structure (React Web)

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AdminDashboardProps {
  // Props
}

export function AdminDashboard({ }: AdminDashboardProps) {
  // 1. Hooks
  const navigate = useNavigate();
  const [data, setData] = useState([]);

  useEffect(() => {
    // Effects
  }, []);

  // 2. Handlers
  const handleAction = () => {
    // Logic
  };

  // 3. Render
  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {/* Content */}
    </div>
  );
}
```

### Server Route/Service Structure

```typescript
import type { Express, Request, Response } from 'express';
import { db } from '../../data/db';
import { someService } from '../services/some-service';

export function registerFeatureRoutes(app: Express) {
  /**
   * GET /api/feature/endpoint
   * Description of what this endpoint does
   */
  app.get('/api/feature/endpoint', async (req: Request, res: Response) => {
    try {
      // 1. Validate input
      const { id } = req.params;
      
      // 2. Business logic
      const result = await someService.getData(id);
      
      // 3. Return response
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[Feature] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });
}
```

---

## Feature-Based Architecture

### Philosophy
- **Colocation** - Related code lives together
- **Self-contained** - Features are independent modules
- **Clear boundaries** - Features don't import from each other (use shared instead)
- **Scalability** - Easy to add/remove features

### Feature Structure

Each feature follows this pattern:

```
features/
└── feature-name/
    ├── screens/        # Screen components (mobile) or pages/ (web)
    ├── components/     # Feature-specific components
    ├── services/       # API calls & business logic
    ├── hooks/          # Custom hooks for this feature
    ├── models/         # Database models (server only)
    ├── routes/         # API routes (server only)
    └── index.ts        # Barrel export
```

### When to Create a New Feature

Create a new feature when:
- ✅ It represents a distinct domain/functionality
- ✅ It has 2+ screens/pages/routes
- ✅ It contains business logic worth isolating
- ✅ It could be developed/tested independently

Don't create a feature for:
- ❌ Single components (put in `shared/components`)
- ❌ Utility functions (put in `shared/utils`)
- ❌ Global state (put in `shared/contexts`)

### Feature Dependencies

```
Features → Shared ✅
Features → Lib ✅
Features → Constants ✅

Features → Features ❌  (Don't cross-import!)
Shared → Features ❌
Lib → Features ❌
```

**Wrong:**
```typescript
// ❌ In features/home/screens/Home.tsx
import { CreateListingForm } from '../../create/components/CreateListingForm';
```

**Right:**
```typescript
// ✅ Move CreateListingForm to shared if needed across features
import { CreateListingForm } from '@/shared/components/CreateListingForm';
```

---

## Adding New Features

### Mobile App (app/)

#### 1. Create Feature Structure
```bash
cd app/features
mkdir -p new-feature/{screens,components,services,hooks}
```

#### 2. Create Screen
```typescript
// app/features/new-feature/screens/NewFeatureScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/shared/contexts/auth-context';

export default function NewFeatureScreen() {
  const { user } = useAuth();
  
  return (
    <View style={styles.container}>
      <Text>New Feature</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

#### 3. Create Barrel Export
```typescript
// app/features/new-feature/index.ts
export { default as NewFeatureScreen } from './screens/NewFeatureScreen';
```

#### 4. Add Route (if needed)
```typescript
// app/new-feature.tsx (root level for Expo Router)
export { default } from '@/features/new-feature/screens/NewFeatureScreen';
```

#### 5. Update Navigation
```typescript
// app/_layout.tsx
<Stack.Screen
  name="new-feature"
  options={{
    headerShown: false,
    presentation: 'card',
  }}
/>
```

### Web Admin (web/src/)

#### 1. Create Feature Structure
```bash
cd web/src/features
mkdir -p new-feature/{pages,components,services,hooks}
```

#### 2. Create Page
```typescript
// web/src/features/new-feature/pages/NewFeature.tsx
import React from 'react';

export function NewFeature() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">New Feature</h1>
    </div>
  );
}
```

#### 3. Create Barrel Export
```typescript
// web/src/features/new-feature/index.ts
export * from './pages/NewFeature';
```

#### 4. Add Route
```typescript
// web/src/App.tsx
import { NewFeature } from './features/new-feature';

// In Routes
<Route path="/new-feature" element={<NewFeature />} />
```

### Server (server/)

#### 1. Create Feature Structure
```bash
cd server/features
mkdir -p new-feature/{routes,services,models}
```

#### 2. Create Service
```typescript
// server/features/new-feature/services/new-feature.ts
import { db } from '../../data/db';

export async function getFeatureData(id: string) {
  // Business logic
  return await db.query.someTable.findFirst({
    where: eq(someTable.id, id),
  });
}
```

#### 3. Create Routes
```typescript
// server/features/new-feature/routes/new-feature.ts
import type { Express, Request, Response } from 'express';
import { getFeatureData } from '../services/new-feature';

export function registerNewFeatureRoutes(app: Express) {
  app.get('/api/new-feature/:id', async (req, res) => {
    try {
      const data = await getFeatureData(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
}
```

#### 4. Create Barrel Export
```typescript
// server/features/new-feature/index.ts
export * from './routes/new-feature';
export * from './services/new-feature';
```

#### 5. Register Routes
```typescript
// server/routes.ts
import { registerNewFeatureRoutes } from './features/new-feature';

export async function registerRoutes(app: Express): Promise<Server> {
  // ... existing routes
  registerNewFeatureRoutes(app);
  // ...
}
```

---

## Import Patterns

### Path Aliases

All packages use `@/` for absolute imports:

```typescript
// Mobile (app/)
import { useAuth } from '@/shared/contexts/auth-context';
import { config } from '@/lib/config';
import Colors from '@/constants/colors';

// Web (web/src/)
import { AdminLogin } from '@/features/admin/pages/AdminLogin';
import { config } from '@/lib/config';

// Server (server/)
import { db } from '../../data/db';  // Use relative for data/lib
import { getAdminSettings } from '../../admin/services/admin-settings';
```

### Import Order (Standard)

```typescript
// 1. External dependencies
import React, { useState } from 'react';
import { View, Text } from 'react-native';

// 2. Shared contexts and hooks
import { useAuth } from '@/shared/contexts/auth-context';
import { useListings } from '@/shared/contexts/listings-context';

// 3. Shared components
import { ListingCard } from '@/shared/components/ListingCard';
import { AppHeader } from '@/shared/components/AppHeader';

// 4. Lib utilities
import { calculateDistance } from '@/lib/location-data';
import { getApiUrl } from '@/lib/query-client';
import type { Listing } from '@/lib/types';

// 5. Constants
import Colors from '@/constants/colors';

// 6. Local/relative imports (avoid if possible)
import { localHelper } from './utils';

// 7. Styles
import styles from './styles.css';
```

### Barrel Exports (index.ts)

Each feature should have an `index.ts`:

```typescript
// features/listings/index.ts

// Export screens/pages
export { default as ListingDetailScreen } from './screens/[id]';
export { default as MyListingsScreen } from './screens/my-listings';

// Export components (if any shared within app)
export * from './components/ListingForm';

// Export services (if used outside feature)
export * from './services/listings-api';

// Export types
export type * from './types';
```

---

## Environment Configuration

### Environment Files

Each package has its own `.env.local` file:

```
nearhub/
├── app/.env.local          # Mobile environment
├── web/.env.local          # Web environment
└── server/.env.local       # Server environment
```

### Mobile App (`app/.env.local`)

```bash
# Mobile uses EXPO_PUBLIC_ prefix
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_ENVIRONMENT=development
EXPO_PUBLIC_DOMAIN=localhost:5000
```

**Usage:**
```typescript
import { ENV_CONFIG } from '@/lib/config';

const apiUrl = ENV_CONFIG.apiUrl;  // Reads EXPO_PUBLIC_API_URL
```

### Web Admin (`web/.env.local`)

```bash
# Web uses VITE_ prefix
VITE_API_URL=http://localhost:5000
VITE_ENVIRONMENT=development
```

**Usage:**
```typescript
import { config } from '@/lib/config';

const apiUrl = config.apiUrl;  // Reads VITE_API_URL
```

### Server (`server/.env.local`)

```bash
# Server uses no prefix (direct access)
DATABASE_URL=postgresql://user:pass@localhost:5432/nearhub
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

# Payment
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx

# SMS
MSG91_AUTH_KEY=xxx
BSNL_AUTH_KEY=xxx

# AI
GOOGLE_GENAI_API_KEY=xxx

# Storage
UPLOAD_DIR=./uploads
```

**Usage:**
```typescript
import { SERVER_CONFIG } from './lib/config';

const dbUrl = SERVER_CONFIG.database.url;
const razorpayKey = SERVER_CONFIG.razorpay.keyId;
```

### Adding New Environment Variables

1. **Add to `.env.example`**
2. **Add to `.env.local`**
3. **Update config utility** (lib/config.ts)
4. **Document in ENVIRONMENT_SETUP.md**

---

## Common Patterns

### Context Pattern (Mobile)

```typescript
// shared/contexts/feature-context.tsx
import React, { createContext, useContext, useState } from 'react';

interface FeatureContextType {
  data: any[];
  addData: (item: any) => void;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<any[]>([]);

  const addData = (item: any) => {
    setData(prev => [...prev, item]);
  };

  return (
    <FeatureContext.Provider value={{ data, addData }}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeature() {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeature must be used within FeatureProvider');
  }
  return context;
}
```

### API Service Pattern (Mobile)

```typescript
// features/listings/services/listings-api.ts
import { getApiUrl } from '@/lib/query-client';

export async function fetchListings() {
  const response = await fetch(`${getApiUrl()}/api/listings`);
  if (!response.ok) {
    throw new Error('Failed to fetch listings');
  }
  return response.json();
}

export async function createListing(data: CreateListingData) {
  const response = await fetch(`${getApiUrl()}/api/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}
```

### React Query Pattern (Web Admin)

#### API Layer (`/features/admin/api/index.ts`)
```typescript
// Centralized API functions with auth headers
interface AuthHeaders {
  'Authorization': string;
  'Content-Type': string;
}

function getAuthHeaders(): AuthHeaders {
  return {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  };
}

export const api = {
  // Listings
  fetchListings: () => fetch('/api/admin/listings', { headers: getAuthHeaders() }).then(res => res.json()),
  fetchListingById: (id: string) => fetch(`/api/admin/listings/${id}`, { headers: getAuthHeaders() }).then(res => res.json()),
  createListing: (data: any) => fetch('/api/admin/listings', { 
    method: 'POST', 
    headers: getAuthHeaders(), 
    body: JSON.stringify(data)
  }).then(res => res.json()),
  
  // Coupons
  fetchCoupons: () => fetch('/api/admin/coupons', { headers: getAuthHeaders() }).then(res => res.json()),
  createCoupon: (data: any) => fetch('/api/admin/coupons', { 
    method: 'POST', 
    headers: getAuthHeaders(), 
    body: JSON.stringify(data)
  }).then(res => res.json()),
  
  // Users, Revenue, Reports, etc. (8 resource modules total)
};
```

#### Hooks Layer (`/features/admin/hooks/index.ts`)
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// Query hooks (data fetching)
export function useListings() {
  return useQuery({
    queryKey: ['admin', 'listings'],
    queryFn: api.fetchListings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useListingById(id: string) {
  return useQuery({
    queryKey: ['admin', 'listings', id],
    queryFn: () => api.fetchListingById(id),
    enabled: !!id,
  });
}

export function useCoupons() {
  return useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: api.fetchCoupons,
  });
}

// Mutation hooks (data modification)
export function useCreateListing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.createListing,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin', 'listings']);
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateListing(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['admin', 'listings']);
      queryClient.invalidateQueries(['admin', 'listings', id]);
    },
  });
}
```

#### Component Usage Pattern
```typescript
// features/admin/components/ListingsView.tsx
import { useListings, useCreateListing, useDeleteListing } from '../hooks';

export function ListingsView() {
  const { data: listings, isLoading, error } = useListings();
  const createListing = useCreateListing();
  const deleteListing = useDeleteListing();

  const handleCreate = async (formData: any) => {
    try {
      await createListing.mutateAsync(formData);
      // Success feedback
    } catch (error) {
      // Error handling
    }
  };

  const handleDelete = async (id: string) => {
    await deleteListing.mutateAsync(id);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {listings?.map(listing => (
        <ListingCard 
          key={listing.id} 
          listing={listing}
          onDelete={() => handleDelete(listing.id)}
        />
      ))}
    </div>
  );
}
```

#### Modal Components Pattern
```typescript
// features/admin/components/EditListingModal.tsx
import { useListingById, useUpdateListing } from '../hooks';

interface EditListingModalProps {
  listingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EditListingModal({ listingId, isOpen, onClose }: EditListingModalProps) {
  const { data: listing, isLoading } = useListingById(listingId);
  const updateListing = useUpdateListing();

  const handleSubmit = async (formData: any) => {
    await updateListing.mutateAsync({ id: listingId, data: formData });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <ListingForm 
          initialData={listing}
          onSubmit={handleSubmit}
          isSubmitting={updateListing.isLoading}
        />
      )}
    </Modal>
  );
}
```

### Protected Route Pattern (Web)

```typescript
// web/src/shared/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = checkAuth(); // Your auth check
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Usage in App.tsx
<Route
  path="/admin"
  element={
    <ProtectedRoute>
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

### Database Query Pattern (Server)

```typescript
// Using Drizzle ORM
import { db } from '../../data/db';
import { listings, users } from '../../admin/models/admin-settings';
import { eq, and, desc, gte } from 'drizzle-orm';

// Simple query
const listing = await db.query.listings.findFirst({
  where: eq(listings.id, listingId),
});

// Query with relations
const listingWithUser = await db.query.listings.findFirst({
  where: eq(listings.id, listingId),
  with: {
    seller: true,
  },
});

// Complex query
const activeListings = await db
  .select()
  .from(listings)
  .where(
    and(
      eq(listings.status, 'active'),
      gte(listings.expiryDate, new Date())
    )
  )
  .orderBy(desc(listings.createdAt));
```

### Server API Patterns

#### Listing Creation Endpoints

**⚠️ IMPORTANT:** NearHub has two listing creation endpoints with different purposes.

**1. Production Endpoint (Recommended):** `POST /api/subscriptions/create-listing`
```typescript
// Location: server/features/subscriptions/routes/subscriptions.ts
// Use this for production client applications

const response = await fetch(`${API_URL}/api/subscriptions/create-listing`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sellerId: 'user-123',
    title: 'iPhone 15 Pro',
    description: 'Brand new, sealed box',
    category: 'electronics',
    price: 120000,
    condition: 'new',
    location: 'Bangalore',
    images: ['base64...'],
    videos: ['base64...'],
    subscriptionTierId: 'tier-premium',  // Optional
    couponCode: 'SAVE20',                // Optional
    featured: true                        // Optional
  })
});

// Features:
// ✅ Validates subscription limits
// ✅ Supports coupon codes with free listings
// ✅ Enforces tier restrictions (video uploads, featured listings)
// ✅ Tracks usage and analytics
// ✅ Integrated with payment system
```

**2. Removed Endpoint:** `POST /api/listings`
```typescript
// ❌ REMOVED - Must not be reintroduced.
// Use: POST /api/subscriptions/create-listing
```

#### Date Serialization Pattern

**Critical:** Always convert Date objects to ISO strings in API responses.

```typescript
// ❌ WRONG - Date objects may fail JSON serialization
app.post('/api/listings', async (req, res) => {
  const listing = await createListing(req.body);
  
  return res.json({
    success: true,
    listing: {
      id: listing.id,
      createdAt: listing.createdAt,  // Date object - causes errors!
      expiresAt: listing.expiresAt,  // Date object - causes errors!
    }
  });
});

// ✅ CORRECT - Convert to ISO strings
app.post('/api/subscriptions/create-listing', async (req, res) => {
  const listing = await createListing(req.body);
  
  return res.json({
    success: true,
    listing: {
      id: listing.id,
      createdAt: listing.createdAt?.toISOString() || new Date().toISOString(),
      expiresAt: listing.expiresAt?.toISOString() || null,
    }
  });
});
```

**Why this matters:**
- Database returns Date objects
- Express `res.json()` may fail to serialize them properly
- Causes 500 errors **after** successful database operations
- Client receives error but data is already saved (confusing UX!)

#### Standard Response Patterns

```typescript
// Success response
res.json({
  success: true,
  data: { /* payload */ },
  message?: 'Optional success message'
});

// Error response
res.status(400).json({
  success: false,
  error: 'User-friendly error message',
  code?: 'ERROR_CODE',
  details?: { /* additional context */ }
});

// Paginated response
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

#### Avoiding Duplicate Endpoints

**Single Source of Truth:** Each API endpoint should exist in only one place.

```typescript
// ❌ BAD - Duplicate endpoints in multiple files
// File: features/subscriptions/routes/subscriptions.ts
app.get('/api/listings', async (req, res) => { /* ... */ });

// File: features/listings/routes/listings.ts  
app.get('/api/listings', async (req, res) => { /* ... */ });

// ✅ GOOD - One endpoint, document location
// File: features/listings/routes/listings.ts (ONLY)
app.get('/api/listings', async (req, res) => { /* ... */ });

// File: features/subscriptions/routes/subscriptions.ts
// Comment: GET /api/listings handled by listings feature
```

**Before creating a new endpoint:**
1. Search for existing endpoints: `grep -r "app.post('/api/endpoint" server/`
2. Check if similar functionality exists
3. Reuse or consolidate if possible

---

## Testing & Deployment

### Mobile App

```bash
# Type check
npm run type-check

# Run on Android
npm run android

# Run on iOS
npm run ios

# Build for Android (EAS)
eas build --platform android --local

# Build for iOS (EAS)
eas build --platform ios
```

### Web Admin

```bash
# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview

# Lint
npm run lint
```

### Server

```bash
# Development (tsx watch mode)
npm run dev

# Build
npm run build

# Production
npm start

# Database migrations
npm run db:push
npm run db:migrate
npm run db:studio  # Drizzle Studio

# Seed data
npm run seed
```

---

## Troubleshooting

### Common Issues

#### Import Errors
```
Error: Cannot find module '@/shared/contexts/auth-context'
```
**Fix:** Check `tsconfig.json` has correct path mapping:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

#### Build Errors (Mobile)
```
Error: Metro bundler failed
```
**Fix:**
```bash
npx expo start -c  # Clear cache
rm -rf node_modules/.cache
```

#### Server Not Starting
```
Error: Cannot connect to database
```
**Fix:** Check `.env.local` has correct `DATABASE_URL`

#### TypeScript Errors After Refactor
**Fix:**
```bash
# Clear TypeScript cache
rm -rf tsconfig.tsbuildinfo
rm -rf .tsbuildinfo

# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

---

## Key Files Reference

### Mobile App
- **Entry:** `app/index.js`
- **Root Layout:** `app/_layout.tsx` (providers)
- **Tab Layout:** `app/(tabs)/_layout.tsx`
- **Config:** `app/lib/config.ts`
- **Types:** `app/lib/types.ts`
- **Expo Config:** `app/app.json`

### Web Admin
- **Entry:** `web/src/main.tsx`
- **Root:** `web/src/App.tsx` (routes)
- **Config:** `web/src/lib/config.ts`
- **Vite Config:** `web/vite.config.ts`

### Server
- **Entry:** `server/index.ts`
- **Routes:** `server/routes.ts`
- **Database:** `server/data/db.ts`
- **Config:** `server/lib/config.ts`
- **Drizzle Config:** `server/drizzle.config.ts`

---

## Quick Commands

```bash
# Install all dependencies
cd app && npm install
cd ../web && npm install
cd ../server && npm install

# Start everything (3 terminals)
cd app && npm run dev         # Terminal 1 - Mobile
cd web && npm run dev         # Terminal 2 - Web
cd server && npm run dev      # Terminal 3 - Server

# Type check all
cd app && npm run type-check
cd web && npm run build  # Web has no separate type-check
cd server && npm run build

# Clean all
rm -rf app/node_modules app/.expo
rm -rf web/node_modules web/dist
rm -rf server/node_modules server/dist
```

---

## Documentation Files

- **Main Docs:** `/docs/`
  - `ARCHITECTURE.md` - System architecture overview
  - `FOLDER_STRUCTURE.md` - Detailed folder structure
  - `ENVIRONMENT_SETUP.md` - Environment configuration guide
  - `MOBILE_APP_FOLDER_STRUCTURE.md` - Mobile app structure
  - `DEPLOYMENT_GUIDE.md` - Deployment instructions

- **Root:**
  - `FINAL_CLEANUP_REPORT.md` - Recent cleanup summary
  - `REORGANIZATION_COMPLETE.md` - Restructuring details
  - `INDEPENDENT_MONOREPO.md` - Independent package guide

---

## Contributing Guidelines

When adding new code:

1. ✅ Follow feature-based structure
2. ✅ Use TypeScript with strict types
3. ✅ Add to appropriate feature or shared
4. ✅ Use absolute imports (`@/`)
5. ✅ Create barrel exports (`index.ts`)
6. ✅ Document environment variables
7. ✅ Run type-check before committing
8. ✅ Keep features independent

When modifying existing code:

1. ✅ Maintain existing patterns
2. ✅ Update types if changing interfaces
3. ✅ Check for breaking changes
4. ✅ Test in all affected packages
5. ✅ Update documentation if needed

---

**For Questions:** Check `/docs/` or search existing code for similar patterns.

**Last Updated:** February 21, 2026
