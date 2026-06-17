import { useMemo, useState, type ReactElement } from 'react';
import { Navigate, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Edit3,
  Eye,
  Heart,
  MapPin,
  ReceiptText,
  Share2,
  Trash2,
  TrendingUp,
  Zap,
  Tag,
} from 'lucide-react';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { readStoredWebUser } from '@/lib/web-auth-storage';
import { getPrimaryListingImage, formatPriceInr, parsePositiveNumber } from '@/features/landing/lib';
import { buildAuthRegisterPath } from '@/lib/auth-redirect';

type StoredUser = { id?: string; phone?: string };

type UserListing = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  price?: number | string;
  offerPrice?: number | string;
  priceUnit?: string;
  location?: { city?: string } | string;
  images?: string[];
  isPaid?: boolean;
  isDeal?: boolean;
  is_deal?: boolean;
  dealType?: string | null;
  deal_type?: string | null;
  dealEndAt?: string | null;
  deal_end_at?: string | null;
  expiresAt?: string;
  createdAt?: string;
  viewCount?: number;
  likeCount?: number;
  saveCount?: number;
  shareCount?: number;
  subscriptionTierId?: string | null;
  durationDays?: number | string | null;
  planName?: string | null;
  planAmount?: number | string | null;
  planDurationDays?: number | string | null;
};

type BoostSummaryResponse = {
  success?: boolean;
  totalBoostCredits?: number;
  starterCredits?: {
    boostsRemaining?: number;
    boostsTotal?: number;
  };
  bySubscription?: Array<{
    subscriptionId?: string;
    boostsRemaining?: number;
    tierName?: string;
  }>;
  error?: string;
};

const FALLBACK_IMAGE = '/nearhub.png';

function formatDate(value?: string): string {
  if (!value) return 'No expiry';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'No expiry';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getPlanDurationDays(item: UserListing): number {
  const value = Number(item.planDurationDays ?? item.durationDays ?? 30);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 30;
}

function getPlanName(item: UserListing): string {
  const name = String(item.planName || '').trim();
  const durationDays = getPlanDurationDays(item);
  if (name) return `${name} ${durationDays} Days`;
  return `${item.isPaid ? 'Premium' : 'Basic'} ${durationDays} Days`;
}

function getPlanAmount(item: UserListing): string {
  const amount = parsePositiveNumber(item.planAmount) || 0;
  if (!item.isPaid || amount <= 0) return 'Free';
  return formatPriceInr(amount);
}

function timeAgo(value?: string): string {
  if (!value) return 'recently';
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return 'recently';
  const diffDays = Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
  if (diffDays === 0) return 'today';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function getLocationLabel(location: UserListing['location']): string {
  if (typeof location === 'string') return location || 'Location unavailable';
  return location?.city || 'Location unavailable';
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function isDeal(item: UserListing): boolean {
  return Boolean(item.isDeal ?? item.is_deal);
}

function getDealLabel(item: UserListing): string | null {
  if (!isDeal(item)) return null;
  const type = String(item.dealType || item.deal_type || '').toLowerCase();
  return type === 'combo' ? 'Combo Deal' : 'Deal';
}

function getDealEndMs(item: UserListing): number {
  const value = String(item.dealEndAt || item.deal_end_at || '').trim();
  if (!value) return Number.POSITIVE_INFINITY;
  const endMs = new Date(value).getTime();
  return Number.isFinite(endMs) ? endMs : Number.POSITIVE_INFINITY;
}

function isAddToDealDisabled(item: UserListing): boolean {
  return isDeal(item) && Date.now() < getDealEndMs(item);
}

function isDealExpired(item: UserListing): boolean {
  const endMs = getDealEndMs(item);
  return isDeal(item) && Number.isFinite(endMs) && Date.now() >= endMs;
}

function isSold(item: UserListing): boolean {
  return String(item.status || '').toLowerCase() === 'sold';
}

function statusLabel(item: UserListing): string {
  if (isSold(item)) return 'Sold';
  if (isDealExpired(item)) return 'Deal Expired';
  if (isExpired(item.expiresAt)) return 'Expired';
  return String(item.status || 'active');
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

async function readActionResponse(
  response: Response
): Promise<{ success?: boolean; error?: string; message?: string }> {
  return (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    message?: string;
  };
}

export default function MyListingsPage(): ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'pending' | 'rejected' | 'sold' | 'expired'
  >('all');
  const [message, setMessage] = useState('');
  const storedUser = readStoredWebUser() as StoredUser | null;
  const userId = String(storedUser?.id || '').trim();
  const userPhone = String(storedUser?.phone || '').trim();
  const requestedDealType =
    searchParams.get('dealType')?.toLowerCase() === 'combo'
      ? 'combo'
      : searchParams.has('dealType')
        ? 'normal'
        : null;
  const requestedDealLabel = requestedDealType === 'combo' ? 'Combo Deal' : 'Deal';

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', 'x-user-id': userId, 'x-user-phone': userPhone }),
    [userId, userPhone]
  );

  const listingsQuery = useQuery({
    queryKey: ['my-listings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/users/${encodeURIComponent(userId)}/listings`,
        { headers }
      );
      if (!response.ok) throw new Error('Failed to load listings');
      const payload = (await response.json()) as { listings?: UserListing[] };
      return payload.listings || [];
    },
  });
  const boostSummaryQuery = useQuery({
    queryKey: ['boost-summary', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/subscriptions/boost/summary`, { headers });
      const payload = (await response.json()) as BoostSummaryResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to load boost summary');
      }
      return payload;
    },
  });

  const refreshListings = async () => {
    await queryClient.invalidateQueries({ queryKey: ['my-listings', userId] });
  };

  const refreshPublicListingFeeds = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['public-listings'] }),
      queryClient.invalidateQueries({ queryKey: ['nearhub-home-feed'] }),
      queryClient.invalidateQueries({ queryKey: ['deals-page-listings'] }),
      queryClient.invalidateQueries({ queryKey: ['saved-listings-source'] }),
    ]);
  };

  const markSoldMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(`${getApiUrl()}/api/listings/${encodeURIComponent(listingId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'sold', isActive: false, is_active: false }),
      });
      const payload = await readActionResponse(response);
      if (!response.ok || payload.success === false)
        throw new Error(payload.error || 'Failed to mark listing sold');
    },
    onSuccess: async (_data, listingId) => {
      setMessage('Listing marked as sold.');
      queryClient.setQueryData<UserListing[]>(['my-listings', userId], (current) =>
        (current || []).map((item) => (item.id === listingId ? { ...item, status: 'sold' } : item))
      );
      await Promise.all([refreshListings(), refreshPublicListingFeeds()]);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : 'Failed to mark listing sold.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(`${getApiUrl()}/api/listings/${encodeURIComponent(listingId)}`, {
        method: 'DELETE',
        headers,
      });
      const payload = await readActionResponse(response);
      if (!response.ok || payload.success === false)
        throw new Error(payload.error || 'Failed to delete listing');
    },
    onSuccess: async () => {
      setMessage('Listing deleted.');
      await refreshListings();
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : 'Failed to delete listing.'),
  });

  const boostMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(
        `${getApiUrl()}/api/subscriptions/listings/${encodeURIComponent(listingId)}/boost`,
        {
          method: 'POST',
          headers,
        }
      );
      const payload = await readActionResponse(response);
      if (!response.ok || payload.success === false)
        throw new Error(payload.error || 'Failed to boost listing');
    },
    onSuccess: async () => {
      setMessage('Listing boosted for 24 hours.');
      await Promise.all([
        refreshListings(),
        refreshPublicListingFeeds(),
        queryClient.invalidateQueries({ queryKey: ['boost-summary', userId] }),
      ]);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : 'Failed to boost listing.'),
  });

  if (!userId)
    return <Navigate to={buildAuthRegisterPath(location.pathname, location.search)} replace />;

  const listings = listingsQuery.data || [];
  const boostSummary = boostSummaryQuery.data;
  const totalBoostCredits = Number(boostSummary?.totalBoostCredits || 0);
  const starterBoostCredits = Number(boostSummary?.starterCredits?.boostsRemaining || 0);
  const counts = {
    active: listings.filter((l) => l.status === 'active' && !isExpired(l.expiresAt)).length,
    pending: listings.filter((l) => l.status === 'pending').length,
    rejected: listings.filter((l) => l.status === 'rejected').length,
    sold: listings.filter((l) => l.status === 'sold').length,
    expired: listings.filter((l) => isExpired(l.expiresAt)).length,
  };

  const filtered = listings.filter((item) => {
    if (statusFilter === 'sold') return item.status === 'sold';
    if (statusFilter === 'expired') return isExpired(item.expiresAt);
    if (statusFilter === 'all') return item.status !== 'sold';
    return item.status === statusFilter;
  });

  const handleDelete = (listing: UserListing) => {
    const ok = window.confirm(`Delete "${listing.title}"? This cannot be undone.`);
    if (!ok) return;
    deleteMutation.mutate(listing.id);
  };

  const isBusy = markSoldMutation.isPending || deleteMutation.isPending || boostMutation.isPending;
  const hasBoostCredits =
    boostSummaryQuery.isError || boostSummaryQuery.isLoading || totalBoostCredits > 0;

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <LandingHeader active="browse" />
      <main className="px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_14px_42px_-32px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-black text-[#113965]">My Listings</h1>
            <Link to="/search" className="text-xs font-black text-[#1e5da8] hover:underline">
              Back to Browse
            </Link>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {[
              { key: 'active', label: 'Active', value: counts.active },
              { key: 'pending', label: 'Pending', value: counts.pending },
              { key: 'rejected', label: 'Rejected', value: counts.rejected },
              { key: 'sold', label: 'Sold', value: counts.sold },
              { key: 'expired', label: 'Expired', value: counts.expired },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key as typeof statusFilter)}
                className={classNames(
                  'rounded-lg border px-3 py-2 text-left transition',
                  statusFilter === item.key
                    ? 'border-[#1e5da8] bg-[#f3f8ff]'
                    : 'border-slate-200 bg-white hover:border-[#1e5da8]/60'
                )}
              >
                <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                <p className="text-xl font-black leading-none text-[#113965]">{item.value}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-black text-emerald-800">
                  <Zap size={16} /> Boost Credits
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-700/90">
                  Starter boosts are used first, then your active subscription boosts.
                </p>
              </div>
              <Link
                to="/subscriptions"
                className="inline-flex h-9 items-center rounded-full border border-emerald-200 bg-white px-4 text-xs font-black text-emerald-800"
              >
                View Subscriptions
              </Link>
            </div>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-emerald-800 sm:grid-cols-2">
              <p>Total boost credits: {boostSummaryQuery.isLoading ? '...' : totalBoostCredits}</p>
              <p>
                Starter boosts remaining:{' '}
                {boostSummaryQuery.isLoading ? '...' : starterBoostCredits}
              </p>
            </div>
            {boostSummaryQuery.isError ? (
              <p className="mt-2 text-xs font-semibold text-rose-700">
                Unable to load boost summary right now.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mx-auto mt-7 max-w-[1500px]">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">My Listings</h2>
          {message ? (
            <p className="mt-3 rounded-md bg-[#eef6ff] px-4 py-2 text-sm font-bold text-[#1e5da8]">
              {message}
            </p>
          ) : null}
          {listingsQuery.isLoading ? (
            <p className="mt-5 text-sm font-semibold text-slate-600">Loading listings...</p>
          ) : null}
          {listingsQuery.isError ? (
            <p className="mt-5 text-sm font-semibold text-red-600">Failed to load your listings.</p>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((item) => {
              const dealLabel = getDealLabel(item);
              const badge = statusLabel(item);
              const originalPrice = parsePositiveNumber(item.price) || 0;
              const displayPrice = item.offerPrice
                ? parsePositiveNumber(item.offerPrice) || 0
                : originalPrice;
              const showOriginal = displayPrice > 0 && originalPrice > displayPrice;
              const image = getPrimaryListingImage(item);
              const views = Number(item.viewCount || 0);
              const likes = Number(item.likeCount ?? item.saveCount ?? 0);
              const shares = Number(item.shareCount || 0);
              const sold = isSold(item);
              const listingLocked = sold;
              const addToDealDisabled = listingLocked || isAddToDealDisabled(item);

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Link
                    to={`/listing/${encodeURIComponent(item.id)}`}
                    className="relative block aspect-[1.28] overflow-hidden bg-slate-100"
                  >
                    <img
                      src={image}
                      alt={item.title}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                    {dealLabel ? (
                      <span className="absolute left-3 top-3 rounded-md bg-[#020922] px-2.5 py-1.5 text-[11px] font-black uppercase text-white">
                        {dealLabel}
                      </span>
                    ) : null}
                  </Link>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-md bg-[#f4f1fa] px-2.5 py-1 text-[11px] font-black uppercase text-[#020922]">
                        {badge}
                      </span>
                      <span className="text-xs font-bold text-[#6c3a89]">
                        {item.isPaid ? 'Premium' : 'Free'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-baseline gap-2">
                      <span className="text-xl font-black leading-none text-[#11152b]">
                        {formatPriceInr(displayPrice || item.price)}
                      </span>
                      {showOriginal ? (
                        <span className="text-sm font-bold text-slate-400 line-through">
                          {formatPriceInr(originalPrice)}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-2 line-clamp-2 min-h-9 text-sm font-black leading-snug text-[#11152b]">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <MapPin size={14} /> {getLocationLabel(item.location)} •{' '}
                      {timeAgo(item.createdAt)}
                    </p>

                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                      <div className="flex justify-between gap-3 text-slate-500">
                        <span>Plan</span>
                        <span className="font-bold text-slate-950">{getPlanName(item)}</span>
                      </div>
                      <div className="mt-2 flex justify-between gap-3 text-slate-500">
                        <span>Amount</span>
                        <span className="font-bold text-slate-950">{getPlanAmount(item)}</span>
                      </div>
                      <div className="mt-2 flex justify-between gap-3 text-slate-500">
                        <span>Expiry</span>
                        <span className="font-bold text-slate-950">
                          {formatDate(item.expiresAt)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 rounded-lg bg-[#faf8ff] px-2 py-1.5 text-xs text-slate-600">
                      <span className="flex items-center justify-center gap-1 border-r border-slate-200">
                        <Eye size={15} /> <b className="text-slate-950">{views}</b> Views
                      </span>
                      <span className="flex items-center justify-center gap-1 border-r border-slate-200">
                        <Heart size={15} /> <b className="text-slate-950">{likes}</b> Likes
                      </span>
                      <span className="flex items-center justify-center gap-1">
                        <Share2 size={15} /> <b className="text-slate-950">{shares}</b> Shares
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        type="button"
                        onClick={() => boostMutation.mutate(item.id)}
                        disabled={listingLocked || isBusy || badge !== 'active' || !hasBoostCredits}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <TrendingUp size={17} /> Boost Listing
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/edit-listing/${encodeURIComponent(item.id)}`)}
                        disabled={listingLocked}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-950 transition hover:border-[#1e5da8] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <Edit3 size={17} /> Edit
                      </button>
                    </div>

                    {dealLabel ? (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/deal-inbox?listingId=${encodeURIComponent(item.id)}`)
                          }
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          <ReceiptText size={17} /> View Purchases
                        </button>
                      </div>
                    ) : null}
                    {!hasBoostCredits ? (
                      <p className="mt-2 text-xs font-semibold text-amber-700">
                        No boost credits remaining. Open subscriptions to purchase more boost packs.
                      </p>
                    ) : null}

                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => markSoldMutation.mutate(item.id)}
                        disabled={listingLocked || isBusy || badge.toLowerCase() === 'sold'}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0b66e4] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#0758c9] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <CheckCircle2 size={17} /> Mark Sold
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={listingLocked || isBusy}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f4213a] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#d91d33] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <Trash2 size={17} /> Delete
                      </button>
                    </div>

                    {requestedDealType ? (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/create-listing?mode=deal&dealType=${requestedDealType}&sourceListing=${encodeURIComponent(item.id)}`
                            )
                          }
                          disabled={addToDealDisabled}
                          title={
                            addToDealDisabled
                              ? 'This product already has an active deal.'
                              : undefined
                          }
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#11152b] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#202849] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                        >
                          <Tag size={17} /> Select for {requestedDealLabel}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/create-listing?mode=deal&dealType=normal&sourceListing=${encodeURIComponent(item.id)}`
                            )
                          }
                          disabled={addToDealDisabled}
                          title={
                            addToDealDisabled
                              ? 'This product already has an active deal.'
                              : undefined
                          }
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#11152b] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#202849] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                        >
                          <Tag size={17} /> Deal
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/create-listing?mode=deal&dealType=combo&sourceListing=${encodeURIComponent(item.id)}`
                            )
                          }
                          disabled={addToDealDisabled}
                          title={
                            addToDealDisabled
                              ? 'This product already has an active deal.'
                              : undefined
                          }
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#11152b] bg-white px-3 text-xs font-black text-[#11152b] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:shadow-none"
                        >
                          <Tag size={17} /> Combo Deal
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {!listingsQuery.isLoading && filtered.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-600">
              No listings found for this filter.
            </div>
          ) : null}
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
