import type { DealTimingInput } from '@/lib/deal-timer';
import { isDealExpiredWithinWindow } from '@/lib/deal-timer';

export type DealVisibilityListingLike = DealTimingInput & {
  isDeal?: boolean | null;
  is_deal?: boolean | null;
  dealStatus?: string | null;
  deal_status?: string | null;
  status?: string | null;
  dealCycleQuantity?: number | string | null;
  deal_cycle_quantity?: number | string | null;
  maxDealBookings?: number | string | null;
  max_deal_bookings?: number | string | null;
  dealBookingsUsed?: number | string | null;
  deal_bookings_used?: number | string | null;
};

function parseCompletionNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isDeal(item: DealVisibilityListingLike): boolean {
  return Boolean(item.isDeal ?? item.is_deal);
}

function isDealStockCompleted(input: DealVisibilityListingLike): boolean {
  const maxSlots =
    parseCompletionNumber(input.dealCycleQuantity ?? input.deal_cycle_quantity) ||
    parseCompletionNumber(input.maxDealBookings ?? input.max_deal_bookings);
  const usedSlots = parseCompletionNumber(input.dealBookingsUsed ?? input.deal_bookings_used);
  return maxSlots > 0 && usedSlots >= maxSlots;
}

function isDealMarkedCompleted(input: DealVisibilityListingLike): boolean {
  const status = String(input.dealStatus ?? input.deal_status ?? input.status ?? '').toLowerCase();
  return [
    'completed',
    'complete',
    'closed',
    'expired',
    'sold_out',
    'sold-out',
    'stock_completed',
  ].includes(status);
}

export function isDealCompleted(input: DealVisibilityListingLike, nowMs: number): boolean {
  return (
    isDealExpiredWithinWindow(input, nowMs) || isDealStockCompleted(input) || isDealMarkedCompleted(input)
  );
}

export function isDealAvailableForDealSections(
  input: DealVisibilityListingLike,
  nowMs: number
): boolean {
  return isDeal(input) && !isDealCompleted(input, nowMs);
}
