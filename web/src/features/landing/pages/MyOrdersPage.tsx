import { useMemo, useState, type ReactElement } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarX2,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Package,
  ReceiptText,
  ShoppingBag,
  Ticket,
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

export default function MyOrdersPage(): ReactElement {
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

  const ordersQuery = useQuery({
    queryKey: ['my-deal-bookings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(apiUrl('/api/deals/my-bookings'), {
        headers: authHeaders,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to load bookings');
      }
      return (payload.bookings || []) as DealBooking[];
    },
  });

  if (!userId) return <Navigate to="/auth/register" replace />;

  const openVoucher = async (bookingId: string) => {
    await openVoucherPdf({ bookingId, authHeaders, setVoucherLoadingId, setMessage });
  };

  const orders = ordersQuery.data || [];
  const stats = {
    total: orders.length,
    active: orders.filter((order) => String(order.status || 'booked').toLowerCase() === 'booked').length,
    encashed: orders.filter((order) => String(order.status || '').toLowerCase() === 'redeemed').length,
    expired: orders.filter((order) => String(order.status || '').toLowerCase() === 'expired').length,
  };
  const statCards = [
    {
      label: 'Total Bookings',
      value: stats.total,
      caption: 'All time bookings',
      icon: ShoppingBag,
      tone: 'blue' as const,
    },
    {
      label: 'Active',
      value: stats.active,
      caption: 'Ready to use',
      icon: Ticket,
      tone: 'amber' as const,
    },
    {
      label: 'Encashed',
      value: stats.encashed,
      caption: 'Successfully encashed',
      icon: CheckCircle2,
      tone: 'emerald' as const,
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
              <p className="inline-flex items-center gap-2 text-sm font-normal uppercase tracking-wide text-[#0759e6]">
                <Inbox size={17} /> Buyer Deal Bookings
              </p>
              <h1 className="mt-7 text-4xl font-semibold tracking-tight text-[#0b2a55] sm:text-5xl">
                My Bookings
              </h1>
              <p className="mt-6 max-w-2xl text-base font-normal leading-7 text-[#445a78]">
                Your purchased deal vouchers and redemption status appear here after checkout.
              </p>
            </div>

            <div className="relative hidden min-h-[170px] lg:block">
              <Link
                to="/deals"
                className="absolute right-0 top-0 inline-flex h-12 items-center gap-2 rounded-xl border border-[#c8dbf8] bg-white px-5 text-sm font-normal text-[#0759e6] shadow-sm transition hover:border-[#0759e6]"
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
              <span className="absolute bottom-10 left-10 text-2xl font-normal text-[#a7c9ff]">*</span>
              <span className="absolute right-2 top-20 text-2xl font-normal text-[#a7c9ff]">*</span>
            </div>
          </div>
        </section>

        <DealStatsGrid cards={statCards} />

        {message ? (
          <p className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-700 shadow-sm">
            {message}
          </p>
        ) : null}

        <section className="mt-9 rounded-[24px] border border-[#d9e7f8] bg-white/86 p-6 shadow-[0_24px_70px_-48px_rgba(30,93,168,0.88)] sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="inline-flex items-center gap-3 text-2xl font-normal text-[#061b44]">
                <ReceiptText size={26} /> Booked Deal Products
              </h2>
              <span className="rounded-full border border-[#b9d6ff] bg-white px-6 py-2 text-sm font-normal text-[#0759e6]">
                {orders.length} bookings
              </span>
            </div>

            {ordersQuery.isLoading ? (
              <p className="rounded-2xl border border-[#d9e7f8] bg-white px-4 py-6 text-sm font-normal text-[#5d718f]">
                Loading bookings...
              </p>
            ) : null}
            {ordersQuery.isError ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm font-normal text-rose-700">
                Failed to load bookings.
              </p>
            ) : null}
            {!ordersQuery.isLoading && orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#c7d9f0] bg-white px-5 py-10 text-center">
                <Package className="mx-auto text-slate-400" size={32} />
                <p className="mt-3 text-sm font-normal text-slate-700">No deal bookings yet.</p>
              </div>
            ) : null}

            <div className="space-y-5">
              {orders.map((order) => (
                <DealVoucherCard
                  key={order.id}
                  booking={order}
                  dateLabel="Booked"
                  voucherLoadingId={voucherLoadingId}
                  onOpenVoucher={(bookingId) => void openVoucher(bookingId)}
                />
              ))}
            </div>
            {!ordersQuery.isLoading && orders.length > 0 ? (
              <p className="mt-7 text-center text-sm font-normal text-[#5d718f]">
                Showing all booked deals
              </p>
            ) : null}
          </section>
      </main>
      <LandingFooter />
    </div>
  );
}
