# Admin Feature

Complete admin panel for NearHub platform with dashboard, listings, coupons, subscription management, spam detection, and more.

## Architecture

Following enterprise feature organization patterns, the admin feature uses:

### Structure

```
admin/
├── api/                      # API client and query configuration
│   └── index.ts             # All API methods and react-query key generation
├── hooks/                    # React-Query hooks for state management
│   └── index.ts             # useQuery and useMutation hooks
├── utils/                    # Utility functions
│   ├── formatters.ts        # Data formatting for display
│   ├── validators.ts        # Form validation and data validation
│   └── index.ts             # Barrel exports
├── components/               # UI components for views
│   ├── DashboardView.tsx
│   ├── ListingsView.tsx
│   ├── CouponsView.tsx
│   ├── SubscriptionPlansView.tsx
│   ├── SpamDetectionView.tsx
│   └── ...other views
├── types/                    # TypeScript type definitions
│   └── admin-types.ts
├── constants/                # Constants and helpers
│   └── admin-constants.ts
├── pages/                    # Page-level components
│   ├── Admin.tsx            # Main admin dashboard
│   └── AdminLogin.tsx       # Admin login page
├── index.ts                 # Feature barrel exports
└── README.md                # This file
```

## Core Concepts

### API Layer (`api/`)

Centralized API methods organized by resource type with react-query key generation:

```typescript
import { listingsApi, adminKeys } from '@/features/admin';

// Fetch listings
const listings = await listingsApi.getListings({ limit: 50, offset: 0 });

// Create listing
const newListing = await listingsApi.createListing(listingData);

// Query keys for caching
const listingQueryKey = adminKeys.listingsList({ limit: 50 });
```

**Available APIs:**

- `listingsApi` - Listing CRUD operations
- `couponsApi` - Coupon management
- `subscriptionTiersApi` - Tier management
- `spamDetectionApi` - Spam reports and moderation
- `revenueApi` - Revenue analytics
- `reportsApi` - Platform reports
- `usersApi` - User management

### Hooks Layer (`hooks/`)

React-Query hooks with automatic caching and synchronization:

```typescript
import { useCoupons, useCreateCoupon, useDeleteCoupon } from '@/features/admin'

export function CouponsView() {
  // Fetch with automatic caching (5min stale time, 10min cache)
  const { data, isLoading, error } = useCoupons()

  // Create with automatic cache invalidation
  const create = useCreateCoupon()
  const handleCreate = async (data) => {
    await create.mutateAsync(data)
  }

  // Delete with cascade invalidation
  const delete = useDeleteCoupon(couponId)
  await delete.mutateAsync()

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && data.coupons.map(...)}
    </div>
  )
}
```

**Available Hooks:**

- `useListings`, `useListingById`, `useCreateListing`, `useUpdateListing`, `useDeleteListing`
- `useCoupons`, `useCreateCoupon`, `useUpdateCoupon`, `useDeleteCoupon`
- `useSubscriptionTiers`, `useSubscriptionTierById`, `useCreateSubscriptionTier`, `useUpdateSubscriptionTier`, `useDeleteSubscriptionTier`
- `useSpamReports`, `useSpamTrends`, `useReviewSpamReport`
- `useRevenueStats`
- `useGrowthReport`, `usePerformanceReport`, `useTransactionReport`, `useModerationReport`
- `useUsers`, `useUserById`, `useSuspendUser`, `useUnsuspendUser`

### Utils Layer (`utils/`)

#### Formatters

```typescript
import { formatters } from '@/features/admin';

formatters.formatPrice(2500); // "₹2,500"
formatters.formatDate('2024-02-21'); // "21 Feb 2024"
formatters.formatCouponCode('save30'); // "SAVE30"
formatters.formatPercentage(0.15); // "15.0%"
formatters.getTierTypeLabel('image'); // "Image Listing"
```

#### Validators

```typescript
import { validators } from '@/features/admin';

// Validate individual fields
const error = validators.validateCouponCode('ABC123');
if (error) {
  console.error(error.message); // Validation error
}

// Validate entire forms
const errors = validators.validateCouponForm({
  code: 'SAVE30',
  discountPercentage: '30',
  maxUsageCount: '100',
  expiresAt: '2025-12-31T23:59:59Z',
});

if (errors.length > 0) {
  // Map to form errors
  const errorMap = errors.reduce(
    (acc, err) => ({
      ...acc,
      [err.field]: err.message,
    }),
    {}
  );
}
```

## Usage Examples

### Fetching Data with Hooks

```typescript
import {
  useCoupons,
  useSubscriptionTiers,
  useSpamReports
} from '@/features/admin'

export function AdminDashboard() {
  const { data: couponsData } = useCoupons()
  const { data: tiersData } = useSubscriptionTiers()
  const { data: spamData } = useSpamReports()

  const coupons = couponsData?.coupons || []
  const tiers = tiersData?.tiers || []
  const reports = spamData?.reports || []

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {/* Render based on data */}
    </div>
  )
}
```

### Creating with Mutations

```typescript
import { useCreateCoupon } from '@/features/admin'
import { validators } from '@/features/admin'

export function CreateCouponForm() {
  const create = useCreateCoupon()
  const [formData, setFormData] = useState({...})
  const [errors, setErrors] = useState({})

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate
    const validationErrors = validators.validateCouponForm(formData)
    if (validationErrors.length > 0) {
      setErrors(validationErrors.reduce((acc, err) => ({
        ...acc,
        [err.field]: err.message
      }), {}))
      return
    }

    // Submit
    try {
      await create.mutateAsync(formData)
      // Modal closes automatically after cache invalidation
    } catch (error) {
      setErrors({ submit: error.message })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={formData.code} />
      {errors.code && <span className="error">{errors.code}</span>}
      <button disabled={create.isPending}>
        {create.isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  )
}
```

### Formatting Display Data

```typescript
import { formatters } from '@/features/admin'

export function CouponRow({ coupon }) {
  return (
    <tr>
      <td>{formatters.formatCouponCode(coupon.code)}</td>
      <td>{formatters.formatPercentage(coupon.discountPercentage / 100)}</td>
      <td>{formatters.formatDate(coupon.expiresAt)}</td>
      <td>{formatters.formatNumber(coupon.usage)}/{coupon.maxUsage}</td>
      <td>
        <span className={`badge ${formatters.getStatusBadgeStyle(coupon.status).bg}`}>
          {coupon.status}
        </span>
      </td>
    </tr>
  )
}
```

## Query Key Strategy

React-Query uses a hierarchical query key system for cache management:

```typescript
adminKeys = {
  all: ['admin'], // "Root" key
  listings: () => [...adminKeys.all, 'listings'], // Resource
  listingsList: (params) => [...adminKeys.listings(), { params }], // Query variant
  listingDetail: (id) => [...adminKeys.listings(), id], // Detail scope
};
```

When mutations succeed, related caches are invalidated:

- Creating a listing invalidates all `listings` queries
- Deleting a listing invalidates all `listings` queries
- Updating a listing invalidates `listings` + `listingDetail(id)`

## Caching Strategy

All data follows this cache configuration:

```typescript
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes
```

Data is considered:

- **Fresh**: After fetch, until 5 minutes pass
- **Stale**: After 5 minutes, still in cache but can be refetched
- **Garbage collected**: After 10 minutes without use

Override per query if needed:

```typescript
useQuery({
  queryKey: adminKeys.coupons(),
  queryFn: couponsApi.getCoupons,
  staleTime: 0, // Always fetch fresh
  gcTime: 0, // Don't cache
});
```

## Type Safety

All components are fully typed:

```typescript
import type { Listing, Coupon, SubscriptionTier, User, ValidationError } from '@/features/admin';
```

## Adding New Features

To add a new admin resource (e.g., Categories):

### 1. Add API Methods (`api/index.ts`)

```typescript
export const categoriesApi = {
  async getCategories(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/admin/categories`);
    return handleResponse(response);
  },
  // ... other methods
};
```

### 2. Add Query Keys (`api/index.ts`)

```typescript
export const adminKeys = {
  // ... existing
  categories: () => [...adminKeys.all, 'categories'] as const,
  categoriesList: () => [...adminKeys.categories(), 'list'] as const,
};
```

### 3. Add Hooks (`hooks/index.ts`)

```typescript
export function useCategories() {
  return useQuery({
    queryKey: adminKeys.categoriesList(),
    queryFn: () => categoriesApi.getCategories(),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => categoriesApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminKeys.categories(),
      });
    },
  });
}
```

### 4. Export from Feature (`index.ts`)

```typescript
export { useCategories, useCreateCategory } from './hooks';
```

### 5. Use in Components

```typescript
import { useCategories, useCreateCategory } from '@/features/admin';

export function CategoriesView() {
  const { data } = useCategories();
  const create = useCreateCategory();
  // ...
}
```

## Best Practices

1. **Always use hooks**, never direct API calls in components
2. **Validate form data** before mutations using validators
3. **Format all display data** using formatters
4. **Handle loading states** with `isLoading` / `isPending`
5. **Show error messages** to users when mutations fail
6. **Disable form buttons** while mutations are in progress (`disabled={mutation.isPending}`)
7. **Leverage automatic cache invalidation** - don't manually refetch
8. **Use barrel imports** - `import { useListings } from '@/features/admin'`
9. **Type everything** - avoid `any` types, use explicit types or `unknown`
10. **Keep components simple** - delegate state management to hooks

## Error Handling

All API methods throw on non-OK responses:

```typescript
import { useCoupons } from '@/features/admin'

export function CouponsView() {
  const { data, error, isError } = useCoupons()

  if (isError) {
    return <ErrorBanner message={error?.message} />
  }

  // ...
}
```

Mutations handle errors via hook state:

```typescript
const create = useCreateCoupon();

try {
  await create.mutateAsync(data);
} catch (error) {
  // Error automatically available in network
  setFormErrors({ submit: error.message });
}
```

## Testing

Components using hooks are easily testable with mock data:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import CouponsView from './components/CouponsView'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false }
  }
})

test('renders coupons', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <CouponsView />
    </QueryClientProvider>
  )
  expect(screen.getByText(/Create New Coupon/i)).toBeInTheDocument()
})
```

## Related Features

- `@/features/auth` - Authentication context
- `@/features/listings` - Listing management (user-facing)
- `@/shared/contexts` - Global app contexts

---

**Last Updated:** February 2026  
**Maintained by:** NearHub Team
