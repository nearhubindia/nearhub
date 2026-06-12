import { type ReactElement, useMemo } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Download,
  Globe,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Video,
  Zap,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { BRAND_SIGNATURE } from '@/shared/brand';
import { getPrimaryListingImage } from '@/features/landing/lib/listing-images';
import { readStoredWebGeoCoords } from '@/lib/web-geo-storage';
import { formatPriceInr } from '@/features/landing/lib/landing-utils';

const capabilityCards = [
  {
    Icon: Video,
    title: 'Video-First Listings',
    text: 'Publish short, crisp product videos that get faster responses than static posts.',
  },
  {
    Icon: BadgeCheck,
    title: 'Verified Business Badges',
    text: 'Give buyers instant confidence with verified profiles, trust marks, and stronger conversion intent.',
  },
  {
    Icon: Zap,
    title: 'Growth Controls',
    text: 'Boost campaigns, featured slots, and promo tools for serious sellers.',
  },
  {
    Icon: Globe,
    title: 'Location Intelligence',
    text: 'Pincode-aware discovery keeps buyers focused on nearby and relevant offers.',
  },
];

const marketHighlights = [
  { value: '3.2x', label: 'Qualified Leads' },
  { value: '48h', label: 'Avg Response Cycle' },
  { value: '92%', label: 'Seller Satisfaction' },
  { value: '24/7', label: 'Discovery Window' },
];

const trustPoints = [
  {
    Icon: ShieldCheck,
    title: 'Verified Badge Advantage',
    text: 'Businesses with verified badges stand out faster and win higher trust than unverified listings.',
  },
  {
    Icon: Video,
    title: 'Faster Response With Video Shorts',
    text: 'Short-video listings communicate value quickly, helping serious buyers message and call faster.',
  },
  {
    Icon: Star,
    title: 'USPs vs Generic Classifieds',
    text: 'Unlike broad marketplaces, NearHub combines hyperlocal targeting, trust filters, and media-first listing formats in one flow.',
  },
  {
    Icon: Globe,
    title: 'Hyperlocal Buyer Reach',
    text: 'Pincode-driven visibility ensures your listings appear to nearby, high-intent buyers first.',
  },
  {
    Icon: Zap,
    title: 'Built-In Growth Controls',
    text: 'Use boosts and featured placements to increase premium visibility during key selling windows.',
  },
  {
    Icon: BadgeCheck,
    title: 'Quality Lead Filtering',
    text: 'Trust layers and moderation reduce low-quality enquiries so teams focus on conversion-ready leads.',
  },
];

const appBenefits = [
  {
    Icon: Camera,
    title: 'Fast Posting',
    text: 'Image + Video Upload',
  },
  {
    Icon: MessageCircle,
    title: 'Real-Time Leads',
    text: 'Chat And Notifications',
  },
  {
    Icon: MapPinned,
    title: 'Local Reach',
    text: 'Pincode Smart Discovery',
  },
];

const homeBanner = '/banner_web_1.png';
const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.synvide.nearhub';

type Listing = {
  id: string;
  title: string;
  location?: string;
  price?: string | number;
  offerPrice?: string | number;
  image?: string;
  imageUrl?: string;
  images?: string[];
  isDeal?: boolean;
  is_deal?: boolean;
};

type ListingsResponse = {
  success?: boolean;
  data?: Listing[];
  results?: Listing[];
};

export default function Landing(): ReactElement {
  const [searchParams] = useSearchParams();
  const location = searchParams.get('location') ?? '';
  const storedGeoCoords = readStoredWebGeoCoords();
  const latitude = searchParams.get('latitude') ?? String(storedGeoCoords?.latitude ?? '');
  const longitude = searchParams.get('longitude') ?? String(storedGeoCoords?.longitude ?? '');
  const radius = searchParams.get('radius') ?? '50';
  const query = searchParams.get('q') ?? '';

  const nearbyEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '8');
    if (query.trim()) params.set('q', query.trim());
    if (location.trim()) params.set('location', location.trim());
    if (latitude && longitude) {
      params.set('latitude', latitude);
      params.set('longitude', longitude);
      params.set('radius', radius || '50');
    }
    const searchPath = query.trim() || location.trim() ? '/api/listings/search' : '/api/listings';
    return `${getApiUrl()}${searchPath}?${params.toString()}`;
  }, [latitude, longitude, location, query, radius]);

  const nearbyListingsQuery = useQuery({
    queryKey: ['landing-nearby-listings', query, location, latitude, longitude, radius],
    queryFn: async () => {
      const response = await fetch(nearbyEndpoint);
      if (!response.ok) throw new Error('Failed to load nearby listings');
      const payload = (await response.json()) as ListingsResponse;
      return (payload.data || payload.results || []).slice(0, 8);
    },
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_46%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(30,93,168,0.16),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(30,93,168,0.09),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="home" />

      <main className="pt-20">
        <section className="w-full border-y border-[#1e5da8]/15 bg-[#0e3f78]">
          <div className="relative w-full overflow-hidden min-h-[280px] sm:min-h-[320px] lg:min-h-[420px]">
            <img
              src={homeBanner}
              alt="NearHub home banner"
              className="absolute inset-0 block h-full w-full object-contain object-center"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0e3f78]/10 via-transparent to-[#0e3f78]/8" />
          </div>
        </section>

        <section className="w-full px-4 pb-8 pt-8 sm:px-8 lg:px-12">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-stretch">
            <div className="rounded-[2rem] border border-[#1e5da8]/20 bg-[linear-gradient(125deg,#0f4684_0%,#1e5da8_42%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_34px_72px_-40px_rgba(14,63,120,0.78)] sm:px-9 sm:py-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
                <Sparkles size={12} />
                {BRAND_SIGNATURE}
              </p>
              <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight sm:text-5xl">
                Discover Everything Near You
                <span className="block text-[#fff0db]">From Listings, Deals, and Services.</span>
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
                NearHub combines trust-first moderation, location-smart distribution, and
                high-visibility media to help local buyers and sellers connect faster.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {marketHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/22 bg-white/14 p-4"
                  >
                    <p className="text-2xl font-bold text-white">{item.value}</p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-50/85">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/features"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/16 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/26"
                >
                  Explore Features
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#ff9933] px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[0_14px_34px_-18px_rgba(255,153,51,0.95)] transition hover:bg-[#ffad57]"
                >
                  Talk To NearHub
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#1e5da8]/18 bg-white/90 p-6 shadow-[0_28px_62px_-42px_rgba(30,93,168,0.75)] backdrop-blur-sm sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff9933]">
                Why Businesses Choose NearHub
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {trustPoints.map(({ Icon, title, text }) => (
                  <article
                    key={title}
                    className="group relative overflow-hidden rounded-xl border border-[#1e5da8]/14 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)] p-5 shadow-[0_14px_30px_-24px_rgba(17,61,104,0.6)] transition duration-300 hover:-translate-y-0.5 hover:border-[#1e5da8]/30 hover:shadow-[0_24px_40px_-26px_rgba(30,93,168,0.7)]"
                  >
                    <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-[#ff9933]/12 blur-2xl transition group-hover:bg-[#ff9933]/18" />
                    <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-[#1e5da8] to-[#ff9933] p-2.5 text-white">
                      <Icon size={18} />
                    </div>
                    <h3 className="text-lg font-semibold text-[#123d68]">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full px-4 pb-16 sm:px-8 lg:px-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff9933]">
                Nearby Listings
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#113965]">
                {location ? `Live picks near ${location}` : 'Live picks near you'}
              </h2>
            </div>
            <Link to="/browse" className="text-sm font-semibold text-[#1e5da8] hover:underline">
              View all
            </Link>
          </div>

          {nearbyListingsQuery.isLoading ? (
            <div className="rounded-2xl border border-[#1e5da8]/12 bg-white/85 p-6 text-sm text-slate-600 shadow-sm">
              Loading nearby listings...
            </div>
          ) : null}

          {!nearbyListingsQuery.isLoading && (nearbyListingsQuery.data || []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#1e5da8]/20 bg-white/85 p-6 text-sm text-slate-600 shadow-sm">
              {location
                ? `No nearby listings found for ${location} yet. Try a different location or adjust your radius.`
                : 'Pick a location in the header to see nearby listings here.'}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(nearbyListingsQuery.data || []).map((listing) => (
              <Link
                key={listing.id}
                to={`/listing/${listing.id}`}
                className="group overflow-hidden rounded-2xl border border-[#1e5da8]/12 bg-white shadow-[0_18px_42px_-30px_rgba(30,93,168,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_54px_-34px_rgba(30,93,168,0.7)]"
              >
                <img
                  src={getPrimaryListingImage(listing)}
                  alt={listing.title}
                  className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
                <div className="p-4">
                  <p className="line-clamp-2 text-sm font-semibold text-[#113965]">
                    {listing.title}
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-950">
                    {formatPriceInr(listing.offerPrice || listing.price)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{listing.location || 'Nearby'}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="w-full px-4 pb-9 sm:px-8 lg:px-12">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {capabilityCards.map(({ Icon, title, text }) => (
              <article
                key={title}
                className="group relative overflow-hidden rounded-xl border border-[#1e5da8]/14 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)] p-6 shadow-[0_16px_34px_-26px_rgba(14,63,120,0.52)] transition duration-300 hover:-translate-y-1 hover:border-[#1e5da8]/30 hover:shadow-[0_24px_42px_-24px_rgba(30,93,168,0.66)]"
              >
                <div className="pointer-events-none absolute left-0 top-0 h-24 w-24 -translate-x-8 -translate-y-8 rounded-full bg-[#1e5da8]/12 blur-2xl transition group-hover:bg-[#1e5da8]/20" />
                <div className="mb-4 inline-flex items-center gap-3">
                  <span className="inline-flex rounded-xl bg-gradient-to-br from-[#1e5da8] via-[#2478d8] to-[#ff9933] p-3 text-white shadow-sm">
                    <Icon size={20} />
                  </span>
                  <span className="h-px w-16 bg-gradient-to-r from-[#1e5da8] to-[#ff9933]/35" />
                </div>
                <h3 className="text-xl font-semibold text-[#113965]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="w-full px-4 pb-16 sm:px-8 lg:px-12">
          <div className="overflow-hidden rounded-[2rem] border border-[#1e5da8]/18 bg-[linear-gradient(120deg,#0f3f78_0%,#1e5da8_58%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_30px_62px_-38px_rgba(15,63,120,0.8)] sm:px-9 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffe2bf]">
                Get The App
              </p>
              <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
                Download NearHub from Google Play.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
                Post listings in minutes, manage conversations on the move, and respond to
                high-intent buyers instantly from your phone.
              </p>

              <a
                href={playStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#ff9933] px-4 py-2 text-xs font-bold text-slate-900 shadow-[0_14px_34px_-18px_rgba(255,153,51,0.95)] transition hover:bg-[#ffad57]"
              >
                <Download size={18} />
                Download On Play Store
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:mt-0 lg:grid-cols-3">
              {appBenefits.map(({ Icon, title, text }) => (
                <article
                  key={title}
                  className="group relative overflow-hidden rounded-xl border border-white/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.26),rgba(255,255,255,0.08))] p-4 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-white/55 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.34),rgba(255,255,255,0.12))]"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,153,51,0.28),transparent_42%)] opacity-75 transition group-hover:opacity-100" />
                  <div className="relative z-10">
                    <span className="mb-3 inline-flex rounded-lg border border-white/35 bg-white/18 p-2 text-white shadow-[0_12px_24px_-18px_rgba(0,0,0,0.65)]">
                      <Icon size={18} />
                    </span>
                    <p className="text-2xl font-bold tracking-tight">{title}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-50/95">
                      {text}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
