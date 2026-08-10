import { describe, expect, it } from 'vitest';
import { isDeal, isDealAvailableForDealSections, isDealCompleted } from '../lib/deal-visibility';

const now = Date.parse('2026-01-01T12:00:00.000Z');

describe('landing deal visibility', () => {
  it('supports both API naming conventions', () => {
    expect(isDeal({ isDeal: true })).toBe(true);
    expect(isDeal({ is_deal: true })).toBe(true);
    expect(isDeal({ isDeal: false })).toBe(false);
  });

  it('marks stock and status completion as unavailable', () => {
    expect(isDealCompleted({ dealCycleQuantity: 2, dealBookingsUsed: 2 }, now)).toBe(true);
    expect(isDealCompleted({ max_deal_bookings: '3', deal_bookings_used: '1' }, now)).toBe(false);
    expect(isDealCompleted({ dealStatus: 'SOLD_OUT' }, now)).toBe(true);
    expect(isDealCompleted({ status: 'active' }, now)).toBe(false);
  });

  it('keeps only active, uncompleted deals in deal sections', () => {
    expect(isDealAvailableForDealSections({ isDeal: true, status: 'active' }, now)).toBe(true);
    expect(isDealAvailableForDealSections({ isDeal: false, status: 'active' }, now)).toBe(false);
    expect(isDealAvailableForDealSections({ isDeal: true, dealStatus: 'expired' }, now)).toBe(
      false
    );
  });
});
