import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, RefreshCw, Tag, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { formatDealStatus, getEffectiveDealWindow } from '@/lib/deal-timer';
import { readStoredWebUser } from '@/lib/web-auth-storage';

type Listing = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  price?: string | number;
  offerPrice?: string | number;
  images?: string[];
  createdAt?: string;
  status?: string;
  isActive?: boolean;
  is_active?: boolean;
  isDeal?: boolean;
  dealStartAt?: string;
  dealEndAt?: string;
  dealRecurrence?: string;
  dealRecurrenceUntil?: string;
  dealType?: string;
  postDealPriceMode?: string;
  postDealDiscountPrice?: string | number;
  is_deal?: boolean;
  deal_start_at?: string;
  deal_end_at?: string;
  deal_recurrence?: string;
  deal_recurrence_until?: string;
  deal_type?: string;
  post_deal_price_mode?: string;
  post_deal_discount_price?: string | number;
};

const FALLBACK_IMAGE = '/nearhub.png';
const SAVED_IDS_KEY = 'nearhub_web_saved_listing_ids';
const SAVED_LISTINGS_KEY = 'nearhub_web_saved_listing_snapshots';

function normalizeImageUrl(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return FALLBACK_IMAGE;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
    return raw;
  }
  return FALLBACK_IMAGE;
}

type ListingsResponse = {
  success: boolean;
  data?: Listing[];
  results?: Listing[];
};

type BrowseListingsProps = {
  dealsOnly?: boolean;
};

type BrowseCategory = {
  label: string;
  mainCategory?: string;
  subCategory?: string;
};

const categories: BrowseCategory[] = [
  { label: 'All' },
  { label: 'Electronics', mainCategory: 'Electronics & Appliances' },
  { label: 'Furniture', mainCategory: 'Home, Property & Living' },
  { label: 'Vehicles', mainCategory: 'Vehicles' },
  { label: 'Fashion', mainCategory: 'Fashion & Lifestyle' },
  { label: 'Services', mainCategory: 'Jobs & Services' },
  { label: 'Food & Travel', mainCategory: 'Food, Travel & Events' },
  { label: 'Others', mainCategory: 'Community, Pets & Others' },
];

function formatPrice(value: string | number | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return 'Price on request';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n as number);
}

function getDealStatus(listing: Listing): string {
  const isDeal = Boolean(listing.isDeal ?? listing.is_deal);
  if (!isDeal) return '';
  const status = formatDealStatus(listing, Date.now());
  return status === 'Deal expired' ? 'Closed' : status;
}

function parsePrice(value: string | number | undefined): number {
  const amount = typeof value === 'string' ? Number(value) : Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function getPostDealPriceMode(listing: Listing): string {
  return String(
    listing.postDealPriceMode || listing.post_deal_price_mode || 'original'
  ).toLowerCase();
}

function getDisplayPriceValue(listing: Listing): string | number | undefined {
  const offer = parsePrice(listing.offerPrice);
  const base = parsePrice(listing.price);
  const postDealDiscount = parsePrice(
    listing.postDealDiscountPrice ?? listing.post_deal_discount_price
  );
  if (!offer || !base || offer >= base) return listing.price;
  const isDeal = Boolean(listing.isDeal ?? listing.is_deal);
  if (!isDeal) return listing.offerPrice;
  const window = getEffectiveDealWindow(listing, Date.now());
  if (!window || Date.now() <= window.endMs) return listing.offerPrice;
  if (getPostDealPriceMode(listing) !== 'discount') return listing.price;
  return postDealDiscount && postDealDiscount < base ? postDealDiscount : listing.offerPrice;
}

export default function BrowseListings({ dealsOnly = false }: BrowseListingsProps): ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const storedUser = useMemo(() => readStoredWebUser(), []);
  const query = searchParams.get('q') ?? '';
  const location = searchParams.get('location') ?? '';
  const latitude = searchParams.get('latitude') ?? '';
  const longitude = searchParams.get('longitude') ?? '';
  const storedRadiusKm = Number(storedUser?.preferences?.searchRadiusKm ?? 50);
  const effectiveRadiusKm =
    Number.isFinite(storedRadiusKm) && storedRadiusKm > 0 ? storedRadiusKm : 50;
  const [category, setCategory] = useState(() => searchParams.get('category') ?? 'All');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCategory(searchParams.get('category') ?? 'All');
  }, [searchParams]);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(SAVED_IDS_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
    } catch {
      return new Set();
    }
  });

  const toggleSaved = (listing: Listing) => {
    const id = listing.id;
    const next = new Set(savedIds);
    let snapshots: Record<string, Listing> = {};

    try {
      const raw = localStorage.getItem(SAVED_LISTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      snapshots =
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Record<string, Listing>)
          : {};
    } catch {
      snapshots = {};
    }

    if (next.has(id)) {
      next.delete(id);
      delete snapshots[id];
    } else {
      next.add(id);
      snapshots[id] = listing;
    }

    setSavedIds(next);
    localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...next]));
    localStorage.setItem(SAVED_LISTINGS_KEY, JSON.stringify(snapshots));
  };

  const handleRefresh = () => {
    navigate('/search');
  };

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '60');
    const selectedCategory = categories.find((item) => item.label === category);
    if (selectedCategory?.mainCategory) params.set('mainCategory', selectedCategory.mainCategory);
    if (selectedCategory?.subCategory) params.set('subCategory', selectedCategory.subCategory);
    if (!selectedCategory && category !== 'All') params.set('category', category);
    if (location.trim()) params.set('location', location.trim());
    if (latitude && longitude) {
      params.set('latitude', latitude);
      params.set('longitude', longitude);
      params.set('radius', String(effectiveRadiusKm));
    }
    if (query.trim()) params.set('q', query.trim());
    const searchPath = query.trim() || location.trim() ? '/api/listings/search' : '/api/listings';
    return `${getApiUrl()}${searchPath}?${params.toString()}`;
  }, [category, effectiveRadiusKm, latitude, longitude, location, query]);

  const listingsQuery = useQuery({
    queryKey: ['public-listings', query, category, location, latitude, longitude, dealsOnly],
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to load listings');
      }
      const data = (await response.json()) as ListingsResponse;
      const normalized = (data.data || data.results || [])
        .map((item: Listing) => ({
          ...item,
          isDeal: Boolean(item.isDeal ?? item.is_deal),
          dealStartAt: item.dealStartAt || item.deal_start_at,
          dealEndAt: item.dealEndAt || item.deal_end_at,
          dealType: String(item.dealType || item.deal_type || '').toLowerCase(),
          postDealPriceMode: String(
            item.postDealPriceMode || item.post_deal_price_mode || 'original'
          ).toLowerCase(),
          postDealDiscountPrice: item.postDealDiscountPrice ?? item.post_deal_discount_price,
        }))
        .filter((item) => {
          const status = String(item.status || 'active').toLowerCase();
          const isActive = item.isActive ?? item.is_active ?? true;
          return Boolean(isActive) && status === 'active';
        });
      return dealsOnly ? normalized.filter((item) => item.isDeal) : normalized;
    },
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active={dealsOnly ? 'deals' : 'browse'} />
      <main className="w-full px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <section className="rounded-3xl border border-[#1e5da8]/15 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(30,93,168,0.68)]">
          <h1 className="text-3xl font-bold text-[#113965]">
            {dealsOnly ? (
              'Deals Near You'
            ) : (
              <>
                Browse Local Deals &{' '}
                <span className="bg-[linear-gradient(90deg,#e66e32,#7567c7,#1e5da8)] bg-clip-text text-transparent">
                  Nearby Listings
                </span>
              </>
            )}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {dealsOnly
              ? 'Find active and upcoming deal listings around you.'
              : 'Find products and services around you, directly from NearHub listings.'}
          </p>

          <div className="mt-5 flex items-center justify-end">
            <button
              type="button"
              onClick={handleRefresh}
              className="h-9 rounded-lg bg-[#1e5da8] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#174a86]"
            >
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw size={14} />
                Refresh
              </span>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item.label}
                onClick={() => setCategory(item.label)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  category === item.label
                    ? 'border-[#1e5da8] bg-[#1e5da8] text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-[#1e5da8]/40'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          {listingsQuery.isLoading ? <p className="text-slate-600">Loading listings...</p> : null}
          {listingsQuery.isError ? (
            <p className="text-red-600">Could not load listings right now.</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(listingsQuery.data || []).map((listing) => {
              const isComboDeal =
                String(listing.dealType || listing.deal_type || '').toLowerCase() === 'combo';
              const primaryImage = listing.images?.[0];
              const secondaryImage = listing.images?.[1];
              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`relative aspect-[4/3] bg-slate-100 ${isComboDeal ? 'combo-float' : ''}`}
                  >
                    <div className={`h-full w-full ${isComboDeal ? 'combo-float-card' : ''}`}>
                      {isComboDeal && secondaryImage ? (
                        <div className="combo-image-stack">
                          <img
                            src={
                              brokenImages[listing.id]
                                ? FALLBACK_IMAGE
                                : normalizeImageUrl(secondaryImage)
                            }
                            alt={listing.title}
                            className="combo-image-layer combo-image-bottom"
                            loading="lazy"
                            onError={() =>
                              setBrokenImages((prev) => ({
                                ...prev,
                                [listing.id]: true,
                              }))
                            }
                          />
                          <img
                            src={
                              brokenImages[listing.id]
                                ? FALLBACK_IMAGE
                                : normalizeImageUrl(primaryImage)
                            }
                            alt={listing.title}
                            className="combo-image-layer combo-image-top"
                            loading="lazy"
                            onError={() =>
                              setBrokenImages((prev) => ({
                                ...prev,
                                [listing.id]: true,
                              }))
                            }
                          />
                        </div>
                      ) : listing.images?.[0] ? (
                        <img
                          src={
                            brokenImages[listing.id]
                              ? FALLBACK_IMAGE
                              : normalizeImageUrl(listing.images[0])
                          }
                          alt={listing.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={() =>
                            setBrokenImages((prev) => ({
                              ...prev,
                              [listing.id]: true,
                            }))
                          }
                        />
                      ) : (
                        <img
                          src={FALLBACK_IMAGE}
                          alt="NearHub"
                          className="h-full w-full object-contain p-8 opacity-80"
                          loading="lazy"
                        />
                      )}
                    </div>
                    {isComboDeal ? (
                      <span className="absolute left-3 top-3 rounded-full bg-[#ff7b00] px-2.5 py-1 text-[11px] font-black text-white shadow-sm">
                        Combo Deal
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleSaved(listing)}
                      aria-label={
                        savedIds.has(listing.id) ? 'Remove from favourites' : 'Add to favourites'
                      }
                      className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-rose-600"
                    >
                      <Heart
                        size={18}
                        className={savedIds.has(listing.id) ? 'fill-rose-500 text-rose-500' : ''}
                      />
                    </button>
                  </div>
                  <div className="p-3">
                    <h2 className="line-clamp-1 text-sm font-black text-slate-900">
                      {listing.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-600">
                      {listing.description || 'No description available'}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#1e5da8]/10 px-2 py-1 font-semibold text-[#1e5da8]">
                        <Tag size={12} />
                        {listing.category || 'General'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <MapPin size={12} />
                        {listing.location || 'Nearby'}
                      </span>
                    </div>
                    {(listing.isDeal ?? listing.is_deal) ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${getDealStatus(listing) === 'Closed' ? 'text-rose-600' : 'text-emerald-700'}`}
                        >
                          {getDealStatus(listing)}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm font-black text-[#0f4b8a]">
                        {formatPrice(getDisplayPriceValue(listing))}
                      </p>
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/listing/${listing.id}`}
                          className="text-xs font-black text-[#ff7b00] hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!listingsQuery.isLoading && (listingsQuery.data || []).length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600">
              {dealsOnly
                ? 'No deals found. Try a different category, location, or search term.'
                : 'No listings found. Try a different category, location, or search term.'}
            </div>
          ) : null}
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
