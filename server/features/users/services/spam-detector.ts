// User spam detection and blocking system

import { notifySpamReportFiled } from '../../../shared/services/auto-notifications';

export interface UserReport {
  id: string;
  reportedUserId: string;
  reporterUserId: string;
  reason: 'spam' | 'scam' | 'harassment' | 'inappropriate' | 'other';
  description: string;
  listingId?: string;
  timestamp: number;
  status: 'pending' | 'reviewed' | 'dismissed';
  adminNotes?: string;
}

export interface UserSpamProfile {
  userId: string;
  totalReports: number;
  reportsByReason: Record<string, number>;
  isBlocked: boolean;
  blockReason?: string;
  blockDate?: number;
  lastReportDate?: number;
  spamScore: number; // 0-100
}

// In-memory storage (replace with database)
let userReports: Map<string, UserReport[]> = new Map();
let userSpamProfiles: Map<string, UserSpamProfile> = new Map();

const SPAM_BLOCK_THRESHOLD = 15; // Auto-block after 15 reports
const SPAM_SCORE_MULTIPLIER = 6.67; // 100 / 15 = 6.67 per report

/**
 * Report a user as spam/scam/harassment
 */
export function reportUser(
  reportedUserId: string,
  reporterUserId: string,
  reason: 'spam' | 'scam' | 'harassment' | 'inappropriate' | 'other',
  description: string,
  listingId?: string
): UserReport {
  // Prevent self-reporting
  if (reportedUserId === reporterUserId) {
    throw new Error('Cannot report yourself');
  }

  // Prevent duplicate reports from same user
  const existingReports = userReports.get(reportedUserId) || [];
  const recentDuplicate = existingReports.some(
    (r) =>
      r.reporterUserId === reporterUserId &&
      r.status === 'pending' &&
      Date.now() - r.timestamp < 24 * 60 * 60 * 1000 // Within 24 hours
  );

  if (recentDuplicate) {
    throw new Error('You have already reported this user recently');
  }

  const report: UserReport = {
    id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    reportedUserId,
    reporterUserId,
    reason,
    description,
    listingId,
    timestamp: Date.now(),
    status: 'pending',
  };

  // Add to reports list
  const reports = userReports.get(reportedUserId) || [];
  reports.push(report);
  userReports.set(reportedUserId, reports);

  // Update spam profile
  const profile = updateUserSpamScore(reportedUserId);

  // Send notification to reported user if they have multiple reports
  if (profile.totalReports >= 3) {
    notifySpamReportFiled(reportedUserId, reason, profile.totalReports).catch((err) =>
      console.error('[SpamDetector] Failed to send spam report notification:', err)
    );
  }

  return report;
}

/**
 * Update user spam score and check for auto-block
 */
function updateUserSpamScore(userId: string): UserSpamProfile {
  const reports = userReports.get(userId) || [];
  const pendingReports = reports.filter((r) => r.status === 'pending').length;

  let profile = userSpamProfiles.get(userId) || {
    userId,
    totalReports: pendingReports,
    reportsByReason: {},
    isBlocked: false,
    spamScore: 0,
  };

  // Count reports by reason
  const reasonCounts: Record<string, number> = {};
  reports.forEach((r) => {
    reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
  });

  profile.reportsByReason = reasonCounts;
  profile.totalReports = pendingReports;
  profile.lastReportDate = reports.length > 0 ? reports[reports.length - 1].timestamp : undefined;

  // Calculate spam score (0-100)
  profile.spamScore = Math.min(pendingReports * SPAM_SCORE_MULTIPLIER, 100);

  // Auto-block if threshold reached
  if (pendingReports >= SPAM_BLOCK_THRESHOLD && !profile.isBlocked) {
    profile.isBlocked = true;
    profile.blockReason = `Auto-blocked: ${pendingReports} user reports exceed threshold (${SPAM_BLOCK_THRESHOLD})`;
    profile.blockDate = Date.now();
  }

  userSpamProfiles.set(userId, profile);
  return profile;
}

/**
 * Get user spam profile
 */
export function getUserSpamProfile(userId: string): UserSpamProfile | null {
  return userSpamProfiles.get(userId) || null;
}

/**
 * Get all reports for a user
 */
export function getUserReports(userId: string): UserReport[] {
  return userReports.get(userId) || [];
}

/**
 * Get reports by status
 */
export function getReportsByStatus(status: 'pending' | 'reviewed' | 'dismissed'): UserReport[] {
  const allReports: UserReport[] = [];
  for (const reports of userReports.values()) {
    allReports.push(...reports.filter((r) => r.status === status));
  }
  return allReports.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Manually block a user (admin action)
 */
export function blockUser(userId: string, reason: string): UserSpamProfile {
  let profile = userSpamProfiles.get(userId) || {
    userId,
    totalReports: 0,
    reportsByReason: {},
    isBlocked: false,
    spamScore: 0,
  };

  profile.isBlocked = true;
  profile.blockReason = `Admin blocked: ${reason}`;
  profile.blockDate = Date.now();

  userSpamProfiles.set(userId, profile);
  return profile;
}

/**
 * Unblock a user (admin action)
 */
export function unblockUser(userId: string): UserSpamProfile {
  let profile = userSpamProfiles.get(userId) || {
    userId,
    totalReports: 0,
    reportsByReason: {},
    isBlocked: false,
    spamScore: 0,
  };

  profile.isBlocked = false;
  profile.blockReason = undefined;

  userSpamProfiles.set(userId, profile);
  return profile;
}

/**
 * Review a report and update status
 */
export function reviewReport(
  reportId: string,
  status: 'reviewed' | 'dismissed',
  adminNotes: string
): UserReport | null {
  for (const [userId, reports] of userReports.entries()) {
    const report = reports.find((r) => r.id === reportId);
    if (report) {
      report.status = status;
      report.adminNotes = adminNotes;

      // Recalculate spam score if dismissed
      if (status === 'dismissed') {
        updateUserSpamScore(userId);
      }

      return report;
    }
  }
  return null;
}

/**
 * Check if user is blocked
 */
export function isUserBlocked(userId: string): boolean {
  const profile = userSpamProfiles.get(userId);
  return profile?.isBlocked || false;
}

/**
 * Get trending spam reasons
 */
export function getTrendingSpamReasons(): Array<{ reason: string; count: number }> {
  const reasonCounts: Record<string, number> = {};

  for (const reports of userReports.values()) {
    reports.forEach((r) => {
      if (r.status === 'pending') {
        reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
      }
    });
  }

  return Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get users with high spam scores
 */
export function getHighRiskUsers(threshold: number = 50): UserSpamProfile[] {
  return Array.from(userSpamProfiles.values())
    .filter((profile) => profile.spamScore >= threshold)
    .sort((a, b) => b.spamScore - a.spamScore);
}
