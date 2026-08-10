import { deriveDealStatus, getEffectiveDealWindow } from '../lib/deal-status';

const hour = 60 * 60 * 1000;
const start = Date.parse('2026-08-10T10:00:00+05:30');
const end = start + 2 * hour;

describe('listings deal lifecycle', () => {
  it('derives an active status inside a deal window', () => {
    expect(
      deriveDealStatus(
        {
          isDeal: true,
          dealStartAt: new Date(start),
          dealEndAt: new Date(end),
        },
        start + hour
      )
    ).toBe('active');
  });

  it('returns upcoming and expired states at the boundaries', () => {
    const input = {
      isDeal: true,
      dealStartAt: new Date(start),
      dealEndAt: new Date(end),
    };

    expect(deriveDealStatus(input, start - 1)).toBe('upcoming');
    expect(deriveDealStatus(input, end + 1)).toBe('expired');
    expect(deriveDealStatus({ ...input, isDeal: false }, start + hour)).toBeNull();
  });

  it('advances recurring windows using the configured timezone cycle', () => {
    const window = getEffectiveDealWindow(
      {
        dealStartAt: new Date(start),
        dealEndAt: new Date(end),
        dealRecurrence: 'daily',
        dealRecurrenceUntil: new Date(start + 3 * 24 * hour),
      },
      start + 24 * hour + hour
    );

    expect(window?.isRecurring).toBe(true);
    expect(window?.startMs).toBe(start + 24 * hour);
  });
});
