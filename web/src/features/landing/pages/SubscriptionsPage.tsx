import { useMemo, useState, type ReactElement } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeIndianRupee, CalendarDays, Rocket } from 'lucide-react';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';

type StoredUser = { id?: string; phone?: string };

type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount?: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    contact?: string;
  };
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

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

type CreateSubscriptionResponse = {
  success?: boolean;
  id?: string;
  error?: string;
};

type CheckoutResponse = {
  success?: boolean;
  isFree?: boolean;
  message?: string;
  error?: string;
  payment?: {
    key?: string;
    amount?: number;
    amountInRupees?: number;
    razorpayOrderId?: string;
    subscriptionId?: string;
  };
  discount?: {
    percentage?: number;
    finalAmount?: number;
  } | null;
};

type VerifyPaymentResponse = {
  success?: boolean;
  message?: string;
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

function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('nearhub_web_user');
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

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

function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function SubscriptionsPage(): ReactElement {
  const user = readStoredUser();
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();
  const [couponByTierId, setCouponByTierId] = useState<Record<string, string>>({});
  const [checkoutTierId, setCheckoutTierId] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState('');

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
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load plans');
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
    () => (tiersQuery.data?.tiers || []).filter((tier) => String(tier.type || 'bundle') !== 'boost'),
    [tiersQuery.data?.tiers]
  );

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'active').length;
    const expired = subscriptions.filter((s) => s.status === 'expired').length;
    const totalValue = subscriptions.reduce((sum, s) => sum + Number(s.price || 0), 0);
    return { active, expired, total: subscriptions.length, totalValue };
  }, [subscriptions]);

  if (!userId) return <Navigate to="/auth/register" replace />;

  const proceedWithPlan = async (tier: SubscriptionTier): Promise<void> => {
    const tierId = String(tier.id || '').trim();
    if (!tierId || checkoutTierId) return;

    setCheckoutTierId(tierId);
    setCheckoutMessage('');
    try {
      const createResponse = await fetch(`${getApiUrl()}/api/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-phone': userPhone,
        },
        body: JSON.stringify({
          tierId,
          duration: Number(tier.durationDays || 30),
        }),
      });
      const created = (await createResponse.json().catch(() => ({}))) as CreateSubscriptionResponse;
      if (!createResponse.ok || !created.id) {
        throw new Error(created.error || 'Failed to prepare subscription');
      }

      const couponCode = String(couponByTierId[tierId] || '').trim();
      const checkoutResponse = await fetch(`${getApiUrl()}/api/subscriptions/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-phone': userPhone,
        },
        body: JSON.stringify({
          subscriptionId: created.id,
          userId,
          tierId,
          listingTitle: tier.name,
          totalFee: getPlanPrice(tier),
          duration: Number(tier.durationDays || 30),
          couponCode: couponCode || undefined,
        }),
      });
      const checkout = (await checkoutResponse.json().catch(() => ({}))) as CheckoutResponse;
      if (!checkoutResponse.ok || !checkout.success) {
        throw new Error(checkout.error || 'Checkout failed');
      }

      if (checkout.isFree) {
        setCheckoutMessage(checkout.message || 'Plan activated successfully.');
        await subscriptionsQuery.refetch();
        return;
      }

      if (!checkout.payment?.razorpayOrderId || !checkout.payment.key) {
        setCheckoutMessage(
          checkout.payment?.razorpayOrderId
            ? `Payment order created for ${formatCurrency(Number(checkout.payment.amountInRupees || 0))}, but Razorpay key is missing. Complete payment configuration to activate this plan.`
            : checkout.message || 'Checkout started.'
        );
        return;
      }

      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded || !window.Razorpay) {
        setCheckoutMessage('Unable to load Razorpay checkout. Please check internet connection and try again.');
        return;
      }

      await new Promise<void>((resolve) => {
        const razorpay = new window.Razorpay!({
          key: checkout.payment!.key!,
          amount: checkout.payment!.amount,
          currency: 'INR',
          name: 'NearHub',
          description: tier.name,
          order_id: checkout.payment!.razorpayOrderId!,
          prefill: {
            contact: userPhone,
          },
          handler: (paymentResponse) => {
            void (async () => {
              try {
                const verifyResponse = await fetch(`${getApiUrl()}/api/subscriptions/verify-payment`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-user-phone': userPhone,
                  },
                  body: JSON.stringify({
                    subscriptionId: created.id,
                    couponCode: couponCode || undefined,
                    razorpay_order_id: paymentResponse.razorpay_order_id,
                    razorpay_payment_id: paymentResponse.razorpay_payment_id,
                    razorpay_signature: paymentResponse.razorpay_signature,
                  }),
                });
                const verified = (await verifyResponse.json().catch(() => ({}))) as VerifyPaymentResponse;
                if (!verifyResponse.ok || !verified.success) {
                  throw new Error(verified.error || 'Payment verification failed');
                }
                setCheckoutMessage(verified.message || 'Payment verified. Plan activated successfully.');
                await subscriptionsQuery.refetch();
              } catch (verifyError) {
                setCheckoutMessage(
                  verifyError instanceof Error ? verifyError.message : 'Payment verification failed.'
                );
              } finally {
                resolve();
              }
            })();
          },
          modal: {
            ondismiss: () => {
              setCheckoutMessage('Payment was not completed. The subscription will stay pending until payment is verified.');
              resolve();
            },
          },
        });
        razorpay.open();
      });
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : 'Failed to proceed with this plan.');
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
            <h1 className="text-2xl font-bold text-[#113965]">Subscriptions</h1>
            <Link to="/browse" className="text-sm font-semibold text-[#1e5da8] hover:underline">Back to Browse</Link>
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
        </section>

        <section className="mt-5 space-y-3">
          {subscriptionsQuery.isLoading ? <p className="text-slate-600">Loading subscriptions...</p> : null}
          {subscriptionsQuery.isError ? <p className="text-red-600">Failed to load subscriptions.</p> : null}

          {starterCredits?.isActive ? (
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Rocket size={16} /> Starter Credits
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">Included credits for new or existing accounts.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold uppercase text-emerald-700">
                  active
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p>Listings: {starterCredits.listingsRemaining}/{starterCredits.listingsTotal} left</p>
                <p>Boosts: {starterCredits.boostsRemaining}/{starterCredits.boostsTotal} left</p>
              </div>
            </article>
          ) : null}

          {subscriptions.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">Subscription ID: {item.id}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                  {item.status}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p className="inline-flex items-center gap-2"><BadgeIndianRupee size={14} /> {formatCurrency(item.price)}</p>
                <p className="inline-flex items-center gap-2"><CalendarDays size={14} /> {item.durationDays} days</p>
                <p>Start: {item.startDate ? new Date(item.startDate).toLocaleDateString('en-IN') : '-'}</p>
                <p>Expiry: {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('en-IN') : '-'}</p>
                <p>Listings: {item.maxListings === -1 ? 'Unlimited' : `${item.listingsUsed}/${item.maxListings}`}</p>
                <p>Boosts left: {item.boostsRemaining}</p>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">Payment: {item.paymentId || 'NA'}</p>
                <Link to="/create-listing" className="text-sm font-semibold text-[#ff7b00] hover:underline">Create Listing</Link>
              </div>
            </article>
          ))}

          {!subscriptionsQuery.isLoading && subscriptions.length === 0 && !starterCredits?.isActive ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600">
              No subscriptions found yet.
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#113965]">Available Plans</h2>
            {tiersQuery.isLoading ? <p className="text-sm text-slate-500">Loading plans...</p> : null}
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

              return (
                <article key={tier.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{tier.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{tier.durationDays} days</p>
                    </div>
                    {tier.highlight ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-700">
                        Popular
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-end gap-2">
                    <p className="text-3xl font-black text-[#113965]">{formatCurrency(finalPrice)}</p>
                    {finalPrice < regularPrice ? (
                      <p className="pb-1 text-sm font-semibold text-slate-400 line-through">{formatCurrency(regularPrice)}</p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-700">
                    <p>Listings: {Number(tier.maxListings) === -1 ? 'Unlimited' : tier.maxListings}</p>
                    <p>Boost credits: {Number(tier.boostCredits || 0)}</p>
                    {(tier.features || []).slice(0, 4).map((feature) => (
                      <p key={feature}>{feature}</p>
                    ))}
                  </div>

                  <div className="mt-5 space-y-3">
                    <input
                      value={couponCode}
                      onChange={(event) =>
                        setCouponByTierId((prev) => ({ ...prev, [tier.id]: event.target.value.toUpperCase() }))
                      }
                      placeholder="Coupon code"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#1e5da8]"
                    />
                    <button
                      type="button"
                      onClick={() => void proceedWithPlan(tier)}
                      disabled={Boolean(checkoutTierId)}
                      className="h-10 w-full rounded-lg bg-[#1f63b2] text-xs font-black text-white disabled:opacity-60"
                    >
                      {isCheckingOut ? 'Processing...' : couponCode.trim() ? 'Apply Coupon & Proceed' : 'Proceed Plan'}
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
