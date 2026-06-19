import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeIndianRupee,
  CalendarDays,
  MapPin,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { readStoredWebUser, type StoredWebUser } from '@/lib/web-auth-storage';
import { buildAuthRegisterPath } from '@/lib/auth-redirect';

type StoredUser = StoredWebUser;

type UserSubscription = {
  id: string;
  status: 'active' | 'pending' | 'expired' | 'cancelled' | string;
  expiresAt: string;
  subscribedAt?: string;
  paymentId?: string | null;
  boostsRemaining?: number;
  listingsUsed?: number;
  tier?: {
    name?: string;
    type?: string;
    price?: string | number;
    offerPrice?: string | number | null;
    durationDays?: number;
    maxListings?: number;
    boostCredits?: number;
    features?: string[];
  } | null;
};

type SubscriptionTier = {
  id: string;
  name: string;
  type?: string;
  price: string | number;
  offerPrice?: string | number | null;
  durationDays: number;
  maxListings: number;
  boostCredits?: number;
  features?: string[];
  highlight?: boolean;
};

type StarterCredits = {
  isActive: boolean;
  listingsTotal: number;
  listingsUsed: number;
  listingsRemaining: number;
  boostsTotal: number;
  boostsUsed: number;
  boostsRemaining: number;
};

type SubscriptionsApiResponse = {
  success?: boolean;
  data?: UserSubscription[];
  starterCredits?: StarterCredits;
  error?: string;
};

type SubscriptionTiersResponse = {
  success?: boolean;
  tiers?: SubscriptionTier[];
  error?: string;
};

type DisplaySubscription = {
  id: string;
  title: string;
  price: number;
  durationDays: number;
  maxListings: number;
  listingsUsed: number;
  boostsRemaining: number;
  status: 'active' | 'expired' | 'cancelled' | string;
  startDate?: string;
  expiresAt: string;
  paymentId?: string | null;
};

type ActiveSubscriptionGroup = {
  key: string;
  tierId: string;
  tierName: string;
  tierPrice: number;
  durationDays: number;
  count: number;
  totalUsed: number;
  totalAvailable: number;
  totalLimit: number;
  shortestExpiryDays: number;
  latestExpiryAt: Date;
  hasUnlimited: boolean;
  boostEntitlement: number;
  totalBoostsRemaining: number;
  subscriptions: UserSubscription[];
};

type LocationHint = {
  city?: string;
  state?: string;
  pincode?: string;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function getPlanPrice(tier: SubscriptionTier): number {
  const offerPrice = Number(tier.offerPrice);
  const regularPrice = Number(tier.price || 0);
  return Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < regularPrice
    ? offerPrice
    : regularPrice;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isMeaningfulText(value: unknown): boolean {
  return typeof value === 'string' && Boolean(value.trim());
}

export default function SubscriptionsPage(): ReactElement {
  const location = useLocation();
  const user = readStoredWebUser() as StoredUser | null;
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();
  const [couponByTierId, setCouponByTierId] = useState<Record<string, string>>({});
  const [checkoutTierId, setCheckoutTierId] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [selectedActiveSubscriptionId, setSelectedActiveSubscriptionId] = useState('');
  const [defaultActiveSubscriptionId, setDefaultActiveSubscriptionId] = useState('');
  const [locationHint, setLocationHint] = useState<LocationHint | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );

  const subscriptionsQuery = useQuery({
    queryKey: ['user-subscriptions', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/subscriptions`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-phone': userPhone,
        },
      });
      const payload = (await response.json()) as SubscriptionsApiResponse;
      if (!response.ok) throw new Error(payload.error || 'Failed to load subscriptions');
      return payload;
    },
  });

  const tiersQuery = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/subscriptions/tiers`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = (await response.json()) as SubscriptionTiersResponse;
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Failed to load plans');
      return payload;
    },
  });

  const subscriptions: DisplaySubscription[] = useMemo(
    () =>
      (subscriptionsQuery.data?.data || []).map((item) => ({
        id: item.id,
        title: item.tier?.name || 'Subscription Plan',
        price: Number(item.tier?.offerPrice || item.tier?.price || 0),
        durationDays: Number(item.tier?.durationDays || 0),
        maxListings: Number(item.tier?.maxListings || 0),
        listingsUsed: Number(item.listingsUsed || 0),
        boostsRemaining: Number(item.boostsRemaining || 0),
        status: item.status,
        startDate: item.subscribedAt,
        expiresAt: item.expiresAt,
        paymentId: item.paymentId,
      })),
    [subscriptionsQuery.data?.data]
  );
  const starterCredits = subscriptionsQuery.data?.starterCredits;
  const availablePlans = useMemo(
    () =>
      (tiersQuery.data?.tiers || []).filter((tier) => String(tier.type || 'bundle') !== 'boost'),
    [tiersQuery.data?.tiers]
  );

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'active').length;
    const expired = subscriptions.filter((s) => s.status === 'expired').length;
    const totalValue = subscriptions.reduce((sum, s) => sum + Number(s.price || 0), 0);
    return { active, expired, total: subscriptions.length, totalValue };
  }, [subscriptions]);
  const rawSubscriptions = subscriptionsQuery.data?.data || [];

  const activeSubscriptionGroups = useMemo((): ActiveSubscriptionGroup[] => {
    const activeSubscriptions = rawSubscriptions.filter(
      (item) => item.status === 'active' && new Date(item.expiresAt) > new Date()
    );
    if (!activeSubscriptions.length) return [];

    const groups = new Map<string, ActiveSubscriptionGroup>();
    const now = Date.now();

    activeSubscriptions.forEach((sub) => {
      if (!sub.tier) return;

      const key = `${sub.tier.name || 'Plan'}-${sub.tier.durationDays || 30}-${sub.tier.maxListings ?? 0}`;
      const tierPrice = Number(sub.tier.offerPrice || sub.tier.price || 0);
      const maxListings = Number(sub.tier.maxListings || 0);
      const available =
        maxListings === -1 ? -1 : Math.max(0, maxListings - Number(sub.listingsUsed || 0));
      const boostEntitlement = Number(sub.tier.boostCredits || 0);
      const boostsRemaining = Number(sub.boostsRemaining || 0);
      const expiry = new Date(sub.expiresAt);
      const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - now) / (1000 * 60 * 60 * 24)));

      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          key,
          tierId: sub.tier.name || key,
          tierName: sub.tier.name || 'Subscription Plan',
          tierPrice,
          durationDays: Number(sub.tier.durationDays || 30),
          count: 1,
          totalUsed: Number(sub.listingsUsed || 0),
          totalAvailable: available,
          totalLimit: maxListings === -1 ? -1 : maxListings,
          shortestExpiryDays: daysLeft,
          latestExpiryAt: expiry,
          hasUnlimited: maxListings === -1,
          boostEntitlement,
          totalBoostsRemaining: boostsRemaining,
          subscriptions: [sub],
        });
        return;
      }

      existing.count += 1;
      existing.totalUsed += Number(sub.listingsUsed || 0);
      existing.shortestExpiryDays = Math.min(existing.shortestExpiryDays, daysLeft);
      existing.latestExpiryAt = expiry > existing.latestExpiryAt ? expiry : existing.latestExpiryAt;
      existing.totalBoostsRemaining += boostsRemaining;
      existing.subscriptions.push(sub);

      if (existing.hasUnlimited || maxListings === -1) {
        existing.hasUnlimited = true;
        existing.totalAvailable = -1;
        existing.totalLimit = -1;
      } else {
        existing.totalAvailable += available;
        existing.totalLimit += maxListings;
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.tierPrice !== b.tierPrice) return a.tierPrice - b.tierPrice;
      if (a.durationDays !== b.durationDays) return a.durationDays - b.durationDays;
      return a.tierName.localeCompare(b.tierName);
    });
  }, [rawSubscriptions]);

  const selectedActiveSubscription = useMemo(() => {
    if (!selectedActiveSubscriptionId) return null;
    return (
      rawSubscriptions.find((item) => item.id === selectedActiveSubscriptionId) ||
      rawSubscriptions.find((item) => item.id === defaultActiveSubscriptionId) ||
      null
    );
  }, [defaultActiveSubscriptionId, rawSubscriptions, selectedActiveSubscriptionId]);

  useEffect(() => {
    if (!activeSubscriptionGroups.length) {
      setSelectedActiveSubscriptionId('');
      setDefaultActiveSubscriptionId('');
      return;
    }

    const firstVisibleId = activeSubscriptionGroups[0]?.subscriptions[0]?.id || '';
    const visibleIds = new Set(
      activeSubscriptionGroups.flatMap((group) => group.subscriptions.map((sub) => sub.id))
    );

    setSelectedActiveSubscriptionId((current) =>
      current && visibleIds.has(current) ? current : firstVisibleId
    );
    setDefaultActiveSubscriptionId((current) =>
      current && visibleIds.has(current) ? current : firstVisibleId
    );
  }, [activeSubscriptionGroups]);

  useEffect(() => {
    let cancelled = false;

    const resolveLocation = async () => {
      if (!navigator.geolocation) {
        setLocationStatus('error');
        return;
      }

      setLocationStatus('loading');

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(
              `${getApiUrl()}/api/location/reverse-geocode?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
            );
            const payload = await response.json().catch(() => ({}));
            if (cancelled) return;

            const data = payload?.data || {};
            const city = String(data.city || '').trim();
            const state = String(data.state || '').trim();
            const pincode = String(data.pincode || '').trim();
            if (city || state || pincode) {
              setLocationHint({ city, state, pincode });
              setLocationStatus('ready');
              return;
            }

            setLocationStatus('error');
          } catch {
            if (!cancelled) setLocationStatus('error');
          }
        },
        () => {
          if (!cancelled) setLocationStatus('error');
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
      );
    };

    void resolveLocation();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!userId)
    return <Navigate to={buildAuthRegisterPath(location.pathname, location.search)} replace />;

  const selectedActiveSubscriptionSummary =
    selectedActiveSubscription || activeSubscriptionGroups[0]?.subscriptions[0] || null;

  const proceedWithPlan = async (tier: SubscriptionTier): Promise<void> => {
    const tierId = String(tier.id || '').trim();
    if (!tierId || checkoutTierId) return;

    setCheckoutTierId(tierId);
    setCheckoutMessage('Opening NearHub app to complete this subscription.');
    try {
      const couponCode = String(couponByTierId[tierId] || '').trim();
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams({ tierId });
        if (couponCode) params.set('couponCode', couponCode);
        window.location.href = `/subscriptions/open?${params.toString()}`;
        return;
      }
    } catch (error) {
      setCheckoutMessage(
        error instanceof Error ? error.message : 'Failed to proceed with this plan.'
      );
    } finally {
      setCheckoutTierId('');
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active="browse" />
      <main className="w-full px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <section className="rounded-3xl border border-[#1e5da8]/15 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(30,93,168,0.68)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#113965]">Subscriptions</h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage your plans here and finish subscription purchase in the NearHub app.
              </p>
            </div>
            <Link to="/browse" className="text-sm font-semibold text-[#1e5da8] hover:underline">
              Back to Browse
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Active Plans</p>
              <p className="text-xl font-bold text-[#113965]">{stats.active}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Expired Plans</p>
              <p className="text-xl font-bold text-[#113965]">{stats.expired}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Total Spent</p>
              <p className="text-xl font-bold text-[#113965]">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-[#eef5ff] to-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[#1e5da8]" />
                <p className="text-sm font-semibold text-[#113965]">Location Context</p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                {locationStatus === 'loading'
                  ? 'Detecting...'
                  : locationStatus === 'ready'
                    ? 'Detected'
                    : locationStatus === 'error'
                      ? 'Unavailable'
                      : 'Idle'}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {locationStatus === 'ready' &&
              (locationHint?.city || locationHint?.state || locationHint?.pincode)
                ? `Showing your current location as ${[
                    locationHint?.city,
                    locationHint?.state,
                    locationHint?.pincode,
                  ]
                    .filter(isMeaningfulText)
                    .join(', ')}.`
                : 'Location is optional here, but it helps us mirror the app experience and future pricing hints.'}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              to="/create-listing"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1f63b2] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_-20px_rgba(31,99,178,0.8)]"
            >
              Create Listing
            </Link>
            <Link
              to="/my-listings"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              Open My Listings
            </Link>
          </div>
        </section>

        <section className="mt-5 space-y-3">
          {subscriptionsQuery.isLoading ? (
            <p className="text-slate-600">Loading subscriptions...</p>
          ) : null}
          {subscriptionsQuery.isError ? (
            <p className="text-red-600">Failed to load subscriptions.</p>
          ) : null}

          {starterCredits?.isActive ? (
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Rocket size={16} /> Starter Credits
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Included credits for new or existing accounts.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold uppercase text-emerald-700">
                  active
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  Listings: {starterCredits.listingsRemaining}/{starterCredits.listingsTotal} left
                </p>
                <p>
                  Boosts: {starterCredits.boostsRemaining}/{starterCredits.boostsTotal} left
                </p>
              </div>
            </article>
          ) : null}

          {activeSubscriptionGroups.length > 0 ? (
            <article className="rounded-2xl border border-[#1e5da8]/15 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                    <ShieldCheck size={16} className="text-emerald-600" /> Active Plan Picker
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Choose which active subscription you want to keep in focus.
                  </p>
                </div>
                {selectedActiveSubscriptionSummary ? (
                  <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-xs font-semibold text-[#1e5da8]">
                    Selected: {selectedActiveSubscriptionSummary.tier?.name || 'Plan'}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3">
                {activeSubscriptionGroups.map((group) => {
                  const selectedId = selectedActiveSubscriptionId || defaultActiveSubscriptionId;
                  const isSelected = group.subscriptions.some((sub) => sub.id === selectedId);
                  const isDefault = group.subscriptions.some(
                    (sub) => sub.id === defaultActiveSubscriptionId
                  );

                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() =>
                        setSelectedActiveSubscriptionId(group.subscriptions[0]?.id || '')
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-[#1e5da8] bg-[#eef5ff] shadow-[0_14px_36px_-28px_rgba(30,93,168,0.65)]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{group.tierName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {group.durationDays} days · {group.count} active subscription
                            {group.count === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isDefault ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              Default
                            </span>
                          ) : null}
                          {isSelected ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              Selected
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                        <p className="inline-flex items-center gap-2">
                          <BadgeIndianRupee size={14} /> {formatCurrency(group.tierPrice)}
                        </p>
                        <p className="inline-flex items-center gap-2">
                          <CalendarDays size={14} /> Expires in {group.shortestExpiryDays} day
                          {group.shortestExpiryDays === 1 ? '' : 's'}
                        </p>
                        <p>
                          Listings:{' '}
                          {group.hasUnlimited
                            ? 'Unlimited'
                            : `${group.totalUsed}/${group.totalLimit}`}
                        </p>
                        <p>Boosts left: {group.totalBoostsRemaining}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles size={12} className="text-[#1e5da8]" />
                          {group.hasUnlimited
                            ? 'Unlimited listing allowance'
                            : 'Fixed listing allowance'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Zap size={12} className="text-amber-500" />
                          {group.boostEntitlement > 0
                            ? `${group.boostEntitlement} boost credit${group.boostEntitlement === 1 ? '' : 's'} in plan`
                            : 'No boost credits in this plan'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>
          ) : null}

          {subscriptions.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">Subscription ID: {item.id}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <BadgeIndianRupee size={14} /> {formatCurrency(item.price)}
                </p>
                <p className="inline-flex items-center gap-2">
                  <CalendarDays size={14} /> {item.durationDays} days
                </p>
                <p>Start: {formatDate(item.startDate)}</p>
                <p>Expiry: {formatDate(item.expiresAt)}</p>
                <p>
                  Listings:{' '}
                  {item.maxListings === -1
                    ? 'Unlimited'
                    : `${item.listingsUsed}/${item.maxListings}`}
                </p>
                <p>Boosts left: {item.boostsRemaining}</p>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">Payment: {item.paymentId || 'NA'}</p>
                <Link
                  to="/create-listing"
                  className="text-sm font-semibold text-[#ff7b00] hover:underline"
                >
                  Create Listing
                </Link>
              </div>
            </article>
          ))}

          {!subscriptionsQuery.isLoading &&
          subscriptions.length === 0 &&
          !starterCredits?.isActive ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600">
              No subscriptions found yet.
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#113965]">Available Plans</h2>
            {tiersQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading plans...</p>
            ) : null}
          </div>

          {checkoutMessage ? (
            <p className="mb-4 rounded-2xl border border-[#1e5da8]/20 bg-white px-4 py-3 text-sm font-semibold text-[#113965]">
              {checkoutMessage}
            </p>
          ) : null}

          {tiersQuery.isError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              Failed to load subscription plans.
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availablePlans.map((tier) => {
              const regularPrice = Number(tier.price || 0);
              const finalPrice = getPlanPrice(tier);
              const couponCode = couponByTierId[tier.id] || '';
              const isCheckingOut = checkoutTierId === tier.id;
              const selectedActivePlan =
                selectedActiveSubscriptionSummary?.tier?.name || 'No active plan selected';

              return (
                <article
                  key={tier.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{tier.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {tier.durationDays} days
                      </p>
                    </div>
                    {tier.highlight ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-700">
                        Popular
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-end gap-2">
                    <p className="text-3xl font-black text-[#113965]">
                      {formatCurrency(finalPrice)}
                    </p>
                    {finalPrice < regularPrice ? (
                      <p className="pb-1 text-sm font-semibold text-slate-400 line-through">
                        {formatCurrency(regularPrice)}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-700">
                    <p>
                      Listings: {Number(tier.maxListings) === -1 ? 'Unlimited' : tier.maxListings}
                    </p>
                    <p>Boost credits: {Number(tier.boostCredits || 0)}</p>
                    {(tier.features || []).slice(0, 4).map((feature) => (
                      <p key={feature}>{feature}</p>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Focused active plan:{' '}
                    <span className="font-semibold text-slate-800">{selectedActivePlan}</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <input
                      value={couponCode}
                      onChange={(event) =>
                        setCouponByTierId((prev) => ({
                          ...prev,
                          [tier.id]: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Coupon code"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#1e5da8]"
                    />
                    <p className="text-xs text-slate-500">
                      Coupon will be carried into the app checkout flow for this plan.
                    </p>
                    <button
                      type="button"
                      onClick={() => void proceedWithPlan(tier)}
                      disabled={Boolean(checkoutTierId)}
                      className="h-10 w-full rounded-lg bg-[#1f63b2] text-xs font-black text-white disabled:opacity-60"
                    >
                      {isCheckingOut ? 'Opening App...' : 'Open in App'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!tiersQuery.isLoading && availablePlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600">
              No active plans are available. Create active bundle plans from Admin Subscriptions.
            </div>
          ) : null}
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
