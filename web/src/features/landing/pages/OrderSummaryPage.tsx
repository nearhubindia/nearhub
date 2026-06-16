import { useMemo, useState, type ReactElement } from 'react';
import { Navigate, Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Package, ShieldCheck, Ticket } from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { trackWebPurchase } from '@/lib/firebase';
import { readStoredWebUser } from '@/lib/web-auth-storage';
import { formatPriceInr, parseMediaList } from '@/features/landing/lib';
type VoucherLinks = { viewUrl?: string; downloadUrl?: string };

type Listing = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  condition?: string;
  location?: string;
  price?: string | number;
  offerPrice?: string | number;
  images?: string[];
  sellerName?: string;
  sellerVerified?: boolean;
  status?: string;
  isActive?: boolean;
  isDeal?: boolean;
  dealStartAt?: string;
  dealEndAt?: string;
  maxDealBookings?: number;
  dealBookingsUsed?: number;
  purchaseLimitType?: string;
};

type DealBooking = {
  listingId?: string;
  status?: string;
};

function toApiAbsoluteUrl(pathOrUrl: string): string {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const base = getApiUrl().replace(/\/$/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base}${path}`;
}

export default function OrderSummaryPage(): ReactElement {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const user = readStoredWebUser();
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();
  const [nowMs] = useState(() => Date.now());
  const [message, setMessage] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [voucherLinks, setVoucherLinks] = useState<VoucherLinks>({});
  const [isVoucherLoading, setIsVoucherLoading] = useState(false);

  const listingQuery = useQuery({
    queryKey: ['order-summary-listing', id, userId],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/listings/${encodeURIComponent(id)}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
          ...(userPhone ? { 'x-user-phone': userPhone } : {}),
        },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load deal');
      const raw = payload.listing || payload.data;
      return {
        ...raw,
        images: parseMediaList(raw?.images),
        isActive: Boolean(raw?.isActive ?? raw?.is_active),
        isDeal: Boolean(raw?.isDeal ?? raw?.is_deal),
        dealStartAt: String(raw?.dealStartAt || raw?.deal_start_at || ''),
        dealEndAt: String(raw?.dealEndAt || raw?.deal_end_at || ''),
        maxDealBookings: Number(raw?.maxDealBookings ?? raw?.max_deal_bookings ?? 0) || 0,
        dealBookingsUsed: Number(raw?.dealBookingsUsed ?? raw?.deal_bookings_used ?? 0) || 0,
        purchaseLimitType: String(raw?.purchaseLimitType || raw?.purchase_limit_type || ''),
      } as Listing;
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ['my-deal-bookings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/deals/my-bookings`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          ...(userPhone ? { 'x-user-phone': userPhone } : {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) return [] as DealBooking[];
      return Array.isArray(payload.bookings) ? (payload.bookings as DealBooking[]) : [];
    },
  });

  const listing = listingQuery.data;
  const finalPrice = useMemo(() => {
    const offer = Number(listing?.offerPrice || 0);
    const base = Number(listing?.price || 0);
    return Number.isFinite(offer) && offer > 0 && offer < base ? offer : base;
  }, [listing?.offerPrice, listing?.price]);
  const dealStart = new Date(String(listing?.dealStartAt || '')).getTime();
  const dealEnd = new Date(String(listing?.dealEndAt || '')).getTime();
  const isWindowValid =
    Number.isFinite(dealStart) && Number.isFinite(dealEnd) && dealEnd > dealStart;
  const isDealActive =
    Boolean(listing?.isDeal) &&
    Boolean(listing?.isActive) &&
    String(listing?.status || '').toLowerCase() === 'active' &&
    isWindowValid &&
    nowMs >= dealStart &&
    nowMs <= dealEnd;
  const slots = Number(listing?.maxDealBookings || 0);
  const used = Number(listing?.dealBookingsUsed || 0);
  const isSoldOut = slots > 0 && used >= slots;
  const purchaseLimitType = String(listing?.purchaseLimitType || '').toUpperCase();
  const hasAlreadyPurchased =
    purchaseLimitType === 'ONE_TIME' &&
    (bookingsQuery.data || []).some(
      (booking) =>
        String(booking.listingId || '') === id &&
        ['booked', 'redeemed'].includes(String(booking.status || '').toLowerCase())
    );
  const oneTimePurchaseMessage =
    'You have already purchased this deal. This offer is limited to one purchase per customer.';

  if (!id) return <Navigate to="/deals" replace />;
  if (!userId) return <Navigate to="/auth/register" replace />;

  const confirmPurchase = async () => {
    if (!listing || !isDealActive || isSoldOut || hasAlreadyPurchased) return;
    setIsPurchasing(true);
    setMessage('');
    try {
      const response = await fetch(`${getApiUrl()}/api/deals/${encodeURIComponent(id)}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-phone': userPhone,
        },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage(String(payload.error || 'Failed to purchase deal'));
        return;
      }
      setMessage('Deal purchased successfully. Your voucher is ready.');
      void trackWebPurchase({
        purchaseType: 'deal',
        transactionId: String(payload.booking?.id || payload.paymentId || id),
        value: Number(listing.offerPrice || listing.price || 0),
        itemId: id,
        itemName: listing.title,
        category: listing.category,
      });
      setVoucherLinks({
        viewUrl: toApiAbsoluteUrl(String(payload.voucherViewUrl || '')),
        downloadUrl: toApiAbsoluteUrl(String(payload.voucherDownloadUrl || '')),
      });
      await queryClient.invalidateQueries({ queryKey: ['listing-details', id, userId] });
      await queryClient.invalidateQueries({ queryKey: ['order-summary-listing', id, userId] });
      await queryClient.invalidateQueries({ queryKey: ['my-deal-bookings', userId] });
    } catch {
      setMessage('Failed to purchase deal. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const fetchVoucherBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url, {
      headers: {
        'x-user-id': userId,
        ...(userPhone ? { 'x-user-phone': userPhone } : {}),
      },
    });
    if (!response.ok) throw new Error('Failed to load PDF voucher');
    return response.blob();
  };

  const openVoucher = async (url: string) => {
    setIsVoucherLoading(true);
    try {
      const blob = await fetchVoucherBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to open PDF voucher');
    } finally {
      setIsVoucherLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active="deals" />
      <main className="w-full px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-[#113965]">Order Summary</h1>
          <Link to={`/listing/${id}`} className="text-sm font-bold text-[#1e5da8] hover:underline">
            Back to Deal
          </Link>
        </div>

        {listingQuery.isLoading ? <p className="text-slate-600">Loading order...</p> : null}
        {listingQuery.isError ? (
          <p className="text-rose-600">Failed to load order summary.</p>
        ) : null}

        {listing ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:w-28">
                  {listing.images?.[0] ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Package size={28} />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#1e5da8]">
                    {listing.category || 'Deal'}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">{listing.title}</h2>
                  <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600">
                    <MapPin size={14} /> {listing.location || 'Nearby'}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Condition: {listing.condition || 'Good'}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">Seller</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-700">
                  {listing.sellerName || 'Seller'}
                  {listing.sellerVerified ? (
                    <ShieldCheck size={15} className="text-emerald-600" />
                  ) : null}
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-900">Deal Window</p>
                <p className="mt-1 text-sm text-amber-800">
                  {isWindowValid
                    ? `${new Date(dealStart).toLocaleString('en-IN')} - ${new Date(dealEnd).toLocaleString('en-IN')}`
                    : 'Deal window is not configured'}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Slots: {used}/{slots || 'NA'}
                </p>
              </div>
            </section>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">Price Details</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Item price</span>
                  <span className="font-bold text-slate-900">{formatPriceInr(listing.price)}</span>
                </div>
                {Number(listing.offerPrice || 0) > 0 &&
                Number(listing.offerPrice) < Number(listing.price || 0) ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Deal discount</span>
                    <span>
                      -
                      {formatPriceInr(Number(listing.price || 0) - Number(listing.offerPrice || 0))}
                    </span>
                  </div>
                ) : null}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900">Total</span>
                    <span className="text-2xl font-black text-[#113965]">
                      {formatPriceInr(finalPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {!isDealActive ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  This deal is not active for purchase right now.
                </p>
              ) : null}
              {isSoldOut ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  This deal is sold out.
                </p>
              ) : null}
              {hasAlreadyPurchased ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {oneTimePurchaseMessage}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void confirmPurchase()}
                disabled={isPurchasing || !isDealActive || isSoldOut || hasAlreadyPurchased}
                className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1e5da8] px-4 text-xs font-black text-white shadow-sm disabled:opacity-60"
              >
                <Ticket size={17} /> {isPurchasing ? 'Purchasing...' : 'Confirm Purchase'}
              </button>

              {message ? (
                <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {message}
                </p>
              ) : null}

              {voucherLinks.viewUrl || voucherLinks.downloadUrl ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-black text-emerald-800">
                    <CheckCircle2 size={16} /> Voucher Ready
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      to="/bookings"
                      className="text-sm font-bold text-[#1e5da8] hover:underline"
                    >
                      View Bookings
                    </Link>
                    {voucherLinks.viewUrl ? (
                      <button
                        type="button"
                        onClick={() => void openVoucher(voucherLinks.viewUrl || '')}
                        disabled={isVoucherLoading}
                        className="text-sm font-bold text-[#1e5da8] hover:underline disabled:opacity-60"
                      >
                        View PDF Voucher
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </main>
      <LandingFooter />
    </div>
  );
}
