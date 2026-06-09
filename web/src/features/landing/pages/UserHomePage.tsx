import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Flame,
  Gift,
  Heart,
  History,
  MapPin,
  PackagePlus,
  Tag,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LandingFooter, LandingHeader, Container } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { formatDealStatus, getEffectiveDealWindow } from '@/lib/deal-timer';

type Listing = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  price?: string | number;
  offerPrice?: string | number;
  postDealPriceMode?: string;
  post_deal_price_mode?: string;
  postDealDiscountPrice?: string | number;
  post_deal_discount_price?: string | number;
  images?: string[];
  createdAt?: string;
  isDeal?: boolean;
  is_deal?: boolean;
  dealType?: string;
  deal_type?: string;
  dealStartAt?: string;
  deal_start_at?: string;
  dealEndAt?: string;
  deal_end_at?: string;
  dealRecurrence?: string;
  deal_recurrence?: string;
  dealRecurrenceUntil?: string;
  deal_recurrence_until?: string;
  comboItems?: string[] | string;
  distanceKm?: number | string;
  distance_km?: number | string;
  likeCount?: number;
  chatCount?: number;
};

type ProductCardData = {
  id: string;
  title: string;
  category: string;
  location: string;
  image: string;
  images: string[];
  price?: number;
  originalPrice?: number;
  distance: string;
  badge?: string;
  dealEndsAt?: number;
  dealStatus?: string;
  comboItems?: string[];
};

type ListingsResponse = {
  success?: boolean;
  data?: Listing[];
  results?: Listing[];
};



const SAVED_IDS_KEY = 'nearhub_web_saved_listing_ids';
const FALLBACK_IMAGE = '/nearhub.png';
const HERO_BANNERS = ['/banner1.png', '/banner2.png'];
const EMPTY_LISTINGS: Listing[] = [];

function readSavedIds(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_IDS_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

function normalizeImageUrl(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return FALLBACK_IMAGE;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) return raw;
  return FALLBACK_IMAGE;
}

function parsePrice(value: string | number | undefined): number | undefined {
  const amount = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function formatPrice(value: number | undefined): string {
  if (!value) return 'Price on request';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDistance(value: number | string | undefined): string {
  const distance = typeof value === 'string' ? Number(value) : value;
  if (Number.isFinite(distance) && Number(distance) >= 0) {
    const rounded =
      Number(distance) < 10 ? Number(distance).toFixed(1) : Math.round(Number(distance)).toString();
    return `${rounded.replace(/\.0$/, '')} km away`;
  }
  return '1 km away';
}

function parseComboItems(value: string[] | string | undefined): string[] | undefined {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  } catch {
    // Plain comma/newline separated values are accepted below.
  }

  const items = value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}



function formatCountdown(endAt: number | undefined, nowMs: number): string {
  return countdownParts(endAt, nowMs)
    .map((part) => part.value)
    .join(' : ');
}

function countdownParts(
  endAt: number | undefined,
  nowMs: number
): Array<{ value: string; label: string }> {
  const diff = typeof endAt === 'number' && Number.isFinite(endAt) ? Math.max(0, endAt - nowMs) : 0;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    { value: pad(days), label: 'DAYS' },
    { value: pad(hours), label: 'HOURS' },
    { value: pad(minutes), label: 'MINS' },
    { value: pad(seconds), label: 'SECS' },
  ];
}

function discount(product: ProductCardData): string | null {
  if (!product.price || !product.originalPrice || product.originalPrice <= product.price)
    return null;
  return `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`;
}

function isDeal(item: Listing): boolean {
  return Boolean(item.isDeal ?? item.is_deal);
}

function getDealStartMs(item: Listing, nowMs: number): number | undefined {
  return getEffectiveDealWindow(item, nowMs)?.startMs;
}

function getDealEndMs(item: Listing, nowMs: number): number | undefined {
  return getEffectiveDealWindow(item, nowMs)?.endMs;
}

function isDealActive(item: Listing, nowMs: number): boolean {
  if (!isDeal(item)) return false;
  const endAt = getDealEndMs(item, nowMs);
  if (!endAt || nowMs > endAt) return false;
  const startAt = getDealStartMs(item, nowMs);
  return !startAt || nowMs >= startAt;
}

function isDealExpired(item: Listing, nowMs: number): boolean {
  if (!isDeal(item)) return false;
  const endAt = getDealEndMs(item, nowMs);
  return typeof endAt === 'number' && Number.isFinite(endAt) ? nowMs > endAt : false;
}

function isDealUpcoming(item: Listing, nowMs: number): boolean {
  if (!isDeal(item)) return false;
  const startAt = getDealStartMs(item, nowMs);
  return typeof startAt === 'number' && Number.isFinite(startAt) ? nowMs < startAt : false;
}

function getPostDealPriceMode(item: Listing): string {
  return String(item.postDealPriceMode || item.post_deal_price_mode || 'original').toLowerCase();
}

function getDisplayPrices(
  item: Listing,
  nowMs: number
): { displayPrice: number | undefined; originalPrice: number | undefined } {
  const offerPrice = parsePrice(item.offerPrice);
  const price = parsePrice(item.price);
  const postDealDiscountPrice = parsePrice(
    item.postDealDiscountPrice ?? item.post_deal_discount_price
  );
  if (!price) return { displayPrice: offerPrice, originalPrice: undefined };
  if (!offerPrice || offerPrice >= price) return { displayPrice: price, originalPrice: undefined };
  if (!isDeal(item)) return { displayPrice: offerPrice, originalPrice: price };

  const endAt = getDealEndMs(item, nowMs);
  if (!endAt || nowMs <= endAt) return { displayPrice: offerPrice, originalPrice: price };
  if (getPostDealPriceMode(item) !== 'discount')
    return { displayPrice: price, originalPrice: undefined };

  const afterDealPrice =
    postDealDiscountPrice && postDealDiscountPrice < price ? postDealDiscountPrice : offerPrice;
  return { displayPrice: afterDealPrice, originalPrice: price };
}

function mapListing(item: Listing, nowMs: number): ProductCardData {
  const { displayPrice, originalPrice } = getDisplayPrices(item, nowMs);
  const images =
    item.images?.map(normalizeImageUrl).filter((image) => image !== FALLBACK_IMAGE) || [];

  return {
    id: item.id,
    title: item.title || 'Untitled listing',
    category: item.category || 'General',
    location: item.location || 'Nearby',
    image: images[0] || FALLBACK_IMAGE,
    images,
    price: displayPrice,
    originalPrice,
    distance: formatDistance(item.distanceKm ?? item.distance_km),
    badge: isDealActive(item, nowMs) ? 'Deal' : undefined,
    dealEndsAt: getDealEndMs(item, nowMs),
    dealStatus: formatDealStatus(item, nowMs),
    comboItems: parseComboItems(item.comboItems),
  };
}

function EmptyState({ message, to }: { message: string; to?: string }): ReactElement {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-normal text-slate-600">{message}</p>
      {to ? (
        <Link
          to={to}
          className="mt-3 inline-flex rounded-md bg-[#0759e6] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0448bd]"
        >
          Create Listing
        </Link>
      ) : null}
    </div>
  );
}

function ProductCard({
  product,
  saved,
  onToggleSaved,
  showCountdown = false,
  combo = false,
  nowMs,
}: {
  product: ProductCardData;
  saved: boolean;
  onToggleSaved: (id: string) => void;
  showCountdown?: boolean;
  combo?: boolean;
  nowMs: number;
}): ReactElement {
  const sale = discount(product);
  const comboImages = combo
    ? [
        product.images[0] || product.image,
        product.images[1] || product.images[0] || product.image || FALLBACK_IMAGE,
      ]
    : [];
  const comboTitle =
    combo && product.comboItems && product.comboItems.length >= 2
      ? `${product.comboItems[0]} + ${product.comboItems[1]}`
      : product.title;

  return (
    <article
      className={`group overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        combo ? 'h-full' : ''
      }`}
    >
      <Link to={`/listing/${encodeURIComponent(product.id)}`} className="block">
        <div className={`relative bg-slate-100 ${combo ? 'aspect-[1.72]' : 'aspect-[1.14]'}`}>
          {combo ? (
            <div className="grid h-full grid-cols-2 gap-px bg-slate-200">
              {comboImages.map((image, index) => (
                <div key={`${product.id}-combo-image-${index}`} className="min-w-0 bg-slate-50">
                  <img
                    src={image}
                    alt={`${comboTitle} item ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <img
              src={product.image}
              alt={product.title}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.src = FALLBACK_IMAGE;
              }}
            />
          )}
          {sale ? (
            <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white shadow-sm">
              {sale}
            </span>
          ) : null}
          {product.badge && !showCountdown ? (
            <span
              className={`absolute top-2 rounded-md bg-emerald-500 px-2 py-1 text-xs font-medium text-white shadow-sm ${sale ? 'right-2' : 'left-2'}`}
            >
              {product.badge}
            </span>
          ) : null}
          {combo ? (
            <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-red-600 text-xl font-medium text-white shadow-lg">
              +
            </span>
          ) : null}
        </div>
      </Link>
      <div className="p-3">
        <div className="flex min-h-10 items-start justify-between gap-2">
          <Link
            to={`/listing/${encodeURIComponent(product.id)}`}
            className="line-clamp-2 text-sm font-normal leading-snug text-slate-950 hover:text-[#0858d8]"
          >
            {comboTitle}
          </Link>
          <button
            type="button"
            onClick={() => onToggleSaved(product.id)}
            className="shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-red-600"
            aria-label={saved ? 'Remove from favourites' : 'Save listing'}
          >
            <Heart size={16} className={saved ? 'fill-red-500 text-red-500' : ''} />
          </button>
        </div>
        {combo ? (
          <p className="mt-1 line-clamp-1 text-xs font-normal text-slate-500">{product.title}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-base font-medium text-[#0759e6]">{formatPrice(product.price)}</span>
          {product.originalPrice ? (
            <span className="text-xs font-normal text-slate-400 line-through">
              {formatPrice(product.originalPrice)}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs font-normal text-slate-600">
          <MapPin size={12} />
          <span>{product.distance}</span>
        </div>
        {showCountdown && product.dealStatus ? (
          product.dealStatus.startsWith('Ends in') ? (
            <div className="mt-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#0759e6]">
                DEAL ENDS IN
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {countdownParts(product.dealEndsAt, nowMs).map((part) => (
                  <div
                    key={part.label}
                    className="grid h-[36px] min-w-[36px] w-[36px] place-items-center rounded-lg bg-white text-center text-[#dc1633] shadow-sm ring-1 ring-[#f8d9dd]"
                  >
                    <span className="block text-[10px] font-medium leading-none">{part.value}</span>
                    <span className="mt-0.5 block text-[7px] font-normal leading-none text-slate-500">
                      {part.label}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to={`/order-summary/${encodeURIComponent(product.id)}`}
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-[#0759e6] px-3 text-xs font-medium text-white transition hover:bg-[#0448bd]"
              >
                Book Deal
              </Link>
            </div>
          ) : (
            <div className="mt-3 text-center">
              <p className="text-xs font-normal text-[#0759e6]">Deal status</p>
              <p className="mt-1 font-mono font-medium tracking-wide text-red-600 sm:text-base">
                {product.dealStatus}
              </p>
            </div>
          )
        ) : null}
      </div>
    </article>
  );
}

function ComboDealCard({
  product,
  nowMs,
}: {
  product: ProductCardData;
  nowMs: number;
}): ReactElement {
  const sale = discount(product);
  const comboImages = [
    product.images[0] || product.image || FALLBACK_IMAGE,
    product.images[1] || product.images[0] || product.image || FALLBACK_IMAGE,
  ];
  const comboTitle =
    product.comboItems && product.comboItems.length >= 2
      ? `${product.comboItems[0]} + ${product.comboItems[1]}`
      : product.title;

  return (
    <article className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/listing/${encodeURIComponent(product.id)}`} className="block">
        <div className="relative h-44 overflow-hidden bg-white sm:h-40 xl:h-36">
          <div className="grid h-full grid-cols-2 gap-px bg-slate-200">
            {comboImages.map((image, index) => (
              <div
                key={`${product.id}-combo-panel-${index}`}
                className="flex min-w-0 items-center justify-center overflow-hidden bg-white"
              >
                <img
                  src={image}
                  alt={`${comboTitle} item ${index + 1}`}
                  className="block h-full w-full object-contain"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
              </div>
            ))}
          </div>
          {sale ? (
            <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white shadow-sm">
              {sale}
            </span>
          ) : null}
          <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-red-600 text-2xl font-medium leading-none text-white shadow-lg">
            +
          </span>
        </div>
      </Link>

      <div className="px-3 pb-4 pt-3">
        <div className="flex min-h-8 items-start justify-between gap-3">
          <Link
            to={`/listing/${encodeURIComponent(product.id)}`}
            className="line-clamp-2 text-sm font-normal leading-snug text-slate-950 hover:text-[#0759e6]"
          >
            {comboTitle}
          </Link>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-medium leading-none text-[#0759e6]">
            {formatPrice(product.price)}
          </span>
          {product.originalPrice ? (
            <span className="text-xs font-normal text-slate-400 line-through">
              {formatPrice(product.originalPrice)}
            </span>
          ) : null}
        </div>

        <div className="mt-5 text-center">
          <p className="text-xs font-normal text-[#0759e6]">Deal status</p>
          {product.dealStatus?.startsWith('Ends in') ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              {countdownParts(product.dealEndsAt, nowMs).map((part) => (
                <div
                  key={part.label}
                  className="grid h-[32px] min-w-[32px] w-[32px] place-items-center rounded-lg bg-white text-center text-[#dc1633] shadow-sm ring-1 ring-[#f8d9dd]"
                >
                  <span className="block text-[9px] font-medium leading-none">{part.value}</span>
                  <span className="mt-0.5 block text-[6px] font-normal leading-none text-slate-500">
                    {part.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 font-mono text-lg font-medium tracking-wide text-red-600">
              {product.dealStatus || formatCountdown(product.dealEndsAt, nowMs)}
            </p>
          )}
          {product.dealStatus?.startsWith('Ends in') ? (
            <Link
              to={`/order-summary/${encodeURIComponent(product.id)}`}
              className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-[#0759e6] px-3 text-xs font-medium text-white transition hover:bg-[#0448bd]"
            >
              Book Deal
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  to,
}: {
  icon: ReactElement;
  title: string;
  subtitle?: string;
  to: string;
}): ReactElement {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-medium text-slate-950">
          {icon}
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm font-normal text-slate-500">{subtitle}</p> : null}
      </div>
      <Link
        to={to}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#0759e6] hover:underline"
      >
        View All <ChevronRight size={17} />
      </Link>
    </div>
  );
}

export default function UserHomePage(): ReactElement {
  const [activeBanner, setActiveBanner] = useState(0);
  const [activeCategory, setActiveCategory] = useState('All');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => readSavedIds());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveBanner((value) => (value + 1) % HERO_BANNERS.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  const listingsQuery = useQuery({
    queryKey: ['nearhub-home-feed'],
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/listings?limit=80&homeFeedVersion=marketplace-v1`
      );
      if (!response.ok) throw new Error('Failed to load listings');
      const payload = (await response.json()) as ListingsResponse;
      return payload.data || payload.results || [];
    },
  });

  const liveListings = listingsQuery.data ?? EMPTY_LISTINGS;
  const regularListings = useMemo(
    () => liveListings.filter((item) => !isDeal(item) || !isDealExpired(item, nowMs)),
    [liveListings, nowMs]
  );
  const dealListings = useMemo(() => liveListings.filter(isDeal), [liveListings]);

  const upcomingDealListings = useMemo(
    () => dealListings.filter((item) => isDealUpcoming(item, nowMs)),
    [dealListings, nowMs]
  );

  const upcomingDeals = useMemo(
    () => upcomingDealListings.map((item) => mapListing(item, nowMs)),
    [upcomingDealListings, nowMs]
  );

  const expiredDealListings = useMemo(
    () => dealListings.filter((item) => isDealExpired(item, nowMs)),
    [dealListings, nowMs]
  );

  const trending = useMemo(() => {
    return [...regularListings]
      .sort((a, b) => {
        const aScore = Number(a.likeCount || 0) * 2 + Number(a.chatCount || 0) * 3;
        const bScore = Number(b.likeCount || 0) * 2 + Number(b.chatCount || 0) * 3;
        if (bScore !== aScore) return bScore - aScore;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      })
      .slice(0, 6)
      .map((item) => mapListing(item, nowMs));
  }, [regularListings, nowMs]);

  const todaysDeals = useMemo(() => {
    return dealListings
      .filter((item) => {
        const dealType = String(item.dealType || item.deal_type || '').toLowerCase();
        return dealType !== 'combo' && isDealActive(item, nowMs);
      })
      .sort((a, b) => Number(getDealEndMs(a, nowMs) || 0) - Number(getDealEndMs(b, nowMs) || 0))
      .slice(0, 6)
      .map((item) => mapListing(item, nowMs));
  }, [dealListings, nowMs]);

  const comboDeals = useMemo(() => {
    return dealListings
      .filter(
        (item) =>
          String(item.dealType || item.deal_type || '').toLowerCase() === 'combo' &&
          isDealActive(item, nowMs)
      )
      .slice(0, 4)
      .map((item) => mapListing(item, nowMs));
  }, [dealListings, nowMs]);

  const expiredDeals = useMemo(() => {
    return expiredDealListings
      .sort((a, b) => Number(getDealEndMs(b, nowMs) || 0) - Number(getDealEndMs(a, nowMs) || 0))
      .slice(0, 6)
      .map((item) => mapListing(item, nowMs));
  }, [expiredDealListings, nowMs]);

  const categoryProducts = useMemo(
    () => regularListings.map((item) => mapListing(item, nowMs)),
    [regularListings, nowMs]
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    categoryProducts.forEach((product) =>
      counts.set(product.category, (counts.get(product.category) || 0) + 1)
    );
    return [
      { label: 'All', count: categoryProducts.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count })),
    ];
  }, [categoryProducts]);

  const visibleCategoryProducts =
    activeCategory === 'All'
      ? categoryProducts.slice(0, 8)
      : categoryProducts.filter((item) => item.category === activeCategory).slice(0, 8);

  const toggleSaved = (id: string) => {
    const next = new Set(savedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSavedIds(next);
    localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...next]));
  };

  

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <LandingHeader active="home" />
      <main>
        <section className="w-full px-2 pt-[5.25rem] sm:px-4">
          <div className="relative overflow-hidden rounded-md bg-[#020b3b] shadow-sm">
            <img
              src={HERO_BANNERS[activeBanner]}
              alt="NearHub AI-powered local marketplace"
              className="h-[360px] w-full object-cover sm:h-[460px] lg:h-[640px]"
              loading="eager"
            />
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {HERO_BANNERS.map((banner, index) => (
                <button
                  key={banner}
                  type="button"
                  onClick={() => setActiveBanner(index)}
                  className={`h-3 w-3 rounded-full ${activeBanner === index ? 'bg-[#0759e6]' : 'bg-white/85'}`}
                  aria-label={`Show banner ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        <Container className="pb-8 font-inter font-normal pt-8">

          {listingsQuery.isLoading ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-600">
              Loading listings...
            </div>
          ) : null}

          {listingsQuery.isError ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-normal text-red-700">
              Live listings are unavailable right now.
            </div>
          ) : null}

          <section className="mt-8">
            <SectionHeader
              icon={<Flame className="fill-red-500 font-poppins text-red-500" size={22} />}
              title="Trending Near You"
              to="/search"
            />
            {trending.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {trending.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No listings are available yet." to="/create-listing" />
            )}
          </section>

          <section className="mt-9">
            <SectionHeader
              icon={<Tag className="text-[#0759e6]" size={22} />}
              title="Today's Deals"
              to="/deals"
            />
            {todaysDeals.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {todaysDeals.map((product) => (
                  <ProductCard
                    key={`deal-${product.id}`}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    showCountdown
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No active deals are available right now." />
            )}
          </section>

          <section className="mt-9">
            <SectionHeader
              icon={<Flame className="fill-orange-400 text-orange-500" size={22} />}
              title="Upcoming Deals"
              subtitle="Deals starting soon near you"
              to="/deals"
            />
            {upcomingDeals.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {upcomingDeals.map((product) => (
                  <ProductCard
                    key={`upcoming-${product.id}`}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    showCountdown
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No upcoming deals are available right now." />
            )}
          </section>

          <section className="mt-9">
            <SectionHeader
              icon={<Gift className="fill-orange-500 text-orange-500" size={22} />}
              title="Combo Deals You'll Love"
              subtitle="Save more with handpicked product bundles near you"
              to="/deals"
            />
            {comboDeals.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {comboDeals.map((product) => (
                  <ComboDealCard key={`combo-${product.id}`} product={product} nowMs={nowMs} />
                ))}
              </div>
            ) : (
              <EmptyState message="No combo deals are available right now." />
            )}
          </section>

          <section className="mt-9">
            <SectionHeader
              icon={<History className="text-slate-500" size={22} />}
              title="Expired Deals"
              subtitle="Closed offers are still visible for price reference"
              to="/deals"
            />
            {expiredDeals.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {expiredDeals.map((product) => (
                  <ProductCard
                    key={`expired-${product.id}`}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    showCountdown
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No expired deals yet." />
            )}
          </section>

          <section className="mt-9">
            <SectionHeader
              icon={<PackagePlus className="text-[#0759e6]" size={22} />}
              title="Categories"
              to="/search"
            />
            <div className="mb-5 flex flex-wrap gap-3">
              {categories.map((category) => (
                <button
                  key={category.label}
                  type="button"
                  onClick={() => setActiveCategory(category.label)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-normal transition ${
                    activeCategory === category.label
                      ? 'border-[#0759e6] bg-[#0759e6] text-white'
                      : 'border-slate-200 bg-white text-slate-950 hover:border-[#0759e6]'
                  }`}
                >
                  {category.label}
                  {category.count ? ` (${category.count})` : ''}
                </button>
              ))}
            </div>
            {visibleCategoryProducts.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {visibleCategoryProducts.map((product) => (
                  <ProductCard
                    key={`category-${product.id}`}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No listings found for this category." />
            )}
          </section>
        </Container>
      </main>
      <LandingFooter />
    </div>
  );
}
