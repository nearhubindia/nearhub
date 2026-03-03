import { useState, useCallback } from 'react';

export type ReportReason = 'spam' | 'scam' | 'harassment' | 'inappropriate' | 'other';

export interface UserSpamProfile {
  userId: string;
  totalReports: number;
  reportsByReason: Record<string, number>;
  isBlocked: boolean;
  blockReason?: string;
  blockDate?: number;
  lastReportDate?: number;
  spamScore: number;
}

/**
 * Hook for user spam detection and reporting
 */
export function useSpamDetection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Report a user
   */
  const reportUser = useCallback(
    async (
      reportedUserId: string,
      reporterUserId: string,
      reason: ReportReason,
      description: string,
      listingId?: string
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/report-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportedUserId,
            reporterUserId,
            reason,
            description,
            listingId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to report user');
        }

        const data = await response.json();
        return data.report;
      } catch (err: any) {
        const message = err.message || 'Failed to report user';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Get user spam profile
   */
  const getUserSpamProfile = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user-spam-profile/${userId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch spam profile');
      }

      const profile: UserSpamProfile = await response.json();
      return profile;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch spam profile';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check if user is blocked
   */
  const isUserBlocked = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`/api/is-user-blocked/${userId}`);

      if (!response.ok) {
        throw new Error('Failed to check user block status');
      }

      const data = await response.json();
      return data.isBlocked;
    } catch (err: any) {
      console.error('Failed to check user block status:', err);
      return false;
    }
  }, []);

  return {
    loading,
    error,
    reportUser,
    getUserSpamProfile,
    isUserBlocked,
    setError,
  };
}

/**
 * Hook for admin spam management
 */
export function useSpamManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get pending reports
   */
  const getPendingReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/pending-reports');

      if (!response.ok) {
        throw new Error('Failed to fetch pending reports');
      }

      return await response.json();
    } catch (err: any) {
      const message = err.message || 'Failed to fetch pending reports';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Review a report
   */
  const reviewReport = useCallback(
    async (reportId: string, status: 'reviewed' | 'dismissed', adminNotes: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/review-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId, status, adminNotes }),
        });

        if (!response.ok) {
          throw new Error('Failed to review report');
        }

        return await response.json();
      } catch (err: any) {
        const message = err.message || 'Failed to review report';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Block a user
   */
  const blockUser = useCallback(async (userId: string, reason: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/block-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to block user');
      }

      return await response.json();
    } catch (err: any) {
      const message = err.message || 'Failed to block user';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Unblock a user
   */
  const unblockUser = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/unblock-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to unblock user');
      }

      return await response.json();
    } catch (err: any) {
      const message = err.message || 'Failed to unblock user';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get trending spam reasons
   */
  const getTrendingSpam = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/trending-spam');

      if (!response.ok) {
        throw new Error('Failed to fetch trending spam');
      }

      return await response.json();
    } catch (err: any) {
      console.error('Failed to fetch trending spam:', err);
      return { trends: [] };
    }
  }, []);

  /**
   * Get high-risk users
   */
  const getHighRiskUsers = useCallback(async (threshold: number = 50) => {
    try {
      const response = await fetch(`/api/admin/high-risk-users?threshold=${threshold}`);

      if (!response.ok) {
        throw new Error('Failed to fetch high-risk users');
      }

      return await response.json();
    } catch (err: any) {
      console.error('Failed to fetch high-risk users:', err);
      return { users: [], count: 0 };
    }
  }, []);

  return {
    loading,
    error,
    getPendingReports,
    reviewReport,
    blockUser,
    unblockUser,
    getTrendingSpam,
    getHighRiskUsers,
    setError,
  };
}
