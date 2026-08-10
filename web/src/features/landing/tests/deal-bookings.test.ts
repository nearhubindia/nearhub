import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelDealBooking,
  formatDateTime,
  openVoucherPdf,
  parseVoucherPayload,
  statusClass,
  statusLabel,
  statIconClass,
} from '../lib/deal-bookings';

describe('landing deal bookings helpers', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('parses voucher payloads and handles invalid data', () => {
    expect(parseVoucherPayload({ listingTitle: 'Phone' })).toEqual({ listingTitle: 'Phone' });
    expect(parseVoucherPayload('{"listingTitle":"Phone"}')).toEqual({ listingTitle: 'Phone' });
    expect(parseVoucherPayload('not-json')).toEqual({});
    expect(parseVoucherPayload(null)).toEqual({});
  });

  it('formats dates and booking statuses', () => {
    expect(formatDateTime()).toBe('Not available');
    expect(formatDateTime('not-a-date')).toBe('Not available');
    expect(formatDateTime('2026-01-01T00:00:00.000Z')).toContain('2026');
    expect(statusClass('redeemed')).toContain('emerald');
    expect(statusClass('cancelled')).toContain('rose');
    expect(statusClass('booked')).toContain('blue');
    expect(statusLabel('redeemed')).toBe('encashed');
    expect(statusLabel('booked')).toBe('purchased');
    expect(statusLabel('cancelled')).toBe('Cancelled');
    expect(statusLabel('custom')).toBe('Custom');
    expect(statusLabel('')).toBe('purchased');
    expect(statIconClass('blue')).toContain('#0759e6');
  });

  it('opens a voucher PDF and always clears loading state', async () => {
    const setVoucherLoadingId = vi.fn();
    const setMessage = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['pdf']) })
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(window, 'open').mockImplementation(() => null);
    await openVoucherPdf({
      bookingId: 'booking/1',
      authHeaders: { Authorization: 'Bearer token' },
      setVoucherLoadingId,
      setMessage,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('booking%2F1/voucher'),
      expect.anything()
    );
    expect(window.open).toHaveBeenCalledWith('blob:test', '_blank', 'noopener,noreferrer');
    expect(setVoucherLoadingId).toHaveBeenLastCalledWith('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await openVoucherPdf({
      bookingId: 'booking-2',
      authHeaders: {},
      setVoucherLoadingId,
      setMessage,
    });
    expect(setMessage).toHaveBeenLastCalledWith('Failed to load PDF voucher');
  });

  it('cancels bookings and returns useful API errors', async () => {
    const booking = {
      id: 'b1',
      listingId: 'l1',
      sellerId: 's1',
      status: 'cancelled',
      voucherCode: 'V1',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, booking }) })
    );
    await expect(cancelDealBooking({ bookingId: 'b1', authHeaders: {} })).resolves.toEqual(booking);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'Cannot cancel' }) })
    );
    await expect(cancelDealBooking({ bookingId: 'b2', authHeaders: {} })).rejects.toThrow(
      'Cannot cancel'
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('bad json');
        },
      })
    );
    await expect(cancelDealBooking({ bookingId: 'b3', authHeaders: {} })).rejects.toThrow(
      'Failed to cancel booking'
    );
  });
});
