import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Grid2X2,
  Flame,
  Heart,
  History,
  MapPin,
  Search,
  Tag,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LandingFooter, LandingHeader, Container } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import {
  formatDealStatus,
  getEffectiveDealWindow,
  isDealExpiredWithinWindow,
  isDealUpcomingWithinWindow,
} from '@/lib/deal-timer';
import { FALLBACK_LISTING_IMAGE, getListingImages } from '@/features/landing/lib';
import { readStoredWebUser } from '@/lib/web-auth-storage';
import { readStoredWebGeoCoords } from '@/lib/web-geo-storage';
import {
  SAVED_LISTING_IDS_KEY,
  countdownPartsFromMs,
  discountPercentage,
  formatPriceInr,
  filterActiveListings,
  filterFeaturedListings,
  getHomeListingLocationLabel,
  parsePositiveNumber,
  readStoredStringSet,
  writeStoredStringSet,
} from '@/features/landing/lib';

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
  dealStatus?: string;
  deal_status?: string;
  dealCycleQuantity?: number | string;
  deal_cycle_quantity?: number | string;
  maxDealBookings?: number | string;
  max_deal_bookings?: number | string;
  dealBookingsUsed?: number | string;
  deal_bookings_used?: number | string;
  purchaseLimitType?: string;
  purchase_limit_type?: string;
  status?: string;
  isActive?: boolean;
  is_active?: boolean;
  comboItems?: string[] | string;
  latitude?: number | string;
  longitude?: number | string;
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
  purchaseLimitType?: 'ONE_TIME' | 'UNLIMITED';
  comboItems?: string[];
};

type ListingsResponse = {
  success?: boolean;
  data?: Listing[];
  results?: Listing[];
};

type InAppNotification = {
  id: string;
  category?: string | null;
  isRead?: boolean;
};

type NotificationsResponse = {
  success?: boolean;
  data?: InAppNotification[];
};

type ListingsQueryResult = {
  listings: Listing[];
  usedLocationFallback: boolean;
};

const FALLBACK_IMAGE = FALLBACK_LISTING_IMAGE;
const HERO_BANNERS = ['/banner1.png', '/banner2.png'];
const EMPTY_LISTINGS: Listing[] = [];
const HIDDEN_LISTING_STATUSES = new Set(['draft', 'pending', 'rejected', 'sold', 'deleted']);

function normalizePurchaseLimitType(value: unknown): 'ONE_TIME' | 'UNLIMITED' | undefined {
  const normalized = String(value || '').toUpperCase();
  return normalized === 'ONE_TIME' || normalized === 'UNLIMITED' ? normalized : undefined;
}

function purchaseLimitLabel(value?: 'ONE_TIME' | 'UNLIMITED'): string {
  if (value === 'ONE_TIME') return 'One Purchase Per Customer';
  if (value === 'UNLIMITED') return 'Unlimited Purchases';
  return '';
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

function MobileCountdownTiles({
  endAt,
  nowMs,
  className = '',
}: {
  endAt: number | undefined;
  nowMs: number;
  className?: string;
}): ReactElement {
  return (
    <div className={`grid grid-cols-4 gap-1 ${className}`}>
      {countdownPartsFromMs(endAt, nowMs).map((part) => (
        <div
          key={part.label}
          className="grid h-[34px] min-w-0 place-items-center rounded-lg bg-white text-center text-[#ef3045] shadow-sm ring-1 ring-[#ffd7dc]"
        >
          <span className="block text-[10px] font-semibold leading-none">{part.value}</span>
          <span className="mt-0.5 block text-[5px] font-semibold uppercase leading-none tracking-[0.12em] text-slate-500">
            {part.label}
          </span>
        </div>
      ))}
    </div>
  );
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

function numberValue(value: number | string | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isVisibleListing(item: Listing): boolean {
  const status = String(item.status || 'active')
    .trim()
    .toLowerCase();
  const isActive = item.isActive ?? item.is_active ?? true;
  return Boolean(isActive) && !HIDDEN_LISTING_STATUSES.has(status);
}

function normalizeListings(items: Listing[]): Listing[] {
  return items
    .map((item) => ({
      ...item,
      isDeal: Boolean(item.isDeal ?? item.is_deal),
      isActive: item.isActive ?? item.is_active ?? true,
      status: String(item.status || 'active').toLowerCase(),
      dealType: String(item.dealType || item.deal_type || '').toLowerCase(),
      dealStatus: String(item.dealStatus || item.deal_status || '').toLowerCase(),
    }))
    .filter(isVisibleListing);
}

function normalizeDealListings(items: Listing[]): Listing[] {
  return items.map((item) => ({
    ...item,
    isDeal: Boolean(item.isDeal ?? item.is_deal),
    isActive: item.isActive ?? item.is_active ?? true,
    status: String(item.status || 'active').toLowerCase(),
    dealType: String(item.dealType || item.deal_type || '').toLowerCase(),
    dealStatus: String(item.dealStatus || item.deal_status || '').toLowerCase(),
  }));
}

function isDealStockCompleted(item: Listing): boolean {
  const maxSlots =
    numberValue(item.dealCycleQuantity ?? item.deal_cycle_quantity) ||
    numberValue(item.maxDealBookings ?? item.max_deal_bookings);
  const usedSlots = numberValue(item.dealBookingsUsed ?? item.deal_bookings_used);
  return maxSlots > 0 && usedSlots >= maxSlots;
}

function isDealMarkedCompleted(item: Listing): boolean {
  const status = String(item.dealStatus ?? item.deal_status ?? item.status ?? '').toLowerCase();
  return [
    'completed',
    'complete',
    'closed',
    'expired',
    'sold_out',
    'sold-out',
    'stock_completed',
  ].includes(status);
}

function isDealCompleted(item: Listing, nowMs: number): boolean {
  return (
    isDeal(item) &&
    (isDealExpiredWithinWindow(item, nowMs) || isDealStockCompleted(item) || isDealMarkedCompleted(item))
  );
}

function isDealAvailableForDealSections(item: Listing, nowMs: number): boolean {
  return isDeal(item) && !isDealCompleted(item, nowMs);
}

function getPostDealPriceMode(item: Listing): string {
  return String(item.postDealPriceMode || item.post_deal_price_mode || 'original').toLowerCase();
}

function getDisplayPrices(
  item: Listing,
  nowMs: number
): { displayPrice: number | undefined; originalPrice: number | undefined } {
  const offerPrice = parsePositiveNumber(item.offerPrice);
  const price = parsePositiveNumber(item.price);
  const postDealDiscountPrice = parsePositiveNumber(
    item.postDealDiscountPrice ?? item.post_deal_discount_price
  );
  if (!price) return { displayPrice: offerPrice, originalPrice: undefined };
  if (!offerPrice || offerPrice >= price) return { displayPrice: price, originalPrice: undefined };
  if (!isDeal(item)) return { displayPrice: offerPrice, originalPrice: price };

  const endAt = getDealEndMs(item, nowMs);
  if (!endAt || nowMs <= endAt) return { displayPrice: offerPrice, originalPrice: price };
  if (getPostDealPriceMode(item) !== 'discount')
    return { displayPrice: offerPrice, originalPrice: price };

  const afterDealPrice =
    postDealDiscountPrice && postDealDiscountPrice < price ? postDealDiscountPrice : offerPrice;
  return { displayPrice: afterDealPrice, originalPrice: price };
}

function mapListing(
  item: Listing,
  nowMs: number
): ProductCardData {
  const { displayPrice, originalPrice } = getDisplayPrices(item, nowMs);
  const images = getListingImages(item);
  const locationLabel = getHomeListingLocationLabel(item);
  return {
    id: item.id,
    title: item.title || 'Untitled listing',
    category: item.category || 'General',
    location: locationLabel,
    image: images[0] || FALLBACK_IMAGE,
    images,
    price: displayPrice,
    originalPrice,
    distance: locationLabel,
    badge: isDealActive(item, nowMs) ? 'Deal' : undefined,
    dealEndsAt: getDealEndMs(item, nowMs),
    dealStatus: formatDealStatus(item, nowMs),
    purchaseLimitType: normalizePurchaseLimitType(
      item.purchaseLimitType ?? item.purchase_limit_type
    ),
    comboItems: parseComboItems(item.comboItems),
  };
}

function EmptyState({ message, to }: { message: string; to?: string }): ReactElement {
  return (
      <div className="rounded-[5px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-normal text-slate-600">{message}</p>
      {to ? (
        <Link
          to={to}
          className="mt-3 inline-flex rounded-[5px] bg-[#0759e6] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0448bd]"
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
  mobileVariant = 'default',
  nowMs,
}: {
  product: ProductCardData;
  saved: boolean;
  onToggleSaved: (id: string) => void;
  showCountdown?: boolean;
  mobileVariant?: 'default' | 'overlay' | 'deal';
  nowMs: number;
}): ReactElement {
  const sale = discountPercentage(product.price, product.originalPrice);
  const dealTag = sale || product.badge || (showCountdown ? 'Deal' : null);
  const mobileCardWidth =
    mobileVariant === 'overlay'
      ? 'max-md:h-[168px] max-md:w-[min(82vw,220px)] max-md:shrink-0 md:w-auto md:shrink'
      : mobileVariant === 'deal'
        ? 'max-md:w-[calc((100vw-40px)/2)] max-md:min-w-[156px] max-md:max-w-[178px] max-md:shrink-0 md:w-auto md:shrink'
        : '';
  const mobileShell =
    mobileVariant === 'overlay'
      ? 'max-md:relative max-md:rounded-2xl max-md:border-slate-300 max-md:bg-slate-950'
      : mobileVariant === 'deal'
        ? 'max-md:rounded-2xl max-md:border-slate-300 max-md:bg-white'
        : '';
  const imageShape =
    mobileVariant === 'overlay'
      ? 'max-md:h-full max-md:overflow-hidden max-md:rounded-2xl'
      : mobileVariant === 'deal'
        ? 'max-md:h-[calc((100vw-40px)/2)] max-md:min-h-[156px] max-md:max-h-[178px] max-md:overflow-hidden max-md:rounded-t-xl'
        : '';

  return (
    <article
      className={`group overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${mobileCardWidth} ${mobileShell}`}
    >
      <Link to={`/listing/${encodeURIComponent(product.id)}`} className="block">
        <div className={`relative bg-slate-100 ${imageShape} aspect-[1.02] sm:aspect-[1.14]`}>
          <img
            src={product.image}
            alt={product.title}
            className={`h-full w-full ${
              mobileVariant === 'deal' ? 'bg-white object-cover object-center' : 'object-cover'
            }`}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          {sale && !showCountdown ? (
            <span
              className={`absolute left-1.5 top-1.5 inline-flex min-w-[3.75rem] items-center justify-center rounded-[5px] bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm sm:left-2 sm:top-2 sm:min-w-[4.5rem] sm:px-2.5 sm:py-1 sm:text-xs ${
                mobileVariant !== 'default' ? 'max-md:hidden' : ''
              }`}
            >
              {sale}
            </span>
          ) : null}
          {product.badge && !showCountdown ? (
            <span
              className={`absolute top-1.5 inline-flex min-w-[3.5rem] items-center justify-center rounded-[5px] bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm sm:top-2 sm:min-w-[4rem] sm:px-2.5 sm:py-1 sm:text-xs ${sale ? 'right-1.5 sm:right-2' : 'left-1.5 sm:left-2'}`}
            >
              {product.badge}
            </span>
          ) : null}
          {showCountdown && dealTag ? (
              <span className="absolute left-0 top-0 z-10 inline-flex min-w-[4rem] items-center justify-center rounded-br-[5px] bg-red-600 px-2.5 py-1 text-[10px] font-black leading-none text-white shadow-[6px_0_0_#d8c4b6] md:left-2 md:top-2 md:min-w-[4.75rem] md:rounded-[5px] md:px-3 md:py-1 md:text-[10px] md:shadow-sm">
              {dealTag}
            </span>
          ) : null}
        </div>
      </Link>
      <div
        className={`p-2 sm:p-3 ${
          mobileVariant === 'overlay'
            ? 'max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:bg-gradient-to-t max-md:from-black/90 max-md:via-black/65 max-md:to-transparent max-md:p-3 max-md:pt-12'
            : ''
        } ${mobileVariant === 'deal' ? 'max-md:px-2 max-md:pb-2 max-md:pt-1.5' : ''}`}
      >
        <div className="flex min-h-6 items-start justify-between gap-1 sm:min-h-10 sm:gap-2">
          <Link
            to={`/listing/${encodeURIComponent(product.id)}`}
            className={`line-clamp-2 text-xs font-normal leading-snug text-slate-950 hover:text-[#0858d8] sm:text-sm ${
              mobileVariant === 'overlay' ? 'max-md:text-white max-md:hover:text-white' : ''
            } ${mobileVariant === 'deal' ? 'max-md:text-[11px] max-md:font-semibold' : ''}`}
          >
            {product.title}
          </Link>
          <button
            type="button"
            onClick={() => onToggleSaved(product.id)}
            className={`shrink-0 rounded-[5px] p-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-red-600 sm:p-1 ${
              mobileVariant === 'overlay' ? 'max-md:text-white max-md:hover:bg-white/10' : ''
            }`}
            aria-label={saved ? 'Remove from favourites' : 'Save listing'}
          >
            <Heart
              size={16}
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${saved ? 'fill-red-500 text-red-500' : ''}`}
            />
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-1 sm:mt-2 sm:gap-2">
          <span
            className={`whitespace-nowrap text-sm font-medium leading-none text-[#0759e6] sm:text-base ${
              mobileVariant === 'overlay' ? 'max-md:text-white' : ''
            } ${mobileVariant === 'deal' ? 'max-md:text-[13px] max-md:font-semibold max-md:text-slate-950' : ''}`}
          >
            {formatPriceInr(product.price)}
          </span>
          {product.originalPrice ? (
            <span
              className={`whitespace-nowrap text-[10px] font-normal leading-none text-slate-400 line-through sm:text-xs ${
                mobileVariant === 'overlay' ? 'max-md:text-white/60' : ''
              }`}
            >
              {formatPriceInr(product.originalPrice)}
            </span>
          ) : null}
        </div>
        <div
          className={`mt-1.5 flex items-center gap-1 text-[10px] font-normal text-slate-600 sm:mt-2 sm:text-xs ${
            mobileVariant === 'overlay' ? 'max-md:text-white' : ''
          } ${mobileVariant === 'deal' ? 'max-md:mt-1 max-md:text-[10px]' : ''}`}
        >
          <MapPin size={12} className="h-[11px] w-[11px] sm:h-3 sm:w-3" />
          <span className="truncate">{product.distance}</span>
        </div>
        {showCountdown && product.dealStatus ? (
          product.dealStatus.startsWith('Ends in') ? (
            <div className="mt-1.5 text-center sm:mt-3">
              <MobileCountdownTiles
                endAt={product.dealEndsAt}
                nowMs={nowMs}
                className="border-t border-slate-100 pt-1 md:hidden"
              />
              <div className="max-md:hidden">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#0759e6]">
                  DEAL ENDS IN
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {countdownPartsFromMs(product.dealEndsAt, nowMs).map((part) => (
                    <div
                      key={part.label}
                      className="grid h-[36px] min-w-[36px] w-[36px] place-items-center rounded-[5px] bg-white text-center text-[#dc1633] shadow-sm ring-1 ring-[#f8d9dd]"
                    >
                      <span className="block text-[10px] font-medium leading-none">
                        {part.value}
                      </span>
                      <span className="mt-0.5 block text-[7px] font-normal leading-none text-slate-500">
                        {part.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {purchaseLimitLabel(product.purchaseLimitType) ? (
                <p className="mt-1 truncate text-[9px] font-medium text-slate-500 md:text-[11px]">
                  {purchaseLimitLabel(product.purchaseLimitType)}
                </p>
              ) : null}
              <Link
                to={`/order-summary/${encodeURIComponent(product.id)}`}
                className="mt-1 inline-flex h-7 w-full items-center justify-center rounded-[5px] bg-[#0759e6] px-2 text-[10px] font-medium text-white transition hover:bg-[#0448bd] sm:mt-3 sm:h-9 sm:text-sm"
              >
                Book Deal
              </Link>
            </div>
          ) : (
            <div className="mt-2 text-center sm:mt-3">
              <p className="text-xs font-normal text-[#0759e6] max-md:hidden">Deal status</p>
              <p className="text-[11px] font-semibold leading-snug text-red-600 sm:mt-1 sm:text-base">
                {product.dealStatus}
              </p>
            </div>
          )
        ) : null}
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
    <div className="mb-3 flex items-center justify-between gap-4 md:mb-5 md:items-start">
      <div>
        <h2 className="flex items-center gap-2 text-[22px] font-semibold text-slate-950 md:text-xl md:font-medium">
          {icon}
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm font-normal text-slate-500">{subtitle}</p> : null}
      </div>
      <Link
        to={to}
        className="inline-flex shrink-0 items-center gap-1 text-base font-semibold text-[#0759e6] hover:underline md:text-sm md:font-medium"
      >
        View All <ChevronRight size={17} className="max-md:hidden" />
      </Link>
    </div>
  );
}

export default function UserHomePage(): ReactElement {
  const [activeBanner, setActiveBanner] = useState(0);
  const [activeCategory, setActiveCategory] = useState('All');
  const [savedIds, setSavedIds] = useState<Set<string>>(() =>
    readStoredStringSet(SAVED_LISTING_IDS_KEY)
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const user = readStoredWebUser();
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();
  const notificationHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(userPhone ? { 'x-user-phone': userPhone } : {}),
    }),
    [userId, userPhone]
  );

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

  const storedGeoCoords = useMemo(() => readStoredWebGeoCoords(), []);
  const distanceCoords = storedGeoCoords;

  const listingsQuery = useQuery({
    queryKey: ['nearhub-home-feed'],
    queryFn: async (): Promise<ListingsQueryResult> => {
      const fetchListings = async (params: URLSearchParams) => {
        const response = await fetch(`${getApiUrl()}/api/listings?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to load listings');
        }

        const payload = (await response.json()) as ListingsResponse;
        return normalizeListings(payload.data || payload.results || []);
      };

      const baseParams = new URLSearchParams({ limit: '100' });
      return {
        listings: await fetchListings(baseParams),
        usedLocationFallback: false,
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const expiredDealsQuery = useQuery({
    queryKey: ['nearhub-home-expired-deals'],
    queryFn: async (): Promise<ListingsQueryResult> => {
      const fetchExpiredDeals = async (params: URLSearchParams) => {
        const response = await fetch(`${getApiUrl()}/api/listings?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to load expired deals');
        }

        const payload = (await response.json()) as ListingsResponse;
        return normalizeDealListings(payload.data || payload.results || []).filter(
          (item) =>
            Boolean(item.isDeal ?? item.is_deal) &&
            String(item.dealStatus || item.deal_status || item.status || '').toLowerCase() ===
              'expired'
        );
      };

      const baseParams = new URLSearchParams({
        limit: '100',
        dealsOnly: '1',
        includeExpiredDeals: '1',
      });
      return {
        listings: await fetchExpiredDeals(baseParams),
        usedLocationFallback: false,
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const broadDealListingsQuery = useQuery({
    queryKey: ['nearhub-home-broad-deals'],
    queryFn: async (): Promise<ListingsQueryResult> => {
      const response = await fetch(
        `${getApiUrl()}/api/listings?limit=100&dealsOnly=1&includeExpiredDeals=1`
      );
      if (!response.ok) {
        throw new Error('Failed to load broad deal listings');
      }

      const payload = (await response.json()) as ListingsResponse;
      return {
        listings: normalizeDealListings(payload.data || payload.results || []),
        usedLocationFallback: false,
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!listingsQuery.data?.usedLocationFallback) return;
    window.alert('No products are available at this location. Showing all listings.');
  }, [listingsQuery.data?.usedLocationFallback]);

  const notificationsQuery = useQuery({
    queryKey: ['header-push-notifications', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/notifications?userId=${encodeURIComponent(userId)}&limit=50`,
        { headers: notificationHeaders }
      );
      const payload = (await response.json()) as NotificationsResponse;
      if (!response.ok || payload.success === false) {
        throw new Error('Failed to load notifications');
      }
      return payload.data || [];
    },
    refetchInterval: 30_000,
  });

  const unreadNotificationCount = useMemo(
    () =>
      (notificationsQuery.data || []).filter(
        (item) => !item.isRead && item.category !== 'message' && item.category !== 'deal_purchase'
      ).length,
    [notificationsQuery.data]
  );

  const liveListings = listingsQuery.data?.listings ?? EMPTY_LISTINGS;
  const broadDealListings = broadDealListingsQuery.data?.listings ?? EMPTY_LISTINGS;
  const regularListings = useMemo(
    () => filterActiveListings(liveListings).filter((item) => !isDeal(item)),
    [liveListings]
  );
  const dealListings = useMemo(
    () => broadDealListings.filter((item) => isDealAvailableForDealSections(item, nowMs)),
    [broadDealListings, nowMs]
  );

  const upcomingDealListings = useMemo(
    () => dealListings.filter((item) => isDealUpcomingWithinWindow(item, nowMs)),
    [dealListings, nowMs]
  );

  const broadUpcomingDealListings = useMemo(
    () => broadDealListings.filter((item) => isDealUpcomingWithinWindow(item, nowMs)),
    [broadDealListings, nowMs]
  );

  const upcomingDeals = useMemo(
    () => upcomingDealListings.map((item) => mapListing(item, nowMs)),
    [upcomingDealListings, nowMs, distanceCoords]
  );

  const expiredDealListings = useMemo(() => {
    const expiredDeals = expiredDealsQuery.data?.listings ?? EMPTY_LISTINGS;
    return expiredDeals
      .filter((item) => {
        return isDeal(item) && isDealCompleted(item, nowMs);
      })
      .sort((a, b) => {
        const aEnd =
          getDealEndMs(a, nowMs) || new Date(String(a.dealEndAt || a.deal_end_at || 0)).getTime();
        const bEnd =
          getDealEndMs(b, nowMs) || new Date(String(b.dealEndAt || b.deal_end_at || 0)).getTime();
        return bEnd - aEnd;
      });
  }, [expiredDealsQuery.data, nowMs]);

  const featuredListings = useMemo(() => {
    return filterFeaturedListings(liveListings)
      .slice(0, 6)
      .map((item) => mapListing(item, nowMs));
  }, [liveListings, nowMs, distanceCoords]);

  const todaysDeals = useMemo(() => {
    return dealListings
      .filter((item) => isDealActive(item, nowMs))
      .sort((a, b) => Number(getDealEndMs(a, nowMs) || 0) - Number(getDealEndMs(b, nowMs) || 0))
      .slice(0, 6)
      .map((item) => mapListing(item, nowMs));
  }, [dealListings, nowMs, distanceCoords]);

  const expiredDeals = useMemo(() => {
    return expiredDealListings
      .sort((a, b) => Number(getDealEndMs(b, nowMs) || 0) - Number(getDealEndMs(a, nowMs) || 0))
      .slice(0, 6)
      .map((item) => mapListing(item, nowMs));
  }, [expiredDealListings, nowMs, distanceCoords]);

  const categoryProducts = useMemo(
    () => regularListings.map((item) => mapListing(item, nowMs)),
    [regularListings, nowMs, distanceCoords]
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
    writeStoredStringSet(SAVED_LISTING_IDS_KEY, next);
  };

  return (
    <div className="min-h-screen bg-white pb-[66px] text-slate-950 md:pb-0">
      <LandingHeader active="home" />
      <main>
        <section className="w-full px-4 pt-[82px] sm:hidden">
          <form action="/search" className="flex items-center gap-3">
            <label className="flex h-[58px] min-w-0 flex-1 items-center gap-3 rounded-full border border-slate-200 bg-white px-4 text-base font-semibold text-slate-500 shadow-sm">
              <Search size={22} className="shrink-0 text-slate-500" />
              <input
                name="q"
                type="search"
                placeholder="Search listings near you"
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-800 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-[#0759e6]"
                aria-label="Search"
              >
                <ChevronRight size={25} />
              </button>
            </label>
            <Link
              to="/notifications"
              className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full text-[#0759e6] transition hover:bg-blue-50"
              aria-label="Notifications"
            >
              <Bell size={29} />
              {unreadNotificationCount > 0 ? (
                <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              ) : null}
            </Link>
          </form>
        </section>
        <section className="w-full px-4 pt-5 sm:px-4 sm:pt-[5.25rem]">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-[#020b3b] shadow-sm sm:aspect-[3/1]">
            <img
              src={HERO_BANNERS[activeBanner]}
              alt="NearHub AI-powered local marketplace"
              className="absolute inset-0 h-full w-full object-contain object-center"
              loading="eager"
            />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 sm:bottom-4">
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

        <Container className="px-4 pb-8 pt-4 font-inter font-normal sm:pt-5">
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

          <section className="mt-0 sm:mt-5">
            <SectionHeader
              icon={<Grid2X2 className="text-[#0759e6]" size={24} />}
              title="Featured Listings"
              to="/search"
            />
            {featuredListings.length > 0 ? (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden">
                {featuredListings.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    mobileVariant="overlay"
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No featured listings are available yet." to="/create-listing" />
            )}
          </section>

          <section className="mt-5 md:mt-9">
            <SectionHeader
              icon={<Tag className="text-[#0759e6]" size={24} />}
              title="Active Deals"
              to="/deals"
            />
            {todaysDeals.length > 0 ? (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden">
                {todaysDeals.map((product) => (
                  <ProductCard
                    key={`deal-${product.id}`}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    showCountdown
                    mobileVariant="deal"
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No active deals are available right now." />
            )}
          </section>

          <section className="mt-5 md:mt-9">
            <SectionHeader
              icon={<Flame className="fill-orange-400 text-orange-500" size={24} />}
              title="Upcoming Deals"
              to="/deals"
            />
            {upcomingDeals.length > 0 || broadUpcomingDealListings.length > 0 ? (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden">
                {(upcomingDeals.length > 0
                  ? upcomingDeals
                  : broadUpcomingDealListings.map((item) => mapListing(item, nowMs))
                ).map((product) => (
                  <ProductCard
                    key={`upcoming-${product.id}`}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    showCountdown
                    mobileVariant="deal"
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No upcoming deals are available right now." />
            )}
          </section>

          <section className="mt-5 md:mt-9">
            <SectionHeader
              icon={<History className="text-[#0759e6]" size={24} />}
              title="Expired Deals"
              to="/deals"
            />
            {expiredDeals.length > 0 ? (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden">
                {expiredDeals.map((product) => (
                  <ProductCard
                    key={`expired-${product.id}`}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onToggleSaved={toggleSaved}
                    showCountdown
                    mobileVariant="deal"
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No expired deals yet." />
            )}
          </section>

          <section className="mt-5 md:mt-9">
            <SectionHeader
              icon={<Grid2X2 className="text-[#0759e6]" size={24} />}
              title="Categories"
              to="/search"
            />
            <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
              {categories.map((category) => (
                <button
                  key={category.label}
                  type="button"
                  onClick={() => setActiveCategory(category.label)}
                className={`h-10 shrink-0 rounded-[5px] border px-5 text-sm font-medium transition md:h-auto md:px-3 md:py-1.5 md:text-xs md:font-normal ${
                  activeCategory === category.label
                    ? 'border-[#0759e6] bg-blue-50 text-[#0759e6]'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-[#0759e6]'
                  }`}
                >
                  {category.label}
                  {category.count ? ` (${category.count})` : ''}
                </button>
              ))}
            </div>
            {visibleCategoryProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
