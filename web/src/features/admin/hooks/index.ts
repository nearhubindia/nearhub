/**
 * Admin Feature React-Query Hooks
 * Custom hooks using React-Query for state management and caching
 *
 * Pattern: Each hook wraps API methods with optimal caching configuration
 * - useQuery for fetching data
 * - useMutation for creating/updating/deleting data
 * - Automatic cache invalidation on mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminKeys,
  listingsApi,
  couponsApi,
  subscriptionTiersApi,
  spamDetectionApi,
  videosApi,
  revenueApi,
  reportsApi,
  usersApi,
  bannersApi,
  contactSubmissionsApi,
  errorLogsApi,
  type ContactSubmission,
  type ErrorLog,
} from '../api';
import type { BannerPayload, Listing } from '../types/admin-types';

interface ListingsQueryData {
  data?: Listing[];
  listings?: Listing[];
}

interface CouponData {
  id: string;
  code: string;
  discountPercentage: number;
  maxUsageCount: number;
  usageCount?: number;
  expiresAt?: string;
  isActive: boolean;
}

interface CouponsQueryData {
  coupons?: CouponData[];
}

interface SubscriptionTierData {
  id: string;
  name: string;
  type?: 'bundle' | 'boost' | string;
  description?: string;
  price: number;
  offerPrice?: number | null;
  durationDays: number;
  features: string[] | string;
  maxListings: number;
  featuredListingsPerMonth: number;
  boostCredits?: number;
  highlight: boolean;
  isActive: boolean;
}

interface SubscriptionTiersQueryData {
  tiers?: SubscriptionTierData[];
}

interface SpamReportData {
  id?: string;
  reason?: string;
  reportedUserId?: string;
  count?: number;
  timestamp?: string;
}

interface SpamReportsQueryData {
  reports?: SpamReportData[];
}

interface SpamTrendsQueryData {
  trends?: SpamReportData[];
}

interface VideoData {
  id: string;
  title: string;
  userId?: string;
  durationDays?: number;
  isActive: boolean;
  createdAt?: string;
}

interface VideosQueryData {
  videos?: VideoData[];
}

interface RevenueStatsData {
  totalRevenue?: number;
  subscriptionRevenue?: number;
  transactionFees?: number;
  totalTrend?: string;
  subscriptionPercent?: number;
  transactionPercent?: number;
}

interface GrowthReportData {
  totalUsers?: number;
  usersTrend?: string;
  activeListings?: number;
  listingsTrend?: string;
  totalTransactions?: number;
  transactionsTrend?: string;
  revenue?: number;
  revenueTrend?: string;
}

interface DashboardStatsData {
  stats?: {
    totalUsers?: number;
    activeListings?: number;
    spamReports?: number;
    videoUploads?: number;
  };
}

interface RecentActivityItem {
  id?: string;
  user?: string;
  action?: string;
  listingTitle?: string;
  timestamp?: string | null;
}

interface RecentActivityQueryData {
  activities?: RecentActivityItem[];
}

interface UsersQueryData {
  total?: number;
  data?: Array<{
    id: string;
    username: string;
    displayName?: string;
    mobile?: string;
    autoDetectedLocation?: string;
    location?: string;
    listingsCount?: number;
    listings?: number;
    listingLocations?: string[];
    isVerified?: boolean;
  }>;
}

interface ContactSubmissionsQueryData {
  submissions: ContactSubmission[];
  total: number;
}

interface ErrorLogsQueryData {
  logs: ErrorLog[];
  total: number;
  limit: number;
  offset: number;
}

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// Listings Hooks
// ============================================================================

export function useListings(params?: { limit?: number; offset?: number; status?: string }) {
  return useQuery<ListingsQueryData>({
    queryKey: adminKeys.listingsList(params),
    queryFn: () => listingsApi.getListings(params) as Promise<ListingsQueryData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useListingById(id: string) {
  return useQuery({
    queryKey: adminKeys.listingDetail(id),
    queryFn: () => listingsApi.getListingById(id),
    enabled: !!id,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => listingsApi.createListing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.listings() });
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      listingsApi.updateListing(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.listings() });
      queryClient.invalidateQueries({ queryKey: adminKeys.listingDetail(variables.id) });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => listingsApi.deleteListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.listings() });
    },
  });
}

export function useReviewListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: 'approve' | 'reject';
      reason?: string;
    }) => listingsApi.reviewListing(id, action, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.listings() });
    },
  });
}

// ============================================================================
// Coupons Hooks
// ============================================================================

export function useCoupons() {
  return useQuery<CouponsQueryData>({
    queryKey: adminKeys.couponsList(),
    queryFn: () => couponsApi.getCoupons() as Promise<CouponsQueryData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => couponsApi.createCoupon(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.coupons() });
    },
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      couponsApi.updateCoupon(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.coupons() });
    },
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => couponsApi.deleteCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.coupons() });
    },
  });
}

// ============================================================================
// Subscription Tiers Hooks
// ============================================================================

export function useSubscriptionTiers() {
  return useQuery<SubscriptionTiersQueryData>({
    queryKey: adminKeys.tiersList(),
    queryFn: () => subscriptionTiersApi.getTiers() as Promise<SubscriptionTiersQueryData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useSubscriptionTierById(id: string) {
  return useQuery({
    queryKey: adminKeys.tierDetail(id),
    queryFn: () => subscriptionTiersApi.getTierById(id),
    enabled: !!id,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateSubscriptionTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => subscriptionTiersApi.createTier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.subscriptionTiers() });
    },
  });
}

export function useUpdateSubscriptionTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      subscriptionTiersApi.updateTier(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.subscriptionTiers() });
      queryClient.invalidateQueries({ queryKey: adminKeys.tierDetail(variables.id) });
    },
  });
}

export function useDeleteSubscriptionTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => subscriptionTiersApi.deleteTier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.subscriptionTiers() });
    },
  });
}

// ============================================================================
// Spam Detection Hooks
// ============================================================================

export function useSpamReports() {
  return useQuery<SpamReportsQueryData>({
    queryKey: adminKeys.spamReportsList(),
    queryFn: () => spamDetectionApi.getPendingReports() as Promise<SpamReportsQueryData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useSpamTrends() {
  return useQuery<SpamTrendsQueryData>({
    queryKey: adminKeys.spamTrendsList(),
    queryFn: () => spamDetectionApi.getTrendingSpam() as Promise<SpamTrendsQueryData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useReviewSpamReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, action }: { reportId: string; action: 'approve' | 'reject' }) =>
      spamDetectionApi.reviewReport(reportId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.spamDetection() });
    },
  });
}

// ============================================================================
// Videos Hooks
// ============================================================================

export function useVideos() {
  return useQuery<VideosQueryData>({
    queryKey: adminKeys.videosList(),
    queryFn: () => videosApi.getVideos() as Promise<VideosQueryData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useVideoById(id: string) {
  return useQuery({
    queryKey: adminKeys.videos(),
    queryFn: () => videosApi.getVideoById(id),
    enabled: !!id,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useDeleteVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (videoId: string) => videosApi.deleteVideo(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'videos'] });
    },
  });
}

export function useToggleVideoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (videoId: string) => videosApi.toggleVideoStatus(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'videos'] });
    },
  });
}

// ============================================================================
// Revenue Hooks
// ============================================================================

export function useRevenueStats() {
  return useQuery<RevenueStatsData>({
    queryKey: adminKeys.revenueStats(),
    queryFn: () => revenueApi.getRevenueStats() as Promise<RevenueStatsData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

// ============================================================================
// Reports Hooks
// ============================================================================

export function useGrowthReport() {
  return useQuery<GrowthReportData>({
    queryKey: adminKeys.reportGrowth(),
    queryFn: () => reportsApi.getGrowthReport() as Promise<GrowthReportData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useRecentActivity() {
  return useQuery<RecentActivityQueryData>({
    queryKey: adminKeys.reportRecentActivity(),
    queryFn: () => reportsApi.getRecentActivity() as Promise<RecentActivityQueryData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function usePerformanceReport() {
  return useQuery({
    queryKey: adminKeys.reportPerformance(),
    queryFn: () => reportsApi.getPerformanceReport(),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useTransactionReport() {
  return useQuery({
    queryKey: adminKeys.reportTransaction(),
    queryFn: () => reportsApi.getTransactionReport(),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useModerationReport() {
  return useQuery({
    queryKey: adminKeys.reportModeration(),
    queryFn: () => reportsApi.getModerationReport(),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useDashboardStats() {
  return useQuery<DashboardStatsData>({
    queryKey: adminKeys.dashboardStats(),
    queryFn: () => reportsApi.getDashboardStats() as Promise<DashboardStatsData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

// ============================================================================
// Users Hooks
// ============================================================================

export function useUsers() {
  return useQuery<UsersQueryData>({
    queryKey: adminKeys.usersList(),
    queryFn: () => usersApi.getUsers() as Promise<UsersQueryData>,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useUserById(id: string) {
  return useQuery({
    queryKey: adminKeys.usersList(),
    queryFn: () => usersApi.getUserById(id),
    enabled: !!id,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.suspendUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useUnsuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.unsuspendUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

// ============================================================================
// Banners Hooks
// ============================================================================

export function useBanners(screen?: string) {
  return useQuery({
    queryKey: adminKeys.bannersList(screen),
    queryFn: () => bannersApi.getBanners(screen),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useContactSubmissions(limit?: number) {
  return useQuery<ContactSubmissionsQueryData>({
    queryKey: adminKeys.contactSubmissionsList(limit),
    queryFn: () => contactSubmissionsApi.getContactSubmissions(limit),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useUpdateContactSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { contacted?: boolean; adminComments?: string };
    }) => contactSubmissionsApi.updateContactSubmission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.contactSubmissions() });
    },
  });
}

export function useAddContactSubmissionComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, comment }: { submissionId: string; comment: string }) =>
      contactSubmissionsApi.addComment(submissionId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.contactSubmissions() });
    },
  });
}

export function useUpdateContactSubmissionComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      commentId,
      comment,
    }: {
      submissionId: string;
      commentId: string;
      comment: string;
    }) => contactSubmissionsApi.updateComment(submissionId, commentId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.contactSubmissions() });
    },
  });
}

export function useDeleteContactSubmissionComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, commentId }: { submissionId: string; commentId: string }) =>
      contactSubmissionsApi.deleteComment(submissionId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.contactSubmissions() });
    },
  });
}

export function useErrorLogs(params?: {
  limit?: number;
  offset?: number;
  level?: string;
  environment?: string;
  app_name?: string;
  user_id?: string;
  search?: string;
  from?: string;
  to?: string;
  include_resolved?: boolean;
}) {
  return useQuery<ErrorLogsQueryData>({
    queryKey: adminKeys.errorLogsList(params),
    queryFn: () => errorLogsApi.getErrorLogs(params),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useResetErrorLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params?: {
      before?: string;
      level?: string;
      app_name?: string;
      include_resolved?: boolean;
    }) => errorLogsApi.resetErrorLogs(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.errorLogs() });
    },
  });
}

export function useCleanupErrorLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params?: {
      mode?: 'resolved' | 'all';
      before?: string;
      level?: string;
      app_name?: string;
    }) => errorLogsApi.cleanupErrorLogs(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.errorLogs() });
    },
  });
}

export function useResolveErrorLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolved }: { id: number; resolved: boolean }) =>
      errorLogsApi.setErrorLogResolved(id, resolved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.errorLogs() });
    },
  });
}

export function useCreateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BannerPayload) => bannersApi.createBanner(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.banners() });
    },
  });
}

export function useUpdateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BannerPayload> }) =>
      bannersApi.updateBanner(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.banners() });
    },
  });
}

export function useDeleteBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bannersApi.deleteBanner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.banners() });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { username: string; mobile: string; location: string; isVerified: boolean };
    }) => usersApi.updateUser(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(variables.id) });
    },
  });
}
