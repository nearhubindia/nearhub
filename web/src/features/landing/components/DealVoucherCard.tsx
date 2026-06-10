import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, ExternalLink, ShoppingBag, Ticket } from 'lucide-react';
import {
  formatDateTime,
  parseVoucherPayload,
  statusClass,
  statusLabel,
  type DealBooking,
} from '../lib/deal-bookings';

export function DealVoucherCard({
  booking,
  dateLabel,
  voucherLoadingId,
  onOpenVoucher,
  extraActions,
  emphasis = 'normal',
  accent = 'blue',
}: {
  booking: DealBooking;
  dateLabel: string;
  voucherLoadingId: string;
  onOpenVoucher: (bookingId: string) => void;
  extraActions?: ReactNode;
  emphasis?: 'normal' | 'strong';
  accent?: 'blue' | 'emerald';
}) {
  const voucher = parseVoucherPayload(booking.voucherPayload);
  const isVoucherLoading = voucherLoadingId === booking.id;
  const strong = emphasis === 'strong';
  const headingWeight = strong ? 'font-black' : 'font-normal';
  const bodyWeight = strong ? 'font-semibold' : 'font-normal';
  const labelWeight = strong ? 'font-black' : 'font-normal';
  const cardShadow =
    accent === 'emerald'
      ? 'shadow-[0_18px_40px_-38px_rgba(16,185,129,0.95)]'
      : 'shadow-[0_18px_40px_-38px_rgba(7,89,230,0.95)]';
  const cardBorder = accent === 'emerald' ? 'border-emerald-300' : 'border-[#b9d6ff]';
  const voucherTone = accent === 'emerald' ? 'text-emerald-700' : 'text-[#0759e6]';

  return (
    <article className={`rounded-2xl border ${cardBorder} bg-white px-6 py-6 ${cardShadow}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p
            className={`inline-flex items-center gap-3 text-sm ${labelWeight} uppercase tracking-wide ${voucherTone}`}
          >
            <Ticket size={18} /> Voucher {booking.voucherCode}
          </p>
          <div className="mt-6 flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-[#0759e6]">
              <ShoppingBag size={22} />
            </span>
            <h3 className={`min-w-0 text-xl ${headingWeight} text-[#061b44]`}>
              {voucher.listingTitle || 'Deal product'}
            </h3>
          </div>
          <p className={`mt-5 inline-flex items-center gap-3 text-sm ${bodyWeight} text-[#526985]`}>
            <CalendarDays size={17} /> {dateLabel}{' '}
            {formatDateTime(booking.bookedAt || booking.createdAt || voucher.bookedAt)}
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-5 py-2 text-sm ${labelWeight} ${statusClass(booking.status || 'booked')}`}
        >
          {statusLabel(booking.status || 'booked')}
        </span>
      </div>

      <div className="mt-6 h-px bg-[#dbe7f6]" />

      <div className="mt-6 grid gap-5 text-sm text-[#526985] sm:grid-cols-2">
        <div className="flex gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#0759e6] text-[#0759e6]">
            <Clock size={17} />
          </span>
          <p>
            <span className={`block ${labelWeight} text-[#061b44]`}>Deal starts</span>
            <span className={`mt-1 block ${bodyWeight}`}>
              {formatDateTime(voucher.dealStartAt)}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#0759e6] text-[#0759e6]">
            <Clock size={17} />
          </span>
          <p>
            <span className={`block ${labelWeight} text-[#061b44]`}>Deal ends</span>
            <span className={`mt-1 block ${bodyWeight}`}>{formatDateTime(voucher.dealEndAt)}</span>
          </p>
        </div>
      </div>

      {voucher.comboItems?.length ? (
        <p className="mt-3 text-sm text-slate-700">
          <span className={`${labelWeight} text-slate-900`}>Combo:</span>{' '}
          {voucher.comboItems.join(', ')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to={`/listing/${booking.listingId}`}
          className={`inline-flex h-10 items-center gap-2 rounded-lg border border-[#b9d6ff] bg-white px-4 text-sm ${labelWeight} text-[#0759e6] transition hover:border-[#0759e6]`}
        >
          <ExternalLink size={15} /> View Listing
        </Link>
        <button
          type="button"
          onClick={() => onOpenVoucher(booking.id)}
          disabled={isVoucherLoading}
          className={`inline-flex h-10 items-center gap-2 rounded-lg border border-[#b9d6ff] bg-white px-4 text-sm ${labelWeight} text-[#0759e6] transition hover:border-[#0759e6] disabled:opacity-60`}
        >
          <Ticket size={15} /> View PDF Voucher
        </button>
        {extraActions}
      </div>
    </article>
  );
}
