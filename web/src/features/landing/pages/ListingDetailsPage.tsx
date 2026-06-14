import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Send,
  Share2,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { trackWebGenerateLead, trackWebViewItem } from '@/lib/firebase';
import { readStoredWebUser } from '@/lib/web-auth-storage';
import { readStoredWebGeoCoords } from '@/lib/web-geo-storage';
import { formatDealStatus } from '@/lib/deal-timer';
import { getListingImages } from '@/features/landing/lib/listing-images';
import {
  parseAttributeMap,
  parseEmiPlanList,
  parseMediaList,
  parseTextList,
} from '@/features/landing/lib/listing-parsers';
import {
  SAVED_LISTING_IDS_KEY,
  countdownPartsFromMs,
  formatPriceInr,
  parsePositiveNumber,
  readStoredStringSet,
  writeStoredStringSet,
} from '@/features/landing/lib/landing-utils';

type StoredUser = { id?: string; phone?: string; name?: string };
type LocationLookupResult = {
  locationName?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type EmiPlan = {
  durationMonths?: string | number;
  monthlyAmount?: string | number;
};

const SAVED_LISTINGS_KEY = 'nearhub_web_saved_listing_snapshots';

function isCoordinateLabel(value: string): boolean {
  return /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(value.trim());
}

function isPincodeLabel(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

function isPlaceholderLocation(value: string): boolean {
  return /^(nearby|nearby location|location unavailable)$/i.test(value.trim());
}

function parseCoordinateLabel(value: string): { latitude: number; longitude: number } | null {
  if (!isCoordinateLabel(value)) return null;
  const [latitudeRaw, longitudeRaw] = value.split(',').map((item) => item.trim());
  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function formatLocationName(data?: LocationLookupResult | null): string {
  if (!data) return '';
  const locationName = String(data.locationName || '').trim();
  if (locationName && !isCoordinateLabel(locationName)) return locationName;
  return [data.city, data.state]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(', ');
}

type Listing = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  condition?: string;
  location?: string;
  address?: string;
  pincode?: string | number;
  pinCode?: string | number;
  postalCode?: string | number;
  latitude?: string | number;
  lat?: string | number;
  longitude?: string | number;
  lng?: string | number;
  price?: string | number;
  offerPrice?: string | number;
  priceUnit?: string;
  images?: string[];
  videos?: string[];
  sellerName?: string;
  sellerVerified?: boolean;
  sellerAvatar?: string;
  createdAt?: string;
  chatCount?: number;
  likeCount?: number;
  status?: string;
  isActive?: boolean;
  is_active?: boolean;
  isDeal?: boolean;
  dealStartAt?: string;
  dealEndAt?: string;
  dealType?: string;
  purchaseLimitType?: string;
  maxDealBookings?: number;
  dealBookingsUsed?: number;
  emiAvailable?: boolean;
  emi_available?: boolean;
  emiPlans?: EmiPlan[] | string;
  emi_plans?: EmiPlan[] | string;
  warrantyText?: string;
  warranty_text?: string;
  dealExtraFeatures?: string[] | string;
  deal_extra_features?: string[] | string;
  attributes?: Record<string, string | number | boolean> | string | null;
  is_deal?: boolean;
  deal_start_at?: string;
  deal_end_at?: string;
  deal_type?: string;
  purchase_limit_type?: string;
  max_deal_bookings?: number;
  deal_bookings_used?: number;
};

function formatDealWindow(value: number): string {
  if (!Number.isFinite(value)) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ListingSearchStrip(): ReactElement {
  return <div className="border-b border-slate-100 bg-white"></div>;
}

function ListingGallery({
  listing,
  isSaved,
  onToggleSaved,
  onShareDeal,
  shareStatus,
}: {
  listing: Listing;
  isSaved: boolean;
  onToggleSaved: () => void;
  onShareDeal: () => Promise<void>;
  shareStatus: string;
}): ReactElement {
  const [mainImageFailed, setMainImageFailed] = useState(false);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const images = listing.images || [];
  const heroImage = images[mainImageIndex] || images[0] || '';

  const selectImage = (index: number) => {
    setMainImageIndex(index);
    setMainImageFailed(false);
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.scrollTo({
        left: carousel.clientWidth * index,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#d7e4f2] bg-white p-4 shadow-[0_26px_70px_-52px_rgba(17,57,101,0.85)] sm:rounded-[28px] sm:p-5">
      <div className="relative overflow-hidden rounded-[20px] bg-white sm:rounded-[22px] sm:bg-slate-50">
        <div className="absolute left-4 top-4 z-10 rounded-full bg-[#1f63b2] px-3 py-1.5 text-[11px] uppercase text-white shadow-sm">
          Deal
        </div>
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={onToggleSaved}
            className={`grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm transition ${
              isSaved ? 'text-rose-500' : 'text-slate-700 hover:text-rose-500'
            }`}
            aria-label={isSaved ? 'Remove from favourites' : 'Save'}
            aria-pressed={isSaved}
          >
            <Heart size={18} className={isSaved ? 'fill-rose-500' : ''} />
          </button>
          <button
            type="button"
            onClick={() => void onShareDeal()}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-700 shadow-sm transition hover:text-[#1f63b2]"
            aria-label="Share"
          >
            <Share2 size={18} />
          </button>
        </div>

        <div
          ref={carouselRef}
          className="flex h-[340px] snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] min-[390px]:h-[360px] sm:hidden [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            const target = event.currentTarget;
            const nextIndex = Math.round(target.scrollLeft / Math.max(target.clientWidth, 1));
            if (nextIndex !== mainImageIndex && nextIndex >= 0 && nextIndex < images.length) {
              setMainImageIndex(nextIndex);
              setMainImageFailed(false);
            }
          }}
        >
          {images.length > 0 ? (
            images.map((image, index) => (
              <div
                key={`${image}-slide-${index}`}
                className="flex h-full w-full shrink-0 snap-center items-center justify-center bg-white"
              >
                <img
                  src={image}
                  alt={`${listing.title} ${index + 1}`}
                  className="h-full w-full object-contain object-center"
                  onError={(event) => {
                    event.currentTarget.src = '/nearhub.png';
                  }}
                />
              </div>
            ))
          ) : (
            <div className="flex h-full w-full shrink-0 items-center justify-center text-sm text-slate-500">
              No media available
            </div>
          )}
        </div>

        <div className="hidden aspect-[4/3] min-h-[320px] items-center justify-center sm:flex sm:min-h-[440px]">
          {heroImage && !mainImageFailed ? (
            <img
              src={heroImage}
              alt={listing.title}
              className="h-full w-full object-contain object-center"
              onError={() => setMainImageFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
              No media available
            </div>
          )}
        </div>
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5 sm:hidden">
          {images.map((image, index) => (
            <button
              key={`${image}-dot-${index}`}
              type="button"
              onClick={() => selectImage(index)}
              className={`h-2 rounded-full transition ${
                mainImageIndex === index ? 'w-5 bg-[#0759e6]' : 'w-2 bg-slate-300'
              }`}
              aria-label={`Show image ${index + 1}`}
            />
          ))}
        </div>
      ) : null}

      {images.length > 1 ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => selectImage(index)}
              className={`h-[70px] w-[70px] shrink-0 overflow-hidden rounded-xl border bg-white transition sm:h-auto sm:w-auto sm:aspect-square sm:rounded-[14px] ${
                mainImageIndex === index
                  ? 'border-[#0759e6] ring-2 ring-[#0759e6]/15'
                  : 'border-slate-200 hover:border-[#9bb9dd]'
              }`}
            >
              <img
                src={image}
                alt={`${listing.title} ${index + 1}`}
                className="h-full w-full object-contain object-center"
              />
            </button>
          ))}
        </div>
      ) : null}

      {shareStatus ? (
        <p className="mt-3 text-center text-xs text-slate-600">{shareStatus}</p>
      ) : null}
    </section>
  );
}

export default function ListingDetailsPage(): ReactElement {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bookingMessage, setBookingMessage] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [savedIds, setSavedIds] = useState<Set<string>>(() =>
    readStoredStringSet(SAVED_LISTING_IDS_KEY)
  );
  const [messageDraft, setMessageDraft] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageStatus, setMessageStatus] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const user = readStoredWebUser() as StoredUser | null;
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();
  const userName = String(user?.name || '').trim();

  const listingQuery = useQuery({
    queryKey: ['listing-details', id, userId],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/listings/${encodeURIComponent(id)}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
          ...(userPhone ? { 'x-user-phone': userPhone } : {}),
        },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Failed to load listing');
      const raw = payload.listing || payload.data;
      const images = getListingImages(raw);
      return {
        ...raw,
        images,
        videos: parseMediaList(raw?.videos),
        attributes: parseAttributeMap(raw?.attributes),
        status: String(raw?.status || ''),
        isActive: Boolean(raw?.isActive ?? raw?.is_active),
        isDeal: Boolean(raw?.isDeal ?? raw?.is_deal),
        dealStartAt: String(raw?.dealStartAt || raw?.deal_start_at || ''),
        dealEndAt: String(raw?.dealEndAt || raw?.deal_end_at || ''),
        dealType: String(raw?.dealType || raw?.deal_type || ''),
        maxDealBookings: Number(raw?.maxDealBookings ?? raw?.max_deal_bookings ?? 0) || 0,
        dealBookingsUsed: Number(raw?.dealBookingsUsed ?? raw?.deal_bookings_used ?? 0) || 0,
      } as Listing;
    },
  });

  const contactQuery = useQuery({
    queryKey: ['listing-contact', id, userId],
    enabled: Boolean(id && userId),
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/listings/${encodeURIComponent(id)}/contact`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
            'x-user-phone': userPhone,
          },
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) return '';
      return String(payload.contactPhone || payload.sellerPhone || '').trim();
    },
  });

  const listing = listingQuery.data;
  useEffect(() => {
    if (!listing?.id) return;
    void trackWebViewItem({
      id: listing.id,
      title: listing.title,
      category: listing.category,
      price: parsePositiveNumber(listing.offerPrice) || parsePositiveNumber(listing.price) || 0,
      listingType: listing.isDeal ?? listing.is_deal ? 'deal' : 'listing',
      location: String(listing.location || listing.address || ''),
    });
  }, [listing]);

  const isDeal = Boolean(listing?.isDeal ?? listing?.is_deal);
  const isPublishedListing =
    Boolean(listing?.isActive ?? listing?.is_active) &&
    String(listing?.status || '').toLowerCase() === 'active';
  const dealStart = new Date(
    String(listing?.dealStartAt || listing?.deal_start_at || '')
  ).getTime();
  const dealEnd = new Date(String(listing?.dealEndAt || listing?.deal_end_at || '')).getTime();
  const isDealWindowValid =
    Number.isFinite(dealStart) && Number.isFinite(dealEnd) && dealEnd > dealStart;
  const dealStatus = listing ? formatDealStatus(listing, nowMs) : '';
  const isDealActive =
    isDeal && isPublishedListing && isDealWindowValid && nowMs >= dealStart && nowMs <= dealEnd;
  const dealSlots = Number(listing?.maxDealBookings ?? listing?.max_deal_bookings ?? 0) || 0;
  const dealUsed = Number(listing?.dealBookingsUsed ?? listing?.deal_bookings_used ?? 0) || 0;
  const isDealSoldOut = dealSlots > 0 && dealUsed >= dealSlots;
  const isBookDealDisabled = Boolean(userId && (!isDealActive || isDealSoldOut));
  const showDealTimer = dealStatus.startsWith('Ends in');
  const timerParts = showDealTimer ? countdownPartsFromMs(dealEnd, nowMs) : [];
  const purchaseLimitType = String(
    listing?.purchaseLimitType || listing?.purchase_limit_type || ''
  ).toUpperCase();
  const purchaseLimitLabel =
    purchaseLimitType === 'ONE_TIME'
      ? 'One Purchase Per Customer'
      : purchaseLimitType === 'UNLIMITED'
        ? 'Unlimited Purchases'
        : '';

  const dealOfferPrice = parsePositiveNumber(listing?.offerPrice) ?? 0;
  const originalPrice = parsePositiveNumber(listing?.price) ?? 0;
  const hasDealPrice = dealOfferPrice > 0 && originalPrice > dealOfferPrice;
  const rawAddressLabel = String(listing?.address || listing?.location || '').trim();
  const addressLabel =
    isCoordinateLabel(rawAddressLabel) ||
    isPincodeLabel(rawAddressLabel) ||
    isPlaceholderLocation(rawAddressLabel)
      ? ''
      : rawAddressLabel;
  const pincodeLabel = String(
    listing?.pincode ||
      listing?.pinCode ||
      listing?.postalCode ||
      (isPincodeLabel(rawAddressLabel) ? rawAddressLabel : '')
  ).trim();
  const rawLocationCoordinates = parseCoordinateLabel(rawAddressLabel);
  const latitude = Number(listing?.latitude ?? listing?.lat ?? rawLocationCoordinates?.latitude);
  const longitude = Number(listing?.longitude ?? listing?.lng ?? rawLocationCoordinates?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const resolvedLocationQuery = useQuery({
    queryKey: ['listing-resolved-location', listing?.id, pincodeLabel, latitude, longitude],
    enabled: Boolean(isDeal && listing?.id && !addressLabel && (pincodeLabel || hasCoordinates)),
    queryFn: async () => {
      if (pincodeLabel) {
        const response = await fetch(
          `${getApiUrl()}/api/location/pincode/${encodeURIComponent(pincodeLabel)}`
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          data?: LocationLookupResult;
        };
        if (response.ok && payload.success && payload.data) return payload.data;
      }

      if (hasCoordinates) {
        const response = await fetch(
          `${getApiUrl()}/api/location/reverse-geocode?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}`
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          data?: LocationLookupResult;
        };
        if (response.ok && payload.success && payload.data) return payload.data;
      }

      return null;
    },
  });
  const resolvedAddressLabel = formatLocationName(resolvedLocationQuery.data);
  const detailsAddressLabel = addressLabel || resolvedAddressLabel;
  const detailsPincodeLabel =
    pincodeLabel || String(resolvedLocationQuery.data?.pincode || '').trim();
  const displayLocationLabel =
    detailsAddressLabel || (detailsPincodeLabel ? `Pincode ${detailsPincodeLabel}` : 'Nearby');
  const dealDisplayPrice = formatPriceInr(
    hasDealPrice ? dealOfferPrice : originalPrice || listing?.price
  );
  const dealOriginalPrice = hasDealPrice ? formatPriceInr(originalPrice) : '';
  const discountPercent =
    hasDealPrice && originalPrice > 0
      ? Math.round(((originalPrice - dealOfferPrice) / originalPrice) * 100)
      : 0;
  const isSaved = Boolean(listing?.id && savedIds.has(listing.id));
  const emiAvailable = Boolean(listing?.emiAvailable ?? listing?.emi_available);
  const emiPlans = parseEmiPlanList(listing?.emiPlans ?? listing?.emi_plans);
  const warrantyText = String(listing?.warrantyText || listing?.warranty_text || '').trim();
  const buyerFeatures = parseTextList(listing?.dealExtraFeatures ?? listing?.deal_extra_features);
  const listingAttributes = Object.entries(parseAttributeMap(listing?.attributes));
  const showBuyerOptions = emiAvailable || Boolean(warrantyText) || buyerFeatures.length > 0;

  const renderBuyerOptions = () =>
    showBuyerOptions ? (
      <div className="mt-5 rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm text-slate-950">
          <CreditCard size={16} className="text-[#2168b3]" /> Buyer Options
        </h2>
        {emiAvailable ? (
          <div className="mt-4 rounded-[14px] bg-[#eef6ff] p-4">
            <p className="text-xs uppercase text-[#2168b3]">EMI available</p>
            {emiPlans.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {emiPlans.map((plan) => (
                  <div
                    key={`${plan.durationMonths}-${plan.monthlyAmount}`}
                    className="rounded-[12px] bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <span className="block text-xs text-slate-500">
                      {plan.durationMonths} months
                    </span>
                    <span className="mt-1 block text-base text-slate-950">
                      {formatPriceInr(plan.monthlyAmount)}/month
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Ask seller for EMI details.</p>
            )}
          </div>
        ) : null}
        {warrantyText ? (
          <div className="mt-3 rounded-[14px] bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase text-slate-500">Warranty / Guarantee</p>
            <p className="mt-1 text-sm text-slate-800">{warrantyText}</p>
          </div>
        ) : null}
        {buyerFeatures.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {buyerFeatures.map((feature, index) => (
              <span
                key={`${feature}-${index}`}
                className="rounded-full bg-[#eaf4ff] px-3 py-1.5 text-xs text-[#2168b3]"
              >
                {feature}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    ) : null;

  useEffect(() => {
    if (!isDeal) return undefined;

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isDeal]);

  const handleBookDeal = () => {
    if (!id) return;
    if (!userId) {
      navigate('/auth/register');
      return;
    }
    if (!readStoredWebGeoCoords()) {
      setBookingMessage('Please set your location before booking this deal.');
      return;
    }
    if (!isPublishedListing) {
      setBookingMessage('This deal listing is not published yet.');
      return;
    }
    void trackWebGenerateLead({
      listingId: id,
      listingTitle: listing?.title,
      method: 'deal_booking',
      category: listing?.category,
    });
    navigate(`/order-summary/${encodeURIComponent(id)}`);
  };

  const sendListingMessage = async (text: string) => {
    if (!id) return;
    if (!userId) {
      navigate('/auth/register');
      return;
    }

    setMessageStatus('');
    const response = await fetch(`${getApiUrl()}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-user-phone': userPhone,
        ...(userName ? { 'x-user-name': userName } : {}),
      },
      body: JSON.stringify({ listingId: id, text }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setMessageStatus(String(payload.error || 'Failed to start chat'));
      return;
    }

    const conversationId = String(payload.data?.conversationId || '').trim();
    void trackWebGenerateLead({
      listingId: id,
      listingTitle: listing?.title,
      method: 'chat',
      category: listing?.category,
    });
    await queryClient.invalidateQueries({
      queryKey: ['message-threads', userId],
    });
    setMessageDraft('');
    if (conversationId) {
      navigate(`/messages/${conversationId}`);
    } else {
      navigate('/messages');
    }
  };

  const handleMessageSeller = async () => {
    const text =
      messageDraft.trim() ||
      `Hi, I am interested in your listing: ${listing?.title || 'this item'}. Is it available?`;

    setIsSendingMessage(true);
    try {
      await sendListingMessage(text);
    } catch {
      setMessageStatus('Failed to start chat. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const openDirections = () => {
    const query = hasCoordinates
      ? `${latitude},${longitude}`
      : [detailsAddressLabel, detailsPincodeLabel, listing?.title].filter(Boolean).join(' ');
    if (!query) return;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareDeal = async () => {
    if (!listing) return;
    const shareUrl = window.location.href;
    const shareTitle = listing.title || 'NearHub deal';
    const shareText = `Check this NearHub deal: ${shareTitle}`;
    setShareStatus('');

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('Link copied');
    } catch {
      setShareStatus('Share unavailable');
    }
  };

  const toggleSaved = () => {
    if (!listing?.id) return;
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

    if (next.has(listing.id)) {
      next.delete(listing.id);
      delete snapshots[listing.id];
    } else {
      next.add(listing.id);
      snapshots[listing.id] = listing;
    }

    setSavedIds(next);
    writeStoredStringSet(SAVED_LISTING_IDS_KEY, next);
    localStorage.setItem(SAVED_LISTINGS_KEY, JSON.stringify(snapshots));
  };

  const displayPrice = (() => {
    if (!listing) return 'Price on request';
    const offer = parsePositiveNumber(listing.offerPrice);
    const base = parsePositiveNumber(listing.price);
    if (offer && base && base > offer) return formatPriceInr(offer);
    return formatPriceInr(listing.price);
  })();

  if (!id) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[#f3f7fb] text-slate-950">
      <LandingHeader active={isDeal ? 'deals' : 'browse'} />
      <div className="pt-16">
        <ListingSearchStrip />
      </div>
      <section className="border-b border-[#dbe7f5] bg-[#e8f2ff]">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 pb-8 pt-8 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center gap-2 text-xs text-[#55708f] sm:text-sm">
            <Link to="/" className="transition hover:text-[#1f63b2] hover:underline">
              Home
            </Link>
            <span>/</span>
            <Link
              to={`/search?category=${encodeURIComponent(listing?.category || 'All')}`}
              className="transition hover:text-[#1f63b2] hover:underline"
            >
              {listing?.category || 'Listings'}
            </Link>
            {listing?.title ? (
              <>
                <span>/</span>
                <span className="max-w-[520px] truncate text-slate-900">{listing.title}</span>
              </>
            ) : null}
          </nav>

          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.22em] text-[#1f63b2]">
              {isDeal ? 'Deal Details' : 'Listing Details'}
            </p>
            <h1 className="mt-2 text-3xl leading-tight tracking-normal text-slate-950 sm:text-4xl lg:text-4xl">
              {listing?.title || 'Listing details'}
            </h1>
            {listing ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#425674]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="text-[#1f63b2]" size={16} /> {displayLocationLabel}
                </span>
                {listing.status ? <span>Status: {listing.status}</span> : null}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1360px] px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        {listingQuery.isLoading ? (
          <div className="rounded-[22px] border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading listing...
          </div>
        ) : null}
        {listingQuery.isError ? (
          <div className="rounded-[22px] border border-rose-200 bg-white p-8 text-sm text-rose-600 shadow-sm">
            Failed to load listing details.
          </div>
        ) : null}

        {listing ? (
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(420px,0.9fr)]">
            <section className="min-w-0 space-y-4 lg:sticky lg:top-24">
              <ListingGallery
                key={listing?.id || id}
                listing={listing}
                isSaved={isSaved}
                onToggleSaved={toggleSaved}
                onShareDeal={handleShareDeal}
                shareStatus={shareStatus}
              />
            </section>
            <section className="min-w-0 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f2ff] px-3 py-1.5 text-[11px] uppercase text-[#1f63b2]">
                    <Tag size={13} /> {listing.category || 'General'}
                  </span>
                  {listing.condition ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] uppercase text-slate-600">
                      <BadgeCheck size={13} /> {listing.condition}
                    </span>
                  ) : null}
                  {isDeal ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff3d9] px-3 py-1.5 text-[11px] uppercase text-[#9a5b00]">
                      Deal
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-4 text-2xl leading-tight tracking-normal text-slate-950 sm:text-3xl">
                  {listing.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="text-[#1f63b2]" size={16} /> {displayLocationLabel}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <p className="text-3xl leading-none text-[#1f63b2] sm:text-4xl">
                    {isDeal ? dealDisplayPrice : displayPrice}
                  </p>
                  {dealOriginalPrice ? (
                    <p className="text-base text-slate-400 line-through">{dealOriginalPrice}</p>
                  ) : null}
                  {discountPercent > 0 ? (
                    <span className="rounded-full bg-[#e8f2ff] px-3 py-1.5 text-[11px] uppercase text-[#1f63b2]">
                      {discountPercent}% off
                    </span>
                  ) : null}
                  {listing.priceUnit ? (
                    <span className="pb-1 text-xs text-slate-500">{listing.priceUnit}</span>
                  ) : null}
                </div>
              </div>

              {listingAttributes.length > 0 ? (
                <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm text-slate-950">Attributes</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {listingAttributes.map(([key, value]) => (
                      <div key={key} className="rounded-[16px] bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{key}</p>
                        <p className="mt-1 break-words text-sm text-slate-900">
                          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {isDeal ? (
                <div className="rounded-[22px] border border-[#b8d4f4] bg-[#eef6ff] p-5 shadow-sm">
                  <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm uppercase text-slate-900">
                        <span className="h-3 w-3 rounded-full bg-[#1f63b2]" />
                        {showDealTimer ? 'Deal Ends In' : 'Deal Status'}
                      </p>
                      <p className="mt-1 max-w-full break-words text-xs text-slate-600 sm:max-w-sm">
                        Window:{' '}
                        {isDealWindowValid
                          ? `${formatDealWindow(dealStart)} - ${formatDealWindow(dealEnd)}`
                          : 'Not configured'}
                      </p>
                    </div>
                    {showDealTimer ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {timerParts.map((part) => (
                          <span
                            key={part.label}
                            className="grid h-[58px] w-[58px] place-items-center rounded-[14px] bg-[#0f2440] text-center text-white shadow-sm"
                          >
                            <span>
                              <span className="block text-xl leading-none">{part.value}</span>
                              <span className="mt-1 block text-[9px] leading-none">
                                {part.label}
                              </span>
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-lg text-slate-900">{dealStatus || 'Deal unavailable'}</p>
                    )}
                  </div>

                  {purchaseLimitLabel ? (
                    <p className="mt-4 inline-flex rounded-full border border-[#b8d4f4] bg-white px-3 py-1.5 text-xs font-semibold text-[#1f63b2]">
                      {purchaseLimitLabel}
                    </p>
                  ) : null}

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={handleBookDeal}
                      disabled={isBookDealDisabled}
                      className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#1f63b2] px-5 text-sm text-white shadow-sm transition hover:bg-[#174f92] disabled:opacity-60"
                    >
                      {!userId ? 'Login to Book' : isDealSoldOut ? 'Slots Full' : 'Book This Deal'}
                    </button>
                    {bookingMessage ? (
                      <p className="mt-2 text-sm text-slate-700">{bookingMessage}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {renderBuyerOptions()}

              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {contactQuery.data ? (
                  <a
                    href={`tel:${contactQuery.data}`}
                    onClick={() => {
                      if (!listing?.id) return;
                      void trackWebGenerateLead({
                        listingId: listing.id,
                        listingTitle: listing.title,
                        method: 'call',
                        category: listing.category,
                      });
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#1f63b2] px-4 text-sm text-white shadow-sm transition hover:bg-[#174f92]"
                  >
                    <Phone size={16} /> Call Seller
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={!userId}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#1f63b2] px-4 text-sm text-white shadow-sm transition hover:bg-[#174f92] disabled:opacity-60"
                    onClick={() => {
                      if (!userId) window.location.href = '/auth/register';
                    }}
                  >
                    <Phone size={16} /> {userId ? 'Contact Unavailable' : 'Login to Call'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleMessageSeller()}
                  disabled={isSendingMessage}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#1f63b2] bg-white px-4 text-sm text-[#1f63b2] shadow-sm transition hover:bg-[#eef6ff] disabled:opacity-60"
                >
                  <MessageCircle size={16} />{' '}
                  {userId
                    ? isSendingMessage
                      ? 'Opening Chat...'
                      : 'Message Seller'
                    : 'Login to Chat'}
                </button>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <button
                  type="button"
                  onClick={openDirections}
                  className="flex w-full items-center justify-between rounded-[16px] bg-[#eef6ff] px-4 py-4 text-left transition hover:bg-[#e3f0ff]"
                >
                  <div className="flex items-center gap-3">
                    <Navigation className="text-[#1f63b2]" size={22} />
                    <div>
                      <p className="text-sm text-slate-900">Get Directions</p>
                      <p className="mt-1 text-xs text-slate-500">Open this location in maps</p>
                    </div>
                  </div>
                  <ChevronRight size={20} />
                </button>
                {detailsAddressLabel || detailsPincodeLabel ? (
                  <div className="mt-3 flex items-start gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <MapPin className="mt-0.5 shrink-0 text-[#1f63b2]" size={16} />
                    <div className="min-w-0">
                      {detailsAddressLabel ? (
                        <p className="break-words">{detailsAddressLabel}</p>
                      ) : null}
                      {detailsPincodeLabel ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Pincode: {detailsPincodeLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {listing.sellerAvatar ? (
                    <img
                      src={listing.sellerAvatar}
                      alt={listing.sellerName || 'Seller'}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[#1f63b2] text-sm text-white">
                      {(listing.sellerName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">
                      {listing.sellerName || 'User'}
                    </p>
                    <p className="truncate text-xs text-slate-500">Seller profile</p>
                  </div>
                  {listing.sellerVerified ? (
                    <ShieldCheck className="text-sky-500" size={16} />
                  ) : null}
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <label
                  htmlFor="seller-message"
                  className="text-xs uppercase tracking-wide text-slate-500"
                >
                  Message
                </label>
                <textarea
                  id="seller-message"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder={`Hi, I am interested in ${listing.title}. Is it available?`}
                  className="mt-3 min-h-24 w-full resize-none rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#1f63b2] focus:ring-4 focus:ring-[#1f63b2]/10"
                  maxLength={900}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{messageDraft.length}/900</p>
                  <button
                    type="button"
                    onClick={() => void handleMessageSeller()}
                    disabled={isSendingMessage}
                    className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#1f63b2] px-5 text-xs text-white shadow-sm transition hover:bg-[#174f92] disabled:opacity-60"
                  >
                    <Send size={14} />{' '}
                    {userId ? (isSendingMessage ? 'Sending...' : 'Send Message') : 'Login to Send'}
                  </button>
                </div>
                {messageStatus ? (
                  <p className="mt-2 text-xs text-rose-600">{messageStatus}</p>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm text-slate-950">Description</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {listing.description || 'No description provided.'}
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </main>
      <LandingFooter />
    </div>
  );
}
