import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateDistanceKm,
  countdownPartsFromMs,
  discountPercentage,
  formatCurrencyInr,
  formatDistanceKm,
  formatPriceInr,
  parsePositiveNumber,
  readStoredStringSet,
  writeStoredStringSet,
} from '../lib/landing-utils';

describe('landing utility functions', () => {
  beforeEach(() => localStorage.clear());

  it('parses positive prices and formats fallback and INR values', () => {
    expect(parsePositiveNumber('1250')).toBe(1250);
    expect(parsePositiveNumber(0)).toBeUndefined();
    expect(parsePositiveNumber(-1)).toBeUndefined();
    expect(parsePositiveNumber('not-a-number')).toBeUndefined();
    expect(formatCurrencyInr(undefined)).toBe('Price on request');
    expect(formatCurrencyInr(125000)).toContain('1,25,000');
    expect(formatPriceInr('125000')).toContain('1,25,000');
  });

  it('round-trips stored string sets and tolerates malformed storage', () => {
    writeStoredStringSet('saved', ['a', 'b', 'a']);
    expect(readStoredStringSet('saved')).toEqual(new Set(['a', 'b', 'a']));
    localStorage.setItem('saved', '{bad json');
    expect(readStoredStringSet('saved')).toEqual(new Set());
    localStorage.setItem('saved', JSON.stringify([1, 'valid', null]));
    expect(readStoredStringSet('saved')).toEqual(new Set(['valid']));
  });

  it('calculates and formats distances across display ranges', () => {
    expect(calculateDistanceKm(16.5062, 80.648, 16.5062, 80.648)).toBe(0);
    expect(calculateDistanceKm('bad', 80, 16, 80)).toBeUndefined();
    expect(formatDistanceKm(0.05)).toBe('At your location');
    expect(formatDistanceKm(0.456)).toBe('0.46 km away');
    expect(formatDistanceKm(2.34)).toBe('2.3 km away');
    expect(formatDistanceKm(12.4)).toBe('12 km away');
    expect(formatDistanceKm('bad')).toBe('Distance unavailable');
  });

  it('builds countdown parts and discount labels', () => {
    expect(countdownPartsFromMs(Date.UTC(2026, 0, 2, 1, 2, 3), Date.UTC(2026, 0, 1))).toEqual([
      { value: '01', label: 'DAYS' },
      { value: '01', label: 'HOURS' },
      { value: '02', label: 'MINS' },
      { value: '03', label: 'SECS' },
    ]);
    expect(countdownPartsFromMs(undefined, 0)[0]).toEqual({ value: '00', label: 'DAYS' });
    expect(discountPercentage(800, 1000)).toBe('20% OFF');
    expect(discountPercentage(1000, 1000)).toBeNull();
    expect(discountPercentage(undefined, 1000)).toBeNull();
  });
});
