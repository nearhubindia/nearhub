import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, RefreshCw, Tag, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { formatDealStatus, getEffectiveDealWindow } from '@/lib/deal-timer';
import { readStoredWebUser } from '@/lib/web-auth-storage';
import { FALLBACK_LISTING_IMAGE, getListingImages } from '@/features/landing/lib/listing-images';
import {
  SAVED_LISTING_IDS_KEY,
  formatPriceInr,
  parsePositiveNumber,
  readStoredStringSet,
  writeStoredStringSet,
} from '@/features/landing/lib/landing-utils';

type Listing = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  price?: string | number;
  offerPrice?: string | number;
  image?: string;
  imageUrl?: string;
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

const FALLBACK_IMAGE = FALLBACK_LISTING_IMAGE;
const SAVED_LISTINGS_KEY = 'nearhub_web_saved_listing_snapshots';

type ListingsResponse = {
  success: boolean;
  data?: Listing[];
  results?: Listing[];
};

type ListingsQueryResult = {
  listings: Listing[];
  usedLocationFallback: boolean;
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

function getDealStatus(listing: Listing): string {
  const isDeal = Boolean(listing.isDeal ?? listing.is_deal);
  if (!isDeal) return '';
  const status = formatDealStatus(listing, Date.now());
  return status === 'Deal expired' ? 'Closed' : status;
}

function getPostDealPriceMode(listing: Listing): string {
  return String(
    listing.postDealPriceMode || listing.post_deal_price_mode || 'original'
  ).toLowerCase();
}

function getDisplayPriceValue(listing: Listing): string | number | undefined {
  const offer = parsePositiveNumber(listing.offerPrice) || 0;
  const base = parsePositiveNumber(listing.price) || 0;
  const postDealDiscount =
    parsePositiveNumber(listing.postDealDiscountPrice ?? listing.post_deal_discount_price) || 0;
  if (!offer || !base || offer >= base) return listing.price;
  const isDeal = Boolean(listing.isDeal ?? listing.is_deal);
  if (!isDeal) return listing.offerPrice;
  const window = getEffectiveDealWindow(listing, Date.now());
  if (!window || Date.now() <= window.endMs) return listing.offerPrice;
  if (getPostDealPriceMode(listing) !== 'discount') return listing.price;
  return postDealDiscount && postDealDiscount < base ? postDealDiscount : listing.offerPrice;
}

function normalizeListings(items: Listing[]): Listing[] {
  return items
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
}

export default function BrowseListings({ dealsOnly = false }: BrowseListingsProps): ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const storedUser = useMemo(() => readStoredWebUser(), []);
  const query = searchParams.get('q') ?? '';
  const location = searchParams.get('location') ?? '';
  const latitude = searchParams.get('latitude') ?? '';
  const longitude = searchParams.get('longitude') ?? '';
  const hasLocationFilter = Boolean(location.trim() && latitude && longitude);
  const storedRadiusKm = Number(storedUser?.preferences?.searchRadiusKm ?? 50);
  const effectiveRadiusKm =
    Number.isFinite(storedRadiusKm) && storedRadiusKm > 0 ? storedRadiusKm : 50;
  const category = searchParams.get('category') ?? 'All';
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(() =>
    readStoredStringSet(SAVED_LISTING_IDS_KEY)
  );

  const updateCategory = (nextCategory: string) => {
    const params = new URLSearchParams(searchParams);
    if (nextCategory === 'All') params.delete('category');
    else params.set('category', nextCategory);
    navigate({ search: params.toString() });
  };

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
    writeStoredStringSet(SAVED_LISTING_IDS_KEY, next);
    localStorage.setItem(SAVED_LISTINGS_KEY, JSON.stringify(snapshots));
  };

  const handleRefresh = () => {
    navigate('/search');
  };

  const buildEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '60');
    const selectedCategory = categories.find((item) => item.label === category);
    if (selectedCategory?.mainCategory) params.set('mainCategory', selectedCategory.mainCategory);
    if (selectedCategory?.subCategory) params.set('subCategory', selectedCategory.subCategory);
    if (!selectedCategory && category !== 'All') params.set('category', category);
    if (location.trim()) params.set('location', location.trim());
    if (hasLocationFilter) {
      params.set('latitude', latitude);
      params.set('longitude', longitude);
      params.set('radius', String(effectiveRadiusKm));
    }
    if (query.trim()) params.set('q', query.trim());
    const searchPath = query.trim() || location.trim() ? '/api/listings/search' : '/api/listings';
    return {
      filtered: `${getApiUrl()}${searchPath}?${params.toString()}`,
      fallback: `${getApiUrl()}${query.trim() ? '/api/listings/search' : '/api/listings'}?${new URLSearchParams(
        {
          ...Object.fromEntries(
            Array.from(params.entries()).filter(
              ([key]) => !['location', 'latitude', 'longitude', 'radius'].includes(key)
            )
          ),
        }
      ).toString()}`,
    };
  }, [category, effectiveRadiusKm, hasLocationFilter, latitude, longitude, location, query]);

  const listingsQuery = useQuery({
    queryKey: ['public-listings', query, category, location, latitude, longitude, dealsOnly],
    queryFn: async (): Promise<ListingsQueryResult> => {
      const load = async (endpoint: string) => {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to load listings');
        }
        const data = (await response.json()) as ListingsResponse;
        const normalized = normalizeListings(data.data || data.results || []);
        return dealsOnly ? normalized.filter((item) => item.isDeal) : normalized;
      };

      const filteredListings = await load(buildEndpoint.filtered);
      if (!hasLocationFilter || filteredListings.length > 0) {
        return { listings: filteredListings, usedLocationFallback: false };
      }

      return {
        listings: await load(buildEndpoint.fallback),
        usedLocationFallback: true,
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!listingsQuery.data?.usedLocationFallback) return;
    window.alert('No products are available at this location. Showing all listings.');
  }, [listingsQuery.data?.usedLocationFallback]);

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
                onClick={() => updateCategory(item.label)}
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

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {(listingsQuery.data?.listings || []).map((listing) => {
              const isComboDeal =
                String(listing.dealType || listing.deal_type || '').toLowerCase() === 'combo';
              const listingImages = getListingImages(listing);
              const primaryImage = listingImages[0];
              const secondaryImage = listingImages[1];
              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`relative aspect-[1.05] bg-slate-100 sm:aspect-[4/3] ${isComboDeal ? 'combo-float' : ''}`}
                  >
                    <div className={`h-full w-full ${isComboDeal ? 'combo-float-card' : ''}`}>
                      {isComboDeal && secondaryImage ? (
                        <div className="combo-image-stack">
                          <img
                            src={
                              brokenImages[listing.id]
                                ? FALLBACK_IMAGE
                                : secondaryImage || FALLBACK_IMAGE
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
                                : primaryImage || FALLBACK_IMAGE
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
                      ) : primaryImage ? (
                        <img
                          src={brokenImages[listing.id] ? FALLBACK_IMAGE : primaryImage}
                          alt={listing.title}
                          className="h-full w-full object-cover object-center"
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
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-[#ff7b00] px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]">
                        Combo Deal
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleSaved(listing)}
                      aria-label={
                        savedIds.has(listing.id) ? 'Remove from favourites' : 'Add to favourites'
                      }
                      className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-rose-600 sm:right-3 sm:top-3 sm:h-9 sm:w-9"
                    >
                      <Heart
                        size={18}
                        className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${
                          savedIds.has(listing.id) ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>
                  </div>
                  <div className="p-2 sm:p-3">
                    <h2 className="line-clamp-1 text-xs font-black text-slate-900 sm:text-sm">
                      {listing.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-slate-600 sm:text-xs sm:leading-5">
                      {listing.description || 'No description available'}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-1 text-[10px] sm:mt-3 sm:text-xs">
                      <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[#1e5da8]/10 px-1.5 py-0.5 font-semibold text-[#1e5da8] sm:px-2 sm:py-1">
                        <Tag size={12} className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                        <span className="truncate">{listing.category || 'General'}</span>
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1 text-slate-500">
                        <MapPin size={12} className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                        <span className="truncate">{listing.location || 'Nearby'}</span>
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
                    <div className="mt-2 flex items-center justify-between sm:mt-3">
                      <p className="text-xs font-black text-[#0f4b8a] sm:text-sm">
                        {formatPriceInr(getDisplayPriceValue(listing))}
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

          {!listingsQuery.isLoading && (listingsQuery.data?.listings || []).length === 0 ? (
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
