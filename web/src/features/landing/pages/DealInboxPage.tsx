import { useMemo, useState, type ReactElement } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarX2,
  Clock,
  ExternalLink,
  CheckCircle2,
  Inbox,
  Package,
  ReceiptText,
  ShoppingBag,
} from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { DealStatsGrid } from '../components/DealStatsGrid';
import { DealVoucherCard } from '../components/DealVoucherCard';
import {
  apiUrl,
  openVoucherPdf,
  readStoredUser,
  type DealBooking,
} from '../lib/deal-bookings';

type DealListing = {
  id: string;
  isDeal?: boolean;
  is_deal?: boolean;
};

type ListingsResponse = {
  success?: boolean;
  error?: string;
  data?: DealListing[];
  results?: DealListing[];
};

export default function DealInboxPage(): ReactElement {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const scopedListingId = String(searchParams.get('listingId') || '').trim();
  const user = readStoredUser();
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();
  const [message, setMessage] = useState('');
  const [voucherLoadingId, setVoucherLoadingId] = useState('');

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(userPhone ? { 'x-user-phone': userPhone } : {}),
    }),
    [userId, userPhone]
  );

  const dealBookingsQuery = useQuery({
    queryKey: ['seller-deal-bookings', userId, scopedListingId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const sellerResponse = await fetch(apiUrl('/api/deals/seller/bookings'), {
        headers: authHeaders,
      });
      const sellerPayload = await sellerResponse.json().catch(() => ({}));
      if (sellerResponse.ok && sellerPayload.success) {
        return (sellerPayload.bookings || []) as DealBooking[];
      }

      if (scopedListingId) {
        const response = await fetch(
          apiUrl(`/api/deals/listing/${encodeURIComponent(scopedListingId)}/bookings`),
          { headers: authHeaders },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || sellerPayload.error || 'Failed to load purchased deals');
        }
        return (payload.bookings || []) as DealBooking[];
      }

      const listingsResponse = await fetch(
        apiUrl(`/api/listings?limit=500&userId=${encodeURIComponent(userId)}&dealsOnly=1&includeExpiredDeals=1`),
        { headers: authHeaders },
      );
      const listingsPayload = (await listingsResponse.json().catch(() => ({}))) as ListingsResponse;
      if (!listingsResponse.ok || listingsPayload.success === false) {
        throw new Error(sellerPayload.error || listingsPayload.error || 'Failed to load purchased deals');
      }
      const sellerDealListings = (listingsPayload.data || listingsPayload.results || []).filter((listing) =>
        Boolean(listing.isDeal ?? listing.is_deal),
      );
      if (sellerDealListings.length === 0) return [];

      const bookingGroups = await Promise.all(
        sellerDealListings.map(async (listing) => {
          const response = await fetch(
            apiUrl(`/api/deals/listing/${encodeURIComponent(listing.id)}/bookings`),
            { headers: authHeaders },
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.success) return [];
          return (payload.bookings || []) as DealBooking[];
        }),
      );

      return bookingGroups
        .flat()
        .sort(
          (a, b) =>
            new Date(b.bookedAt || b.createdAt || 0).getTime() -
            new Date(a.bookedAt || a.createdAt || 0).getTime(),
        );
    },
  });

  const markEncashedMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const response = await fetch(apiUrl(`/api/deals/bookings/${encodeURIComponent(bookingId)}/status`), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ status: 'encashed' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to mark deal encashed');
      }
      return payload;
    },
    onSuccess: async () => {
      setMessage('Deal marked as encashed.');
      await queryClient.invalidateQueries({ queryKey: ['seller-deal-bookings', userId] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Failed to mark deal encashed');
    },
  });

  if (!userId) return <Navigate to="/auth/register" replace />;

  const openVoucher = async (bookingId: string) => {
    await openVoucherPdf({ bookingId, authHeaders, setVoucherLoadingId, setMessage });
  };

  const allDealBookings = dealBookingsQuery.data || [];
  const dealBookings = scopedListingId
    ? allDealBookings.filter((booking) => String(booking.listingId) === scopedListingId)
    : allDealBookings;
  const stats = {
    total: dealBookings.length,
    encashed: dealBookings.filter((booking) => String(booking.status || '').toLowerCase() === 'redeemed').length,
    pending: dealBookings.filter((booking) => String(booking.status || 'booked').toLowerCase() === 'booked').length,
    expired: dealBookings.filter((booking) => String(booking.status || '').toLowerCase() === 'expired').length,
  };
  const statCards = [
    {
      label: 'Total Purchases',
      value: stats.total,
      caption: 'All time purchases',
      icon: ShoppingBag,
      tone: 'blue' as const,
    },
    {
      label: 'Encashed',
      value: stats.encashed,
      caption: 'Successfully encashed',
      icon: CheckCircle2,
      tone: 'emerald' as const,
    },
    {
      label: 'Pending',
      value: stats.pending,
      caption: 'Not yet encashed',
      icon: Clock,
      tone: 'amber' as const,
    },
    {
      label: 'Expired',
      value: stats.expired,
      caption: 'Deal expired',
      icon: CalendarX2,
      tone: 'rose' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf6ff_56%,#ffffff_100%)] text-[#08244d]">
      <LandingHeader active="deals" />
      <main className="mx-auto max-w-[1170px] px-4 pb-14 pt-28 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] border border-[#b9d6ff] bg-white px-6 py-8 shadow-[0_26px_70px_-44px_rgba(30,93,168,0.72)] sm:px-10 lg:px-11">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#0759e6]">
                <Inbox size={17} /> Seller Deal Tracking
              </p>
              <h1 className="mt-7 text-4xl font-black tracking-tight text-[#0b2a55] sm:text-5xl">
                Deals Purchased
              </h1>
              <p className="mt-6 max-w-2xl text-base font-semibold leading-7 text-[#445a78]">
                Buyer purchases and voucher redemption status appear here after checkout.
              </p>
              {scopedListingId ? (
                <Link
                  to="/deal-inbox"
                  className="mt-4 inline-flex text-sm font-black text-[#0759e6] hover:underline"
                >
                  View all purchased deals
                </Link>
              ) : null}
            </div>

            <div className="relative hidden min-h-[170px] lg:block">
              <Link
                to="/deals"
                className="absolute right-0 top-0 inline-flex h-12 items-center gap-2 rounded-xl border border-[#c8dbf8] bg-white px-5 text-sm font-black text-[#0759e6] shadow-sm transition hover:border-[#0759e6]"
              >
                Browse Deals <ExternalLink size={16} />
              </Link>
              <div className="absolute bottom-0 right-20 h-28 w-28 rounded-[32px] bg-gradient-to-br from-[#6ea6ff] to-[#9bc4ff] shadow-[0_20px_38px_-26px_rgba(7,89,230,0.8)]">
                <div className="absolute -top-6 left-8 h-12 w-11 rounded-t-3xl border-[6px] border-[#78aaf5] border-b-0 bg-transparent" />
                <div className="absolute -right-5 bottom-1 grid h-14 w-14 place-items-center rounded-full bg-emerald-400 text-white shadow-lg ring-4 ring-white">
                  <CheckCircle2 size={30} />
                </div>
              </div>
              <div className="absolute bottom-4 right-0 h-36 w-28 rounded-xl border-4 border-[#b7d4ff] bg-[#edf5ff] shadow-sm">
                <div className="absolute -top-5 left-1/2 h-8 w-16 -translate-x-1/2 rounded-t-2xl border-4 border-[#b7d4ff] bg-[#dcecff]" />
                <div className="mx-auto mt-7 h-2 w-16 rounded-full bg-[#c7dfff]" />
                <div className="mx-auto mt-3 h-2 w-14 rounded-full bg-[#c7dfff]" />
                <div className="mx-auto mt-3 h-2 w-16 rounded-full bg-[#c7dfff]" />
              </div>
              <span className="absolute bottom-10 left-10 text-2xl font-black text-[#a7c9ff]">*</span>
              <span className="absolute right-2 top-20 text-2xl font-black text-[#a7c9ff]">*</span>
            </div>
          </div>
        </section>

        <DealStatsGrid cards={statCards} emphasis="strong" />

        {message ? (
          <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm">
            {message}
          </p>
        ) : null}

        <section className="mt-9 rounded-[24px] border border-[#d9e7f8] bg-white/86 p-6 shadow-[0_24px_70px_-48px_rgba(30,93,168,0.88)] sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-3 text-2xl font-black text-[#061b44]">
              <ReceiptText size={26} /> Purchased Deal Products
            </h2>
            <span className="rounded-full border border-[#b9d6ff] bg-white px-6 py-2 text-sm font-black text-[#0759e6]">
              {dealBookings.length} purchases
            </span>
          </div>

          {dealBookingsQuery.isLoading ? (
            <p className="rounded-2xl border border-[#d9e7f8] bg-white px-4 py-6 text-sm font-semibold text-[#5d718f]">
              Loading purchased deals...
            </p>
          ) : null}
          {dealBookingsQuery.isError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm font-semibold text-rose-700">
              Failed to load purchased deals.
            </p>
          ) : null}
          {!dealBookingsQuery.isLoading && dealBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#c7d9f0] bg-white px-5 py-10 text-center">
              <Package className="mx-auto text-slate-400" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-700">
                {scopedListingId
                  ? 'No buyer purchases for this deal yet. The encash option appears after a buyer purchases it.'
                  : 'No purchased deals yet. Buyer purchases will appear here.'}
              </p>
            </div>
          ) : null}

          <div className="space-y-5">
            {dealBookings.map((booking) => {
              const normalizedStatus = String(booking.status || 'booked').toLowerCase();
              const isEncashed = normalizedStatus === 'redeemed';
              const canMarkEncashed = normalizedStatus === 'booked';
              const isUpdating = markEncashedMutation.isPending && markEncashedMutation.variables === booking.id;
              return (
                <DealVoucherCard
                  key={booking.id}
                  booking={booking}
                  dateLabel="Ordered"
                  voucherLoadingId={voucherLoadingId}
                  onOpenVoucher={(bookingId) => void openVoucher(bookingId)}
                  emphasis="strong"
                  accent="emerald"
                  extraActions={
                    <button
                      type="button"
                      onClick={() => markEncashedMutation.mutate(booking.id)}
                      disabled={!canMarkEncashed || isUpdating}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-black text-emerald-700 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-75"
                    >
                      <CheckCircle2 size={15} /> {isEncashed ? 'Encashed' : isUpdating ? 'Marking...' : 'Mark Encashed'}
                    </button>
                  }
                />
              );
            })}
          </div>
          {!dealBookingsQuery.isLoading && dealBookings.length > 0 ? (
            <p className="mt-7 text-center text-sm font-medium text-[#5d718f]">
              Showing all purchased deals
            </p>
          ) : null}
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
