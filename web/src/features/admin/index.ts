import { lazy } from 'react';

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
export const AdminDashboard = lazy(() => import('./pages/Admin'));
export const AdminLogin = lazy(() => import('./pages/AdminLogin'));
export const AdminLayout = lazy(() => import('./pages/AdminLayout'));
export const DashboardPage = lazy(() => import('./pages/DashboardPage'));
export const ListingsPage = lazy(() => import('./pages/ListingsPage'));
export const PendingListingsPage = lazy(() => import('./pages/PendingListingsPage'));
export const UsersPage = lazy(() => import('./pages/UsersPage'));
export const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));
export const SpamDetectionPage = lazy(() => import('./pages/SpamDetectionPage'));
export const CouponsPage = lazy(() => import('./pages/CouponsPage'));
export const BannersPage = lazy(() => import('./pages/BannersPage'));
export const InAppNotificationsPage = lazy(() => import('./pages/InAppNotificationsPage'));
export const RevenuePage = lazy(() => import('./pages/RevenuePage'));
export const ReportsPage = lazy(() => import('./pages/ReportsPage'));
export const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
export const SettingsPage = lazy(() => import('./pages/SettingsPage'));
export const MasterDataManagementPage = lazy(() => import('./pages/MasterDataManagementPage'));
export const ContactSubmissionsPage = lazy(() => import('./pages/ContactSubmissionsPage'));
export const ErrorLogsPage = lazy(() => import('./pages/ErrorLogsPage'));

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

export {
  ADMIN_CATEGORY_GROUPS,
  getAttributeKey,
  getDefaultAdminMainCategory,
  getDefaultAdminSubCategory,
  getMainCategoryForSubCategory,
  getSubCategoriesForMainCategory,
  shouldRequireConditionForCategory,
} from './constants/listing-taxonomy';
export type { AdminCategoryGroup, ListingAttributeDefinition } from './constants/listing-taxonomy';
export { useListingTaxonomy } from './hooks/useListingTaxonomy';
