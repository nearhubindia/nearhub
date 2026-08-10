import { describe, expect, it, vi } from 'vitest';
import {
  blockUser,
  getHighRiskUsers,
  getReportsByStatus,
  getTrendingSpamReasons,
  getUserReports,
  getUserSpamProfile,
  isUserBlocked,
  reportUser,
  reviewReport,
  unblockUser,
} from '../services/spam-detector';

vi.mock('../../../shared/services/auto-notifications', () => ({
  notifySpamReportFiled: vi.fn().mockResolvedValue(undefined),
}));

describe('spam detector', () => {
  it('prevents self and duplicate reports and tracks report status', () => {
    const userId = `reported-${Date.now()}-one`;
    expect(() => reportUser(userId, userId, 'spam', 'self')).toThrow('Cannot report yourself');
    const first = reportUser(userId, 'reporter-one', 'spam', 'duplicate test');
    expect(() => reportUser(userId, 'reporter-one', 'spam', 'duplicate test')).toThrow(
      'already reported'
    );
    expect(getUserReports(userId)).toHaveLength(1);
    expect(reviewReport(first.id, 'reviewed', 'checked')?.status).toBe('reviewed');
    expect(getReportsByStatus('reviewed').some((report) => report.id === first.id)).toBe(true);
    expect(reviewReport('missing', 'dismissed', 'none')).toBeNull();
  });

  it('calculates reasons, blocks at the threshold, and supports admin unblock', () => {
    const userId = `reported-${Date.now()}-two`;
    for (let index = 0; index < 15; index += 1) {
      reportUser(userId, `reporter-${index}`, index % 2 ? 'scam' : 'spam', `report ${index}`);
    }
    const profile = getUserSpamProfile(userId)!;
    expect(profile.totalReports).toBe(15);
    expect(profile.spamScore).toBe(100);
    expect(isUserBlocked(userId)).toBe(true);
    expect(getHighRiskUsers(50).some((item) => item.userId === userId)).toBe(true);
    expect(getTrendingSpamReasons().some((item) => item.reason === 'spam')).toBe(true);
    expect(blockUser(userId, 'manual')).toMatchObject({ isBlocked: true });
    expect(unblockUser(userId)).toMatchObject({ isBlocked: false, blockReason: undefined });
  });
});
