import { type ReactElement, useEffect, useMemo, useRef } from 'react';
import { ExternalLink, Smartphone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { LandingFooter, LandingHeader } from '@/shared/components';

const playStoreBaseUrl = 'https://play.google.com/store/apps/details?id=com.synvide.nearhub';

function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

export default function SubscriptionsDeepLink(): ReactElement {
  const [searchParams] = useSearchParams();
  const tierId = String(searchParams.get('tierId') || '').trim();
  const couponCode = String(searchParams.get('couponCode') || '').trim();
  const autoAttemptedRef = useRef(false);

  const playStoreInstallUrl = useMemo(() => playStoreBaseUrl, []);
  const appDeepLink = useMemo(() => {
    const params = new URLSearchParams();
    if (tierId) params.set('tierId', tierId);
    if (couponCode) params.set('couponCode', couponCode);
    const query = params.toString();
    return query ? `nearhub://subscriptions?${query}` : 'nearhub://subscriptions';
  }, [couponCode, tierId]);
  const androidIntentLink = useMemo(
    () => {
      const query = new URLSearchParams();
      if (tierId) query.set('tierId', tierId);
      if (couponCode) query.set('couponCode', couponCode);
      const intentPath = query.toString()
        ? `subscriptions?${query.toString()}`
        : 'subscriptions';
      return `intent://${intentPath}#Intent;scheme=nearhub;package=com.synvide.nearhub;S.browser_fallback_url=${encodeURIComponent(playStoreInstallUrl)};end`;
    },
    [couponCode, playStoreInstallUrl, tierId]
  );
  const openAppLink = isAndroidDevice() ? androidIntentLink : appDeepLink;

  useEffect(() => {
    if (autoAttemptedRef.current || !isAndroidDevice()) return;
    autoAttemptedRef.current = true;
    window.location.replace(androidIntentLink);
  }, [androidIntentLink]);

  const handleOpenApp = () => {
    window.location.href = openAppLink;
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_46%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(30,93,168,0.16),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(30,93,168,0.09),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="browse" />

      <main className="pt-20">
        <section className="w-full px-4 pb-16 pt-10 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#1e5da8]/20 bg-white/92 px-6 py-10 shadow-[0_26px_56px_-36px_rgba(30,93,168,0.68)] backdrop-blur-sm sm:px-10 sm:py-12">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#1e5da8]/20 bg-[#1e5da8]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1e5da8]">
              <Smartphone size={12} />
              Open Subscriptions In App
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-[#113965] sm:text-5xl">
              Subscribe In The NearHub App
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Subscription purchases are handled inside the NearHub app now. Open the app to pick
              a plan, apply coupons, and finish checkout securely.
            </p>

            {tierId || couponCode ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {tierId ? (
                  <p>
                    Selected plan reference:{' '}
                    <span className="font-semibold text-slate-800">{tierId}</span>
                  </p>
                ) : null}
                {couponCode ? (
                  <p className={tierId ? 'mt-1' : ''}>
                    Coupon reference:{' '}
                    <span className="font-semibold text-slate-800">{couponCode}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenApp}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1e5da8] px-4 py-2 text-xs font-bold text-white shadow-[0_14px_34px_-18px_rgba(30,93,168,0.95)] transition hover:bg-[#2a71c6]"
              >
                Open NearHub App
                <ExternalLink size={16} />
              </button>
              <a
                href={playStoreInstallUrl}
                className="inline-flex items-center gap-2 rounded-lg border border-[#1e5da8]/30 bg-white px-4 py-2 text-xs font-bold text-[#1e5da8] transition hover:border-[#1e5da8]/55 hover:bg-[#1e5da8]/5"
              >
                Install From Play Store
              </a>
            </div>

            <div className="mt-7 border-t border-slate-200 pt-5">
              <Link to="/" className="text-sm font-semibold text-[#1e5da8] hover:text-[#2a71c6]">
                Back to homepage
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
