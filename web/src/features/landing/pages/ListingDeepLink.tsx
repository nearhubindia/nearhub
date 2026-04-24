import { type ReactElement, useEffect, useMemo, useRef } from 'react';
import { ExternalLink, Smartphone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LandingFooter, LandingHeader } from '@/shared/components';
const playStoreBaseUrl = 'https://play.google.com/store/apps/details?id=com.synvide.nearhub';

function normalizeListingId(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

export default function ListingDeepLink(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const listingId = normalizeListingId(id);
  const autoAttemptedRef = useRef(false);

  const encodedListingId = useMemo(() => encodeURIComponent(listingId), [listingId]);
  const playStoreInstallUrl = useMemo(() => {
    if (!listingId) return playStoreBaseUrl;
    const referrerPayload = `nearhub_listing_id=${encodeURIComponent(listingId)}`;
    return `${playStoreBaseUrl}&referrer=${encodeURIComponent(referrerPayload)}`;
  }, [listingId]);
  const appDeepLink = useMemo(
    () => `nearhub://listing/${encodedListingId}`,
    [encodedListingId]
  );
  const androidIntentLink = useMemo(
    () =>
      `intent://listing/${encodedListingId}#Intent;scheme=nearhub;package=com.synvide.nearhub;S.browser_fallback_url=${encodeURIComponent(playStoreInstallUrl)};end`,
    [encodedListingId, playStoreInstallUrl]
  );
  const openAppLink = isAndroidDevice() ? androidIntentLink : appDeepLink;

  useEffect(() => {
    if (!listingId || autoAttemptedRef.current || !isAndroidDevice()) return;
    autoAttemptedRef.current = true;
    window.location.replace(androidIntentLink);
  }, [androidIntentLink, listingId]);

  const handleOpenApp = () => {
    window.location.href = openAppLink;
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_46%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(30,93,168,0.16),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(30,93,168,0.09),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="home" />

      <main className="pt-20">
        <section className="w-full px-4 pb-16 pt-10 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#1e5da8]/20 bg-white/92 px-6 py-10 shadow-[0_26px_56px_-36px_rgba(30,93,168,0.68)] backdrop-blur-sm sm:px-10 sm:py-12">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#1e5da8]/20 bg-[#1e5da8]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1e5da8]">
              <Smartphone size={12} />
              Open Listing In App
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-[#113965] sm:text-5xl">
              Continue This Listing In NearHub
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              If you already have NearHub, open the app directly. If not, install the app and come
              back to this listing.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenApp}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1e5da8] px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_34px_-18px_rgba(30,93,168,0.95)] transition hover:bg-[#2a71c6]"
              >
                Open NearHub App
                <ExternalLink size={16} />
              </button>
              <a
                href={playStoreInstallUrl}
                className="inline-flex items-center gap-2 rounded-xl border border-[#1e5da8]/30 bg-white px-5 py-2.5 text-sm font-semibold text-[#1e5da8] transition hover:border-[#1e5da8]/55 hover:bg-[#1e5da8]/5"
              >
                Install From Play Store
              </a>
            </div>

            {listingId && (
              <p className="mt-5 break-all text-xs text-slate-500 sm:text-sm">
                Listing reference: <span className="font-semibold text-slate-700">{listingId}</span>
              </p>
            )}

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
