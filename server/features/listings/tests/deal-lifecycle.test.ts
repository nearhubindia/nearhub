import { describe, expect, it } from 'vitest';
import {
  addIstCycleMs,
  isSameIstDay,
  isTomorrowIstDay,
  parseTimestamp,
  toIstCycleKey,
} from '../lib/ist-time';
import { deriveDealStatus, getEffectiveDealWindow } from '../lib/deal-status';

describe('listing deal lifecycle', () => {
  it('parses and advances IST cycle dates', () => {
    const start = Date.parse('2026-01-01T18:30:00.000Z');
    expect(parseTimestamp('invalid')).toBeUndefined();
    expect(parseTimestamp(start > 0 ? new Date(start) : undefined)).toBe(start);
    expect(toIstCycleKey(start)).toBe('2026-01-02');
    expect(isSameIstDay(start, start + 30 * 60 * 1000)).toBe(true);
    expect(isTomorrowIstDay(Date.parse('2026-01-02T20:00:00.000Z'), start)).toBe(true);
    expect(addIstCycleMs(start, 'daily')).toBe(start + 86400000);
    expect(addIstCycleMs(start, 'weekly')).toBe(start + 7 * 86400000);
    expect(addIstCycleMs(start, 'monthly')).toBe(Date.parse('2026-02-01T18:30:00.000Z'));
  });

  it('derives upcoming, active, expired, and invalid deal states', () => {
    const input = {
      isDeal: true,
      dealStartAt: '2026-01-01T10:00:00.000Z',
      dealEndAt: '2026-01-01T14:00:00.000Z',
    };
    expect(deriveDealStatus(input, Date.parse('2026-01-01T09:00:00.000Z'))).toBe('upcoming');
    expect(deriveDealStatus(input, Date.parse('2026-01-01T12:00:00.000Z'))).toBe('active');
    expect(deriveDealStatus(input, Date.parse('2026-01-01T15:00:00.000Z'))).toBe('expired');
    expect(deriveDealStatus({ ...input, isDeal: false }, Date.now())).toBeNull();
    expect(
      getEffectiveDealWindow({ ...input, dealEndAt: '2026-01-01T09:00:00.000Z' }, Date.now())
    ).toBeNull();
  });

  it('advances recurring deals and respects recurrence limits', () => {
    const recurring = {
      is_deal: true,
      dealStartAt: '2026-01-01T10:00:00.000Z',
      dealEndAt: '2026-01-01T14:00:00.000Z',
      dealRecurrence: 'daily',
      dealRecurrenceUntil: '2026-01-03T14:00:00.000Z',
    };
    const window = getEffectiveDealWindow(recurring, Date.parse('2026-01-02T12:00:00.000Z'));
    expect(window?.isRecurring).toBe(true);
    expect(window?.startMs).toBe(Date.parse('2026-01-02T10:00:00.000Z'));
    expect(
      getEffectiveDealWindow(
        { ...recurring, dealRecurrenceUntil: '2025-12-31T00:00:00.000Z' },
        Date.now()
      )
    ).toBeNull();
  });
});
