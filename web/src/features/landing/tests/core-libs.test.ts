import { beforeEach, describe, expect, it } from 'vitest';
import { buildAuthRegisterPath } from '@/lib/auth-redirect';
import { getCategoryAccent } from '@/lib/category-display';
import {
  formatDealStartMessage,
  getEffectiveDealWindow,
  formatDealCountdown,
  formatDealStatus,
  isDealActiveNow,
  isDealExpiredWithinWindow,
  isDealUpcomingWithinWindow,
  parseDealEndMs,
  parseDealStartMs,
} from '@/lib/deal-timer';
import {
  addIstCycleMs,
  formatIstDateInputValue,
  formatIstDateKey,
  formatIstDateTime,
  formatIstTimeInputValue,
  isSameIstDay,
  isTomorrowIstDay,
  parseIstDateTimeToDate,
} from '@/lib/ist-time';
import {
  clearStoredWebAuth,
  getMeaningfulWebUserName,
  readStoredWebUser,
  writeStoredWebAuth,
  writeStoredWebUser,
} from '@/lib/web-auth-storage';
import { readStoredHeaderGeoCoords, readStoredWebGeoCoords } from '@/lib/web-geo-storage';

describe('shared browser libraries', () => {
  beforeEach(() => localStorage.clear());

  it('builds safe registration redirects and stable category accents', () => {
    expect(buildAuthRegisterPath('/browse', '?q=phone')).toBe(
      '/auth/register?redirect=%2Fbrowse%3Fq%3Dphone'
    );
    expect(buildAuthRegisterPath('/auth/register', '', '/')).toBe('/auth/register?redirect=%2F');
    expect(getCategoryAccent('Vehicles')).toBe(getCategoryAccent(' vehicles '));
    expect(getCategoryAccent('')).toMatch(/^#/);
  });

  it('handles IST date conversion and recurring cycles', () => {
    const date = new Date('2026-01-01T18:30:00.000Z');
    expect(formatIstDateInputValue(date)).toBe('2026-01-02');
    expect(formatIstTimeInputValue(date)).toBe('00:00');
    expect(parseIstDateTimeToDate('2026-01-02', '00:00')?.toISOString()).toBe(
      '2026-01-01T18:30:00.000Z'
    );
    expect(parseIstDateTimeToDate('2026-02-30', '00:00')).toBeNull();
    expect(formatIstDateTime('not-a-date')).toBe('Unavailable');
    expect(formatIstDateKey(date)).toBe('2026-01-02');
    expect(isSameIstDay(date.getTime(), date.getTime() + 30 * 60 * 1000)).toBe(true);
    expect(isTomorrowIstDay(Date.parse('2026-01-02T20:00:00.000Z'), date.getTime())).toBe(true);
    expect(addIstCycleMs(date.getTime(), 'daily')).toBe(date.getTime() + 86400000);
    expect(addIstCycleMs(date.getTime(), 'weekly')).toBe(date.getTime() + 7 * 86400000);
    expect(addIstCycleMs(date.getTime(), 'monthly')).toBe(Date.parse('2026-02-01T18:30:00.000Z'));
  });

  it('derives one-off and recurring deal windows and statuses', () => {
    const now = Date.parse('2026-01-01T08:00:00.000Z');
    const input = {
      startDate: '2026-01-01',
      startTime: '15:00',
      endDate: '2026-01-01',
      endTime: '18:00',
    };
    expect(getEffectiveDealWindow(input, now)?.isRecurring).toBe(false);
    expect(parseDealStartMs(input)).toBe(Date.parse('2026-01-01T09:30:00.000Z'));
    expect(parseDealEndMs(input)).toBe(Date.parse('2026-01-01T12:30:00.000Z'));
    expect(formatDealCountdown(30 * 60 * 1000)).toBe('30 min');
    expect(formatDealCountdown(90 * 60 * 1000)).toBe('2 hrs');
    expect(formatDealStatus(input, now)).toContain('Deal starts');
    expect(isDealActiveNow(input, now)).toBe(false);
    expect(isDealUpcomingWithinWindow(input, now)).toBe(true);
    expect(formatDealStartMessage(Date.parse('2026-01-01T09:00:00.000Z'), now)).toBe(
      'Deal starts today'
    );
    expect(formatDealStartMessage(Date.parse('2026-01-02T09:00:00.000Z'), now)).toBe(
      'Deal starts tomorrow'
    );
    expect(
      formatDealStatus(
        { dealStartAt: '2025-12-01T00:00:00.000Z', dealEndAt: '2025-12-01T01:00:00.000Z' },
        now
      )
    ).toBe('Deal expired');
    expect(
      isDealExpiredWithinWindow(
        { dealStartAt: '2025-12-29T00:00:00.000Z', dealEndAt: '2025-12-29T01:00:00.000Z' },
        now
      )
    ).toBe(true);
    expect(
      isDealExpiredWithinWindow(
        { dealStartAt: '2025-01-01T00:00:00.000Z', dealEndAt: '2025-01-01T01:00:00.000Z' },
        now
      )
    ).toBe(false);
    expect(getEffectiveDealWindow({ startDate: 'bad', startTime: 'bad' }, now)).toBeNull();

    const recurring = {
      ...input,
      dealRecurrence: 'daily',
      dealRecurrenceUntil: '2026-01-05T18:30:00.000Z',
    };
    expect(
      getEffectiveDealWindow(recurring, Date.parse('2026-01-03T12:00:00.000Z'))?.isRecurring
    ).toBe(true);
    expect(isDealUpcomingWithinWindow(recurring, now)).toBe(true);
  });

  it('round-trips auth and geo storage while rejecting invalid coordinates', () => {
    const user = { id: 'u1', name: 'Pavan', latitude: 16.5, longitude: 80.6 };
    writeStoredWebUser(user);
    expect(readStoredWebUser()).toEqual(user);
    writeStoredWebAuth(user, 'token');
    expect(localStorage.getItem('nearhub_web_token')).toBe('token');
    clearStoredWebAuth();
    expect(readStoredWebUser()).toBeNull();

    localStorage.setItem(
      'nearhub:header:inputs:v1',
      JSON.stringify({ geo: { latitude: 16.5, longitude: 80.6 } })
    );
    expect(readStoredHeaderGeoCoords()).toEqual({ latitude: 16.5, longitude: 80.6 });
    expect(readStoredWebGeoCoords()).toEqual({ latitude: 16.5, longitude: 80.6 });
    expect(getMeaningfulWebUserName('  Pavan Prasad ')).toBe('Pavan Prasad');
    expect(getMeaningfulWebUserName('nearhub-user')).toBe('');
    expect(getMeaningfulWebUserName('9876543210')).toBe('');
    expect(getMeaningfulWebUserName('user123')).toBe('');
    expect(getMeaningfulWebUserName('123456')).toBe('');
    expect(getMeaningfulWebUserName(null)).toBe('');
    localStorage.setItem(
      'nearhub:header:inputs:v1',
      JSON.stringify({ geo: { latitude: 100, longitude: 80 } })
    );
    expect(readStoredHeaderGeoCoords()).toBeNull();
    localStorage.setItem('nearhub_web_user', JSON.stringify(user));
    expect(readStoredWebGeoCoords()).toEqual({ latitude: 16.5, longitude: 80.6 });
  });
});
