/**
 * Admin Feature - Barrel Exports
 * Central entry point for all admin feature exports
 *
 * Usage:
 * import { useListings, adminKeys } from '@/features/admin'
 * import { formatters, validators } from '@/features/admin'
 * import { AdminDashboard } from '@/features/admin'
 */

// Pages
export { default as AdminDashboard } from './pages/Admin';
export { default as AdminLogin } from './pages/AdminLogin';

// API Layer
export {
  adminKeys,
  listingsApi,
  couponsApi,
  subscriptionTiersApi,
  spamDetectionApi,
  revenueApi,
  reportsApi,
  usersApi,
  bannersApi,
} from './api';

// React-Query Hooks
export {
  useListings,
  useListingById,
  useCreateListing,
  useUpdateListing,
  useDeleteListing,
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  useSubscriptionTiers,
  useSubscriptionTierById,
  useCreateSubscriptionTier,
  useUpdateSubscriptionTier,
  useDeleteSubscriptionTier,
  useSpamReports,
  useSpamTrends,
  useReviewSpamReport,
  useRevenueStats,
  useGrowthReport,
  useRecentActivity,
  usePerformanceReport,
  useTransactionReport,
  useModerationReport,
  useUsers,
  useUserById,
  useSuspendUser,
  useUnsuspendUser,
  useBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
} from './hooks';

// Types
export type {
  Stat,
  Listing,
  EditingListing,
  Folder,
  User,
  Enhancements,
  AppScreenBanner,
  BannerPayload,
} from './types/admin-types';

// Utils
export { formatters, validators } from './utils';
export type { ValidationError } from './utils';

// Constants
export {
  folderStructure,
  sampleUsers,
  getApiUrl,
  getAdminToken,
  chartData,
  categoryData,
  COLORS,
} from './constants/admin-constants';
