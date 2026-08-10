import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateExpiryDate,
  formatPrice,
  generatePricingSummary,
  getAllPricingOptions,
  getPricingForDuration,
  getDaysRemaining,
  hasListingExpired,
  isListingFree,
  isNewListingFree,
  isValidDuration,
  getPricingConfig,
  isListingFreeAsync,
  isListingInFreePeriodAsync,
} from '../services/pricing';
import { getAdminSettings } from '../../admin/services/admin-settings';

vi.mock('../../admin/services/admin-settings', () => ({ getAdminSettings: vi.fn() }));

const mockedGetAdminSettings = vi.mocked(getAdminSettings);

describe('listing pricing', () => {
  beforeEach(() => {
    mockedGetAdminSettings.mockResolvedValue({
      freeListingDays: 15,
      freeTierThreshold: '3000',
    } as never);
  });

  it('handles free and paid listing pricing', () => {
    expect(isNewListingFree()).toBe(true);
    expect(isListingFree(2999)).toBe(true);
    expect(isListingFree(3000)).toBe(false);
    expect(getPricingForDuration(1000, 15)).toEqual({ productPrice: 1000, isFree: true });
    expect(getPricingForDuration(5000, 90)).toMatchObject({
      productPrice: 5000,
      isFree: false,
      totalFee: 594,
      durationLabel: '3 months',
    });
    expect(getPricingForDuration(5000, 30 as never).totalFee).toBe(99);
    expect(getAllPricingOptions(1000)).toHaveLength(1);
    expect(getAllPricingOptions(5000)).toHaveLength(4);
  });

  it('validates durations, dates, remaining time, and summaries', () => {
    expect(isValidDuration(15)).toBe(true);
    expect(isValidDuration(30 as never)).toBe(false);
    const start = new Date('2026-01-01T00:00:00.000Z');
    expect(calculateExpiryDate(start, 15).toISOString()).toBe('2026-01-16T00:00:00.000Z');
    expect(hasListingExpired(new Date('2000-01-01'))).toBe(true);
    expect(getDaysRemaining(new Date(Date.now() + 2 * 86400000))).toBeGreaterThanOrEqual(1);
    expect(formatPrice(125000)).toContain('1,25,000');
    expect(generatePricingSummary(1000)).toContain('FREE');
    expect(generatePricingSummary(5000)).toContain('Paid listing required');
    expect(generatePricingSummary(5000, 15)).toContain('15 days');
    expect(getPricingConfig().DURATION_OPTIONS).toEqual([15, 45, 90, 180]);
  });

  it('uses configured asynchronous free-period and price thresholds', async () => {
    const recent = new Date(Date.now() - 2 * 86400000);
    expect(await isListingInFreePeriodAsync(recent)).toBe(true);
    expect(await isListingInFreePeriodAsync(new Date(Date.now() - 20 * 86400000))).toBe(false);
    expect(await isListingFreeAsync(2500)).toBe(true);
    expect(await isListingFreeAsync(3500)).toBe(false);
  });
});
