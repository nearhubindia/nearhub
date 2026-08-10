import { describe, expect, it } from 'vitest';
import { formatters } from '../utils/formatters';

describe('admin formatters', () => {
  it('formats Indian currency, dates, percentages, and compact numbers', () => {
    expect(formatters.formatPrice('125000')).toContain('₹');
    expect(formatters.formatPrice(125000)).toContain('1,25,000');
    expect(formatters.formatDate('2026-01-05T00:00:00.000Z')).toMatch(/05|5/);
    expect(formatters.formatDateTime(new Date('2026-01-05T12:30:00.000Z'))).toContain('2026');
    expect(formatters.formatPercentage(0.875)).toBe('87.5%');
    expect(formatters.formatNumber(42)).toBe('42');
    expect(formatters.formatNumber(1500)).toBe('1.5K');
    expect(formatters.formatNumber(2500000)).toBe('2.5M');
  });

  it('formats text and codes', () => {
    expect(formatters.truncateText('NearHub marketplace', 8)).toBe('NearHub ...');
    expect(formatters.truncateText('short', 8)).toBe('short');
    expect(formatters.formatCouponCode('nearhub_2026')).toBe('NEARHUB_2026');
  });

  it('returns known and fallback badge styles and labels', () => {
    expect(formatters.getStatusBadgeStyle('active')).toEqual({
      bg: 'bg-green-100',
      text: 'text-green-800',
    });
    expect(formatters.getStatusBadgeStyle('unknown')).toEqual({
      bg: 'bg-slate-100',
      text: 'text-slate-800',
    });
    expect(formatters.getListingStatusLabel('pending')).toBe('Pending Approval');
    expect(formatters.getListingStatusLabel('custom')).toBe('custom');
    expect(formatters.getTierTypeLabel('premium')).toBe('Premium Tier');
    expect(formatters.getTierTypeLabel('custom')).toBe('custom');
  });
});
