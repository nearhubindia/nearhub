import type {
  AdminGrantSubscriptionData,
  AdminUserDetail,
  AdminUserWriteData,
  AppScreenBanner,
  BannerPayload,
} from '../types/admin-types';
import { getApiUrl } from '@/lib/config';

/**
 * Admin Feature API Layer
 * Centralized API methods for all admin operations
 *
 * Query Keys Pattern:
 * - Organized by resource type
 * - Supports nested filtering and pagination
 * - Used with react-query for caching strategy
 */

const API_BASE_URL = getApiUrl();

// ============================================================================
// Query Keys - Centralized key generation following oshoppe pattern
// ============================================================================

export const adminKeys = {
  all: ['admin'] as const,

  // Listings
  listings: () => [...adminKeys.all, 'listings'] as const,
  listingsList: (params?: { limit?: number; offset?: number }) =>
    [...adminKeys.listings(), { params }] as const,
  listingDetail: (id: string) => [...adminKeys.listings(), id] as const,
  listingsByCategory: (category?: string) =>
    [...adminKeys.listings(), 'category', category] as const,

  // Coupons
  coupons: () => [...adminKeys.all, 'coupons'] as const,
  couponsList: () => [...adminKeys.coupons(), 'list'] as const,

  // Subscription Tiers
  subscriptionTiers: () => [...adminKeys.all, 'subscription-tiers'] as const,
  tiersList: () => [...adminKeys.subscriptionTiers(), 'list'] as const,
  tierDetail: (id: string) => [...adminKeys.subscriptionTiers(), id] as const,

  // Spam Detection
  spamDetection: () => [...adminKeys.all, 'spam-detection'] as const,
  spamReportsList: () => [...adminKeys.spamDetection(), 'reports'] as const,
  spamTrendsList: () => [...adminKeys.spamDetection(), 'trends'] as const,

  // Revenue
  revenue: () => [...adminKeys.all, 'revenue'] as const,
  revenueStats: () => [...adminKeys.revenue(), 'stats'] as const,

  // Reports
  reports: () => [...adminKeys.all, 'reports'] as const,
  reportGrowth: () => [...adminKeys.reports(), 'growth'] as const,
  reportRecentActivity: () => [...adminKeys.reports(), 'recent-activity'] as const,
  reportPerformance: () => [...adminKeys.reports(), 'performance'] as const,
  reportTransaction: () => [...adminKeys.reports(), 'transaction'] as const,
  reportModeration: () => [...adminKeys.reports(), 'moderation'] as const,
  dashboardStats: () => [...adminKeys.reports(), 'dashboard-stats'] as const,

  // Users
  users: () => [...adminKeys.all, 'users'] as const,
  usersList: (params?: { limit?: number; offset?: number; search?: string }) =>
    [...adminKeys.users(), 'list', { params }] as const,
  userDetail: (id: string) => [...adminKeys.users(), id] as const,

  // Banners
  banners: () => [...adminKeys.all, 'banners'] as const,
  bannersList: (screen?: string) => [...adminKeys.banners(), { screen }] as const,

  // Contact Submissions
  contactSubmissions: () => [...adminKeys.all, 'contact-submissions'] as const,
  contactSubmissionsList: (limit?: number) =>
    [...adminKeys.contactSubmissions(), { limit }] as const,

  // Error Logs
  errorLogs: () => [...adminKeys.all, 'error-logs'] as const,
  errorLogsList: (params?: {
    limit?: number;
    offset?: number;
    level?: string;
    environment?: string;
    app_name?: string;
    user_id?: string;
    search?: string;
    from?: string;
    to?: string;
  }) => [...adminKeys.errorLogs(), { params }] as const,
};

// ============================================================================
// Utility Functions
// ============================================================================

const getAuthHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
});

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const handleResponse = async <T = unknown>(response: Response): Promise<T> => {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const payloadData = payload as { error?: string; message?: string } | null;
    const message =
      payloadData?.error ||
      payloadData?.message ||
      `API Error (${response.status}): ${response.statusText || 'Request failed'}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
};

// ============================================================================
// Listings API
// ============================================================================

export const listingsApi = {
  async getListings(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<unknown> {
    const queryString = new URLSearchParams();
    if (params?.limit) queryString.append('limit', params.limit.toString());
    if (params?.offset) queryString.append('offset', params.offset.toString());
    if (params?.status) queryString.append('status', params.status);

    const response = await fetch(`${API_BASE_URL}/api/admin/listings?${queryString}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getListingById(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/listings/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async createListing(data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/listings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateListing(id: string, data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/listings/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteListing(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/listings/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async reviewListing(id: string, action: 'approve' | 'reject', reason?: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/listings/${id}/review`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, reason }),
    });
    return handleResponse(response);
  },

  async getListingsByCategory(category?: string): Promise<unknown> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/listings${query}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Coupons API
// ============================================================================

export const couponsApi = {
  async getCoupons(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/coupons`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async createCoupon(data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/coupons`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateCoupon(id: string, data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/coupons/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteCoupon(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/coupons/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async deactivateCoupon(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/coupons/${id}/deactivate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Subscription Tiers API
// ============================================================================

export const subscriptionTiersApi = {
  async getTiers(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/subscription-tiers`);
    return handleResponse(response);
  },

  async getTierById(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/subscription-tiers/${id}`);
    return handleResponse(response);
  },

  async createTier(data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/subscription-tiers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateTier(id: string, data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/subscription-tiers/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteTier(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/subscription-tiers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Spam Detection API
// ============================================================================

export const spamDetectionApi = {
  async getPendingReports(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/pending-reports`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getTrendingSpam(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/trending-spam`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async reviewReport(reportId: string, action: 'approve' | 'reject'): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/${reportId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action }),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Revenue API
// ============================================================================

export const revenueApi = {
  async getRevenueStats(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/revenue`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Reports API
// ============================================================================

export const reportsApi = {
  async getGrowthReport(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/growth`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getPerformanceReport(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/performance`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getRecentActivity(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/recent-activity`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getTransactionReport(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/transaction`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    return handleResponse(response);
  },

  async getModerationReport(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/moderation`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getDashboardStats(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/dashboard/stats`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Users API
// ============================================================================

export const usersApi = {
  async getUsers(params?: { limit?: number; offset?: number; search?: string }): Promise<unknown> {
    const query = new URLSearchParams();
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    if (typeof params?.search === 'string' && params.search.trim()) {
      query.set('search', params.search.trim());
    }
    const queryString = query.toString();
    const response = await fetch(
      `${API_BASE_URL}/api/admin/users${queryString ? `?${queryString}` : ''}`,
      {
        headers: getAuthHeaders(),
      }
    );
    return handleResponse(response);
  },

  async getUserById(
    id: string
  ): Promise<{ success?: boolean; data?: AdminUserDetail; error?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async createUser(data: AdminUserWriteData): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async suspendUser(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}/suspend`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async unsuspendUser(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}/unsuspend`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async deleteUser(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async updateUser(id: string, data: AdminUserWriteData): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async grantUserSubscription(id: string, data: AdminGrantSubscriptionData): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}/subscriptions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Banners API
// ============================================================================

interface BannersResponse {
  success: boolean;
  banners: AppScreenBanner[];
}

interface BannerResponse {
  success: boolean;
  banner: AppScreenBanner;
}

export const bannersApi = {
  async getBanners(screen?: string): Promise<BannersResponse> {
    const queryString = new URLSearchParams();
    if (screen) {
      queryString.append('screen', screen);
    }

    const suffix = queryString.toString() ? `?${queryString.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/banners${suffix}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<BannersResponse>(response);
  },

  async createBanner(data: BannerPayload): Promise<BannerResponse> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<BannerResponse>(response);
  },

  async updateBanner(id: string, data: Partial<BannerPayload>): Promise<BannerResponse> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<BannerResponse>(response);
  },

  async deleteBanner(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ success: boolean; message: string }>(response);
  },
};

// ============================================================================
// Contact Submissions API
// ============================================================================

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  source: string;
  contacted: boolean;
  adminComments?: string | null;
  contactedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | null;
  comments?: ContactSubmissionComment[];
}

export interface ContactSubmissionComment {
  id: string;
  submissionId: string;
  comment: string;
  createdBy?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ContactSubmissionsResponse {
  success: boolean;
  submissions: ContactSubmission[];
  total: number;
}

interface ContactSubmissionUpdateResponse {
  success: boolean;
  submission: ContactSubmission;
}

interface ContactSubmissionCommentResponse {
  success: boolean;
  comment: ContactSubmissionComment;
}

export const contactSubmissionsApi = {
  async getContactSubmissions(limit = 100): Promise<ContactSubmissionsResponse> {
    const query = new URLSearchParams({ limit: String(limit) }).toString();
    const response = await fetch(`${API_BASE_URL}/api/admin/contact-submissions?${query}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ContactSubmissionsResponse>(response);
  },

  async updateContactSubmission(
    id: string,
    data: { contacted?: boolean; adminComments?: string }
  ): Promise<ContactSubmissionUpdateResponse> {
    const response = await fetch(`${API_BASE_URL}/api/admin/contact-submissions/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<ContactSubmissionUpdateResponse>(response);
  },

  async addComment(
    submissionId: string,
    comment: string
  ): Promise<ContactSubmissionCommentResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/contact-submissions/${submissionId}/comments`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ comment }),
      }
    );
    return handleResponse<ContactSubmissionCommentResponse>(response);
  },

  async updateComment(
    submissionId: string,
    commentId: string,
    comment: string
  ): Promise<ContactSubmissionCommentResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/contact-submissions/${submissionId}/comments/${commentId}`,
      {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ comment }),
      }
    );
    return handleResponse<ContactSubmissionCommentResponse>(response);
  },

  async deleteComment(submissionId: string, commentId: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/contact-submissions/${submissionId}/comments/${commentId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
    return handleResponse<{ success: boolean }>(response);
  },
};

// ============================================================================
// Error Logs API
// ============================================================================

export interface ErrorLog {
  id: number;
  appName: string | null;
  environment: string;
  level: string;
  message: string;
  stackTrace: string | null;
  endpoint: string | null;
  method: string | null;
  statusCode: number | null;
  userId: string | null;
  device: string | null;
  os: string | null;
  appVersion: string | null;
  buildNumber: string | null;
  screen: string | null;
  networkType: string | null;
  extra: Record<string, unknown>;
  ipAddress: string | null;
  fingerprint: string | null;
  occurrenceCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  resolved: boolean;
  createdAt: string | null;
}

interface ErrorLogsResponse {
  success: boolean;
  logs: ErrorLog[];
  total: number;
  limit: number;
  offset: number;
}

interface ErrorLogResetResponse {
  success: boolean;
  affected: number;
}

interface ErrorLogCleanupResponse {
  success: boolean;
  deleted: number;
}

interface ResolveSingleErrorLogResponse {
  success: boolean;
  log: {
    id: number;
    resolved: boolean;
  };
}

export const errorLogsApi = {
  async getErrorLogs(params?: {
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
  }): Promise<ErrorLogsResponse> {
    const queryString = new URLSearchParams();
    if (params?.limit) queryString.append('limit', String(params.limit));
    if (params?.offset) queryString.append('offset', String(params.offset));
    if (params?.level) queryString.append('level', params.level);
    if (params?.environment) queryString.append('environment', params.environment);
    if (params?.app_name) queryString.append('app_name', params.app_name);
    if (params?.user_id) queryString.append('user_id', params.user_id);
    if (params?.search) queryString.append('search', params.search);
    if (params?.from) queryString.append('from', params.from);
    if (params?.to) queryString.append('to', params.to);
    if (params?.include_resolved) queryString.append('include_resolved', 'true');

    const suffix = queryString.toString() ? `?${queryString.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/error-logs${suffix}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ErrorLogsResponse>(response);
  },

  async resetErrorLogs(params?: {
    before?: string;
    level?: string;
    app_name?: string;
    include_resolved?: boolean;
  }): Promise<ErrorLogResetResponse> {
    const response = await fetch(`${API_BASE_URL}/api/admin/error-logs/reset`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params || {}),
    });
    return handleResponse<ErrorLogResetResponse>(response);
  },

  async cleanupErrorLogs(params?: {
    mode?: 'resolved' | 'all';
    before?: string;
    level?: string;
    app_name?: string;
  }): Promise<ErrorLogCleanupResponse> {
    const queryString = new URLSearchParams();
    if (params?.mode) queryString.append('mode', params.mode);
    if (params?.before) queryString.append('before', params.before);
    if (params?.level) queryString.append('level', params.level);
    if (params?.app_name) queryString.append('app_name', params.app_name);
    const suffix = queryString.toString() ? `?${queryString.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/api/admin/error-logs${suffix}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<ErrorLogCleanupResponse>(response);
  },

  async resolveErrorLog(id: number): Promise<ResolveSingleErrorLogResponse> {
    const response = await fetch(`${API_BASE_URL}/api/admin/error-logs/${id}/resolve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<ResolveSingleErrorLogResponse>(response);
  },

  async setErrorLogResolved(id: number, resolved: boolean): Promise<ResolveSingleErrorLogResponse> {
    // Backward compatibility:
    // - new backend: PATCH /:id/resolved (supports true/false)
    // - older backend: POST /:id/resolve (supports true only)
    if (resolved) {
      const patchResponse = await fetch(`${API_BASE_URL}/api/admin/error-logs/${id}/resolved`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resolved: true }),
      });

      if (patchResponse.ok) {
        return handleResponse<ResolveSingleErrorLogResponse>(patchResponse);
      }

      if (patchResponse.status !== 404 && patchResponse.status !== 405) {
        return handleResponse<ResolveSingleErrorLogResponse>(patchResponse);
      }

      const legacyResponse = await fetch(`${API_BASE_URL}/api/admin/error-logs/${id}/resolve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return handleResponse<ResolveSingleErrorLogResponse>(legacyResponse);
    }

    const response = await fetch(`${API_BASE_URL}/api/admin/error-logs/${id}/resolved`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ resolved: false }),
    });
    return handleResponse<ResolveSingleErrorLogResponse>(response);
  },
};
