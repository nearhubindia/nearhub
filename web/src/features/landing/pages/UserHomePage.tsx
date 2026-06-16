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
import { formatDealStatus, getEffectiveDealWindow } from '@/lib/deal-timer';
import { FALLBACK_LISTING_IMAGE, getListingImages } from '@/features/landing/lib/listing-images';
import { readStoredWebUser } from '@/lib/web-auth-storage';
import { readStoredWebGeoCoords } from '@/lib/web-geo-storage';
import {
  SAVED_LISTING_IDS_KEY,
  countdownPartsFromMs,
  discountPercentage,
  formatPriceInr,
  formatDistanceKm,
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

function formatCountdown(endAt: number | undefined, nowMs: number): string {
  return countdownPartsFromMs(endAt, nowMs)
    .map((part) => part.value)
    .join(' : ');
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
          className="grid h-[38px] min-w-0 place-items-center rounded-lg bg-white text-center text-[#ef3045] shadow-sm ring-1 ring-[#ffd7dc]"
        >
          <span className="block text-[11px] font-black leading-none">{part.value}</span>
          <span className="mt-0.5 block text-[6px] font-bold uppercase leading-none text-slate-500">
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
    (isDealExpired(item, nowMs) || isDealStockCompleted(item) || isDealMarkedCompleted(item))
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
    return { displayPrice: price, originalPrice: undefined };

  const afterDealPrice =
    postDealDiscountPrice && postDealDiscountPrice < price ? postDealDiscountPrice : offerPrice;
  return { displayPrice: afterDealPrice, originalPrice: price };
}

function mapListing(item: Listing, nowMs: number): ProductCardData {
  const { displayPrice, originalPrice } = getDisplayPrices(item, nowMs);
  const images = getListingImages(item);

  return {
    id: item.id,
    title: item.title || 'Untitled listing',
    category: item.category || 'General',
    location: item.location || 'Nearby',
    image: images[0] || FALLBACK_IMAGE,
    images,
    price: displayPrice,
    originalPrice,
    distance: formatDistanceKm(item.distanceKm ?? item.distance_km),
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
  mobileVariant = 'default',
  nowMs,
}: {
  product: ProductCardData;
  saved: boolean;
  onToggleSaved: (id: string) => void;
  showCountdown?: boolean;
  combo?: boolean;
  mobileVariant?: 'default' | 'overlay' | 'deal';
  nowMs: number;
}): ReactElement {
  const sale = discountPercentage(product.price, product.originalPrice);
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
  const dealTag = sale || product.badge || (showCountdown ? 'Deal' : null);
  const mobileCardWidth =
    mobileVariant === 'overlay'
      ? 'max-md:h-[150px] max-md:w-[124px] max-md:shrink-0 md:w-auto md:shrink'
      : mobileVariant === 'deal'
        ? 'max-md:h-[300px] max-md:w-[124px] max-md:shrink-0 md:w-auto md:shrink'
        : '';
  const mobileShell =
    mobileVariant === 'overlay'
      ? 'max-md:relative max-md:rounded-2xl max-md:border-slate-300 max-md:bg-slate-950'
      : mobileVariant === 'deal'
        ? 'max-md:rounded-2xl max-md:border-slate-300'
        : '';
  const imageShape =
    mobileVariant === 'overlay'
      ? 'max-md:h-full max-md:overflow-hidden max-md:rounded-2xl'
      : mobileVariant === 'deal'
        ? 'max-md:h-[106px]'
        : '';

  return (
    <article
      className={`group overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${mobileCardWidth} ${mobileShell} ${
        combo ? 'h-full' : ''
      }`}
    >
      <Link to={`/listing/${encodeURIComponent(product.id)}`} className="block">
        <div
          className={`relative bg-slate-100 ${imageShape} ${
            combo ? 'aspect-[1.72]' : 'aspect-[1.02] sm:aspect-[1.14]'
          }`}
        >
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
          {sale && !showCountdown ? (
            <span
              className={`absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-xs ${
                mobileVariant !== 'default' ? 'max-md:hidden' : ''
              }`}
            >
              {sale}
            </span>
          ) : null}
          {product.badge && !showCountdown ? (
            <span
              className={`absolute top-1.5 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm sm:top-2 sm:px-2 sm:py-1 sm:text-xs ${sale ? 'right-1.5 sm:right-2' : 'left-1.5 sm:left-2'}`}
            >
              {product.badge}
            </span>
          ) : null}
          {showCountdown && dealTag ? (
            <span className="absolute left-0 top-0 z-10 rounded-br-sm bg-red-600 px-2 py-1 text-[10px] font-black leading-none text-white shadow-[6px_0_0_#d8c4b6] md:left-2 md:top-2 md:rounded-full md:px-2 md:py-0.5 md:text-[10px] md:shadow-sm">
              {dealTag}
            </span>
          ) : null}
          {combo ? (
            <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-red-600 text-xl font-medium text-white shadow-lg">
              +
            </span>
          ) : null}
        </div>
      </Link>
      <div
        className={`p-2 sm:p-3 ${
          mobileVariant === 'overlay'
            ? 'max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:bg-gradient-to-t max-md:from-black/90 max-md:via-black/65 max-md:to-transparent max-md:p-3 max-md:pt-12'
            : ''
        } ${mobileVariant === 'deal' ? 'max-md:p-2' : ''}`}
      >
        <div className="flex min-h-6 items-start justify-between gap-1 sm:min-h-10 sm:gap-2">
          <Link
            to={`/listing/${encodeURIComponent(product.id)}`}
            className={`line-clamp-2 text-xs font-normal leading-snug text-slate-950 hover:text-[#0858d8] sm:text-sm ${
              mobileVariant === 'overlay' ? 'max-md:text-white max-md:hover:text-white' : ''
            } ${mobileVariant === 'deal' ? 'max-md:text-[11px] max-md:font-bold' : ''}`}
          >
            {comboTitle}
          </Link>
          <button
            type="button"
            onClick={() => onToggleSaved(product.id)}
            className={`shrink-0 rounded-full p-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-red-600 sm:p-1 ${
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
        {combo ? (
          <p className="mt-1 line-clamp-1 text-xs font-normal text-slate-500">{product.title}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-baseline gap-1 sm:mt-2 sm:gap-2">
          <span
            className={`text-sm font-medium text-[#0759e6] sm:text-base ${
              mobileVariant === 'overlay' ? 'max-md:text-white' : ''
            } ${mobileVariant === 'deal' ? 'max-md:text-[12px] max-md:font-black max-md:text-slate-950' : ''}`}
          >
            {formatPriceInr(product.price)}
          </span>
          {product.originalPrice ? (
            <span
              className={`text-[10px] font-normal text-slate-400 line-through sm:text-xs ${
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
          } ${mobileVariant === 'deal' ? 'max-md:mt-0 max-md:text-[10px]' : ''}`}
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
                      className="grid h-[36px] min-w-[36px] w-[36px] place-items-center rounded-lg bg-white text-center text-[#dc1633] shadow-sm ring-1 ring-[#f8d9dd]"
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
                className="mt-1 inline-flex h-7 w-full items-center justify-center rounded-lg bg-[#0759e6] px-2 text-[11px] font-medium text-white transition hover:bg-[#0448bd] sm:mt-3 sm:h-9 sm:text-sm"
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
  const sale = discountPercentage(product.price, product.originalPrice);
  const comboImages = [
    product.images[0] || product.image || FALLBACK_IMAGE,
    product.images[1] || product.images[0] || product.image || FALLBACK_IMAGE,
  ];
  const comboTitle =
    product.comboItems && product.comboItems.length >= 2
      ? `${product.comboItems[0]} + ${product.comboItems[1]}`
      : product.title;

  return (
    <article className="h-[300px] w-[124px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:h-auto md:w-auto md:shrink">
      <Link to={`/listing/${encodeURIComponent(product.id)}`} className="block">
        <div className="relative h-[100px] overflow-hidden bg-white sm:h-40 xl:h-36">
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
          {product.badge || sale ? (
            <span className="absolute left-0 top-0 z-10 rounded-br-sm bg-red-600 px-2 py-1 text-[10px] font-black leading-none text-white shadow-[6px_0_0_#d8c4b6] md:left-2 md:top-2 md:rounded-full md:px-2 md:py-0.5 md:text-[10px] md:shadow-sm">
              {sale || product.badge}
            </span>
          ) : null}
          <span className="absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-lg font-black leading-none text-[#0759e6] shadow-sm">
            +
          </span>
          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-slate-950 shadow-sm">
            <Heart size={18} />
          </span>
        </div>
      </Link>

      <div className="px-2 pb-2 pt-2">
        <div className="flex min-h-6 items-start justify-between gap-1">
          <Link
            to={`/listing/${encodeURIComponent(product.id)}`}
            className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-950 hover:text-[#0759e6]"
          >
            {comboTitle}
          </Link>
        </div>
        <p className="mt-0.5 line-clamp-2 min-h-6 text-[10px] font-normal leading-3 text-slate-500">
          {product.title}
        </p>

        <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
          <span className="text-[12px] font-black leading-none text-slate-950 sm:text-xl">
            {formatPriceInr(product.price)}
          </span>
          {product.originalPrice ? (
            <span className="text-[10px] font-normal text-slate-400 line-through">
              {formatPriceInr(product.originalPrice)}
            </span>
          ) : null}
        </div>

        <div className="mt-1.5 text-center">
          {product.dealStatus?.startsWith('Ends in') ? (
            <MobileCountdownTiles
              endAt={product.dealEndsAt}
              nowMs={nowMs}
              className="border-t border-slate-100 pt-1 md:hidden"
            />
          ) : (
            <p className="mt-1 font-mono text-sm font-medium tracking-wide text-red-600">
              {product.dealStatus || formatCountdown(product.dealEndsAt, nowMs)}
            </p>
          )}
          {product.dealStatus?.startsWith('Ends in') ? (
            <div className="max-md:hidden">
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                {countdownPartsFromMs(product.dealEndsAt, nowMs).map((part) => (
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
            </div>
          ) : null}
          {purchaseLimitLabel(product.purchaseLimitType) ? (
            <p className="mt-1 truncate text-[9px] font-medium text-slate-500 md:text-[11px]">
              {purchaseLimitLabel(product.purchaseLimitType)}
            </p>
          ) : null}
          {product.dealStatus?.startsWith('Ends in') ? (
            <Link
              to={`/order-summary/${encodeURIComponent(product.id)}`}
              className="mt-1 inline-flex h-7 w-full items-center justify-center rounded-lg bg-[#0759e6] px-2 text-[11px] font-medium text-white transition hover:bg-[#0448bd] md:mt-3 md:h-9"
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

  const listingsQuery = useQuery({
    queryKey: ['nearhub-home-feed', storedGeoCoords?.latitude, storedGeoCoords?.longitude],
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

      if (storedGeoCoords) {
        const nearbyParams = new URLSearchParams(baseParams);
        nearbyParams.set('latitude', String(storedGeoCoords.latitude));
        nearbyParams.set('longitude', String(storedGeoCoords.longitude));
        nearbyParams.set('radius', '50');

        const nearbyListings = await fetchListings(nearbyParams);
        if (nearbyListings.length > 0) {
          return { listings: nearbyListings, usedLocationFallback: false };
        }
      }

      return {
        listings: await fetchListings(baseParams),
        usedLocationFallback: Boolean(storedGeoCoords),
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const expiredDealsQuery = useQuery({
    queryKey: ['nearhub-home-expired-deals', storedGeoCoords?.latitude, storedGeoCoords?.longitude],
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
            String(item.status || '').toLowerCase() === 'expired'
        );
      };

      const baseParams = new URLSearchParams({
        limit: '100',
        dealsOnly: '1',
        includeExpiredDeals: '1',
      });

      if (storedGeoCoords) {
        const nearbyParams = new URLSearchParams(baseParams);
        nearbyParams.set('latitude', String(storedGeoCoords.latitude));
        nearbyParams.set('longitude', String(storedGeoCoords.longitude));
        nearbyParams.set('radius', '50');

        const nearbyExpiredDeals = await fetchExpiredDeals(nearbyParams);
        if (nearbyExpiredDeals.length > 0) {
          return { listings: nearbyExpiredDeals, usedLocationFallback: false };
        }
      }

      return {
        listings: await fetchExpiredDeals(baseParams),
        usedLocationFallback: Boolean(storedGeoCoords),
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
  const regularListings = useMemo(
    () => liveListings.filter((item) => !isDeal(item) || isDealCompleted(item, nowMs)),
    [liveListings, nowMs]
  );
  const dealListings = useMemo(
    () => liveListings.filter((item) => isDealAvailableForDealSections(item, nowMs)),
    [liveListings, nowMs]
  );

  const upcomingDealListings = useMemo(
    () => dealListings.filter((item) => isDealUpcoming(item, nowMs)),
    [dealListings, nowMs]
  );

  const upcomingDeals = useMemo(
    () => upcomingDealListings.map((item) => mapListing(item, nowMs)),
    [upcomingDealListings, nowMs]
  );

  const expiredDealListings = useMemo(
    () => {
      const expiredDeals = expiredDealsQuery.data?.listings ?? EMPTY_LISTINGS;
      return expiredDeals
        .filter((item) => isDeal(item))
        .sort((a, b) => {
          const aEnd = getDealEndMs(a, nowMs) || new Date(String(a.dealEndAt || a.deal_end_at || 0)).getTime();
          const bEnd = getDealEndMs(b, nowMs) || new Date(String(b.dealEndAt || b.deal_end_at || 0)).getTime();
          return bEnd - aEnd;
        });
    },
    [expiredDealsQuery.data, nowMs]
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
              icon={<MapPin className="text-[#0759e6]" size={24} />}
              title="Distance from You"
              to="/search"
            />
            {trending.length > 0 ? (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden">
                {trending.map((product) => (
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
              <EmptyState message="No listings are available yet." to="/create-listing" />
            )}
          </section>

          <section className="mt-5 md:mt-9">
            <SectionHeader
              icon={<Tag className="text-[#0759e6]" size={24} />}
              title="Deals"
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
              icon={<Tag className="text-[#0759e6]" size={24} />}
              title="Combo Deals"
              to="/deals"
            />
            {comboDeals.length > 0 ? (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
                {comboDeals.map((product) => (
                  <ComboDealCard key={`combo-${product.id}`} product={product} nowMs={nowMs} />
                ))}
              </div>
            ) : (
              <EmptyState message="No combo deals are available right now." />
            )}
          </section>

          <section className="mt-5 md:mt-9">
            <SectionHeader
              icon={<Flame className="fill-orange-400 text-orange-500" size={24} />}
              title="Upcoming Deals"
              to="/deals"
            />
            {upcomingDeals.length > 0 ? (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden">
                {upcomingDeals.map((product) => (
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
                  className={`h-10 shrink-0 rounded-full border px-5 text-sm font-medium transition md:h-auto md:px-3 md:py-1.5 md:text-xs md:font-normal ${
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
