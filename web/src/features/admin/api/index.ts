import type { AppScreenBanner, BannerPayload } from '../types/admin-types';
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

  // Videos
  videos: () => [...adminKeys.all, 'videos'] as const,
  videosList: (params?: { type?: string }) =>
    [...adminKeys.videos(), { params }] as const,

  // Revenue
  revenue: () => [...adminKeys.all, 'revenue'] as const,
  revenueStats: () => [...adminKeys.revenue(), 'stats'] as const,

  // Reports
  reports: () => [...adminKeys.all, 'reports'] as const,
  reportGrowth: () => [...adminKeys.reports(), 'growth'] as const,
  reportPerformance: () => [...adminKeys.reports(), 'performance'] as const,
  reportTransaction: () => [...adminKeys.reports(), 'transaction'] as const,
  reportModeration: () => [...adminKeys.reports(), 'moderation'] as const,

  // Users
  users: () => [...adminKeys.all, 'users'] as const,
  usersList: () => [...adminKeys.users(), 'list'] as const,
  userDetail: (id: string) => [...adminKeys.users(), id] as const,

  // Banners
  banners: () => [...adminKeys.all, 'banners'] as const,
  bannersList: (screen?: string) => [...adminKeys.banners(), { screen }] as const,
};

// ============================================================================
// Utility Functions
// ============================================================================

const getAuthHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
});

const handleResponse = async <T = unknown>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  const json = await response.json();
  return json as T;
};

// ============================================================================
// Listings API
// ============================================================================

export const listingsApi = {
  async getListings(params?: { limit?: number; offset?: number }): Promise<unknown> {
    const queryString = new URLSearchParams();
    if (params?.limit) queryString.append('limit', params.limit.toString());
    if (params?.offset) queryString.append('offset', params.offset.toString());

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
    const response = await fetch(`${API_BASE_URL}/api/listings`, {
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

  async getListingsByCategory(category?: string): Promise<unknown> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await fetch(`${API_BASE_URL}/api/listings${query}`, {
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
      method: 'PUT',
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
// Videos API
// ============================================================================

export const videosApi = {
  async getVideos(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/listings`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse<{ data?: Array<Record<string, unknown>> } & Record<string, unknown>>(response);
    
    // Filter to only listings that have videos
    if (Array.isArray(result.data)) {
      const videosOnly = result.data.filter((listing) => {
        const videos = listing.videos;
        const normalizedVideos = Array.isArray(videos) ? videos : [];
        return normalizedVideos.length > 0;
      });
      return { ...result, videos: videosOnly };
    }
    
    return result;
  },

  async getVideoById(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/listings/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async deleteVideo(videoId: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/listings/${videoId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async toggleVideoStatus(videoId: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/listings/${videoId}/toggle-status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
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

  async getTransactionReport(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/transaction`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getModerationReport(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/moderation`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Users API
// ============================================================================

export const usersApi = {
  async getUsers(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getUserById(id: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
      headers: getAuthHeaders(),
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

  async updateUser(id: string, data: { username: string; mobile: string; location: string }): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
      method: 'PUT',
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
