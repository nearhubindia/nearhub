import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  Camera,
  CheckCircle2,
  CreditCard,
  ImagePlus,
  IndianRupee,
  MapPin,
  Mic,
  Package,
  Percent,
  Send,
  ShoppingCart,
  Star,
  Tag,
  Video,
  Wrench,
} from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { createListing } from '../api/listings';
import { getListingImages } from '@/features/landing/lib/listing-images';
import {
  getAttributeKey,
  getDefaultAdminMainCategory,
  getSubCategoriesForMainCategory,
  type ListingAttributeDefinition,
  shouldRequireConditionForCategory,
} from '@/features/admin/constants/listing-taxonomy';
import { useListingTaxonomy } from '@/features/admin/hooks/useListingTaxonomy';

type StoredUser = {
  id?: string;
  name?: string;
  phone?: string;
};

type StarterCreditsSummary = {
  isActive: boolean;
  listingsRemaining: number;
  boostsRemaining: number;
};

type UserSubscriptionSummary = {
  id?: string;
  subscriptionTierId?: string;
  status?: string;
  expiresAt?: string;
  listingsUsed?: number;
  boostsRemaining?: number;
  tier?: {
    id?: string;
    name?: string;
    durationDays?: number;
    maxListings?: number;
    boostCredits?: number;
  } | null;
};

type SubscriptionStatusResponse = {
  success?: boolean;
  data?: UserSubscriptionSummary[];
  starterCredits?: StarterCreditsSummary;
  error?: string;
};

type PresignResponse = {
  success?: boolean;
  error?: string;
  data?: { uploadUrl?: string; publicUrl?: string };
};

type SourceListingResponse = {
  success?: boolean;
  listing?: {
    title?: string;
    description?: string;
    mainCategory?: string;
    subCategory?: string;
    category?: string;
    price?: string | number;
    offerPrice?: string | number;
    condition?: string;
    location?: string;
    pincode?: string | number;
    images?: string[];
    videos?: string[];
    image?: string;
    imageUrl?: string;
    productImage?: string;
    productImageUrl?: string;
    thumbnail?: string;
    thumbnailUrl?: string;
  };
};

type Mode = 'listing' | 'deal';
type DealType = 'normal' | 'combo';
type DealRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
type PostDealPriceMode = 'original' | 'discount';
type PostIntent = 'sell' | 'buy' | 'service' | 'job';
type CameraMode = 'photo' | 'video' | null;
type EmiPlan = { durationMonths: string };
type ListingAttributeValue = string | number | boolean;
type LocationLookupResult = {
  locationName?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

const MAX_IMAGE_UPLOADS = 5;
const MAX_NORMAL_DEAL_IMAGE_UPLOADS = 4;
const MAX_COMBO_DEAL_IMAGE_UPLOADS = 2;
const MAX_VIDEO_UPLOADS = 2;
const EMI_DURATION_OPTIONS = ['3', '6', '9', '12', '18', '24'];
const defaultMainCategory = getDefaultAdminMainCategory();
const defaultSubCategory = getSubCategoriesForMainCategory(defaultMainCategory)[0] || 'Other';

function sanitizePriceInput(value: string | number | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!normalized) return '';

  const [wholePart, ...fractionParts] = normalized.split('.');
  const whole = (wholePart || '0').replace(/^0+(?=\d)/, '');
  const fraction = fractionParts.join('');

  if (!fractionParts.length || /^0*$/.test(fraction)) {
    return whole;
  }

  return `${whole}.${fraction.slice(0, 2)}`;
}

function normalizeAttributeValue(
  fieldType: string,
  rawValue: ListingAttributeValue
): ListingAttributeValue | null {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  const value = String(rawValue).trim();
  if (!value) return null;

  const normalizedFieldType = fieldType.trim().toLowerCase();
  if (normalizedFieldType === 'number' || normalizedFieldType === 'price') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return value;
}

function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('nearhub_web_user');
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

function readStoredToken(): string {
  try {
    return String(localStorage.getItem('nearhub_web_token') || '').trim();
  } catch {
    return '';
  }
}

function todayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneWeekLaterDateValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function nowTimeValue(): string {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function parsePrice(value: unknown): number {
  const amount = typeof value === 'string' ? Number(value) : Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function isCoordinateLabel(value: string): boolean {
  return /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(value.trim());
}

function isPincodeLabel(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

function isPlaceholderLocation(value: string): boolean {
  return /^(nearby|nearby location|location unavailable)$/i.test(value.trim());
}

function parseCoordinateLabel(value: string): { latitude: string; longitude: string } | null {
  if (!isCoordinateLabel(value)) return null;
  const [latitude, longitude] = value.split(',').map((item) => item.trim());
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

async function fetchLocationFromCoordinates(
  latitude: string,
  longitude: string
): Promise<LocationLookupResult | null> {
  const reverseResponse = await fetch(
    `${getApiUrl()}/api/location/reverse-geocode?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
  );
  const reversePayload = (await reverseResponse.json().catch(() => ({}))) as {
    success?: boolean;
    data?: LocationLookupResult;
  };
  if (reverseResponse.ok && reversePayload.success && reversePayload.data) {
    const locationName = formatLocationName(reversePayload.data);
    const pincode = String(reversePayload.data.pincode || '').trim();
    if (locationName || pincode) {
      return reversePayload.data;
    }
  }

  const nearbyResponse = await fetch(
    `${getApiUrl()}/api/location/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radius=25`
  );
  const nearbyPayload = (await nearbyResponse.json().catch(() => [])) as LocationLookupResult[];
  const nearest = Array.isArray(nearbyPayload) ? nearbyPayload[0] : null;
  return nearest || null;
}

function formatDateLabel(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function fetchLocationFromPincode(pincode: string): Promise<LocationLookupResult | null> {
  const response = await fetch(
    `${getApiUrl()}/api/location/pincode/${encodeURIComponent(pincode)}`
  );
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: LocationLookupResult;
  };
  if (!response.ok || !payload.success || !payload.data) return null;
  return payload.data;
}

function Section({
  number,
  title,
  children,
  className,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}): ReactElement {
  return (
    <section
      className={classNames(
        'rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5',
        className
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1f63b2] text-xs font-normal text-white">
          {number}
        </span>
        <h2 className="text-sm font-normal text-slate-900 sm:text-base">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StepRail({
  steps,
  activeStep,
}: {
  steps: Array<{ title: string; hint: string }>;
  activeStep: number;
}): ReactElement {
  return (
    <aside className="sticky top-24 h-fit rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        {steps.map((step, index) => {
          const number = index + 1;
          const active = number === activeStep;
          const done = number < activeStep;
          return (
            <div key={step.title} className="relative flex gap-3 pb-7 last:pb-0">
              {index < steps.length - 1 ? (
                <span className="absolute left-3.5 top-8 h-[calc(100%-1rem)] border-l border-dashed border-slate-200" />
              ) : null}
              <span
                className={classNames(
                  'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-normal',
                  active || done ? 'bg-[#2368c9] text-white' : 'bg-slate-100 text-slate-500'
                )}
              >
                {number}
              </span>
              <span className="min-w-0">
                <span
                  className={classNames(
                    'block text-sm font-normal',
                    active ? 'text-[#1f63b2]' : 'text-slate-800'
                  )}
                >
                  {step.title}
                </span>
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                  {step.hint}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function textInputClass(extra = ''): string {
  return classNames(
    'h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1f63b2] focus:ring-4 focus:ring-[#1f63b2]/10',
    extra
  );
}

function textareaClass(extra = ''): string {
  return classNames(
    'w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1f63b2] focus:ring-4 focus:ring-[#1f63b2]/10',
    extra
  );
}

export default function CreateListingPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const storedUser = readStoredUser();
  const userId = String(storedUser?.id || '').trim();
  const userPhone = String(storedUser?.phone || '').trim();
  const authToken = readStoredToken();
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('mode')?.toLowerCase() === 'deal' ? 'deal' : 'listing'
  );
  const [postIntent, setPostIntent] = useState<PostIntent>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainCategory, setMainCategory] = useState(defaultMainCategory);
  const [subCategory, setSubCategory] = useState(defaultSubCategory);
  const [price, setPrice] = useState('');
  const [listingOfferPrice, setListingOfferPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('per unit');
  const [condition, setCondition] = useState('Good');
  const [location, setLocation] = useState('');
  const [pincode, setPincode] = useState('');
  const [brand, setBrand] = useState('');
  const [stock, setStock] = useState('');
  const [dealType, setDealType] = useState<DealType>(() =>
    searchParams.get('dealType')?.toLowerCase() === 'combo' ? 'combo' : 'normal'
  );
  const [dealStartDate, setDealStartDate] = useState(todayDateValue());
  const [dealStartTime, setDealStartTime] = useState(nowTimeValue());
  const [dealEndDate, setDealEndDate] = useState(oneWeekLaterDateValue());
  const [dealEndTime, setDealEndTime] = useState(nowTimeValue());
  const [dealRecurrence, setDealRecurrence] = useState<DealRecurrence>('none');
  const [dealRecurrenceUntil, setDealRecurrenceUntil] = useState(oneWeekLaterDateValue());
  const [postDealPriceMode, setPostDealPriceMode] = useState<PostDealPriceMode>('original');
  const [postDealDiscountPrice, setPostDealDiscountPrice] = useState('');
  const [emiAvailable, setEmiAvailable] = useState(false);
  const [emiPlans, setEmiPlans] = useState<EmiPlan[]>([{ durationMonths: '6' }]);
  const [warrantyText, setWarrantyText] = useState('');
  const [dealFeatureDraft, setDealFeatureDraft] = useState('');
  const [dealExtraFeatures, setDealExtraFeatures] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [starterCredits, setStarterCredits] = useState<StarterCreditsSummary | null>(null);
  const [subscriptionSummaries, setSubscriptionSummaries] = useState<UserSubscriptionSummary[]>([]);
  const [activePlanName, setActivePlanName] = useState('');
  const [activeSubscriptionId, setActiveSubscriptionId] = useState('');
  const [activeSubscriptionTierId, setActiveSubscriptionTierId] = useState('');
  const [isLoadingSubscriptionStatus, setIsLoadingSubscriptionStatus] = useState(false);
  const [loadedSourceListingId, setLoadedSourceListingId] = useState('');
  const [message, setMessage] = useState('');
  const [listingStep, setListingStep] = useState(1);
  const [dealStep, setDealStep] = useState(1);
  const [attributeValues, setAttributeValues] = useState<Record<string, ListingAttributeValue>>({});
  const { groups: categoryGroups, priceUnits, attributesByKey } = useListingTaxonomy();

  const subCategories = useMemo(
    () =>
      categoryGroups.find((entry) => entry.mainCategory === mainCategory)?.subcategories ||
      categoryGroups[0]?.subcategories ||
      getSubCategoriesForMainCategory(mainCategory),
    [categoryGroups, mainCategory]
  );
  const mainCategoryOptions = useMemo(
    () => categoryGroups.map((group) => group.mainCategory),
    [categoryGroups]
  );
  const attributeDefinitions = useMemo(
    () => attributesByKey[getAttributeKey(mainCategory, subCategory)] || [],
    [attributesByKey, mainCategory, subCategory]
  );
  const activeSubscriptionOptions = useMemo(() => {
    const now = Date.now();
    return subscriptionSummaries
      .map((item) => {
        const maxListings = Number(item.tier?.maxListings || 0);
        const listingsUsed = Number(item.listingsUsed || 0);
        const listingsRemaining = maxListings === -1 ? -1 : Math.max(0, maxListings - listingsUsed);
        const tierName = String(item.tier?.name || 'Subscription').trim();
        const tierId = String(item.subscriptionTierId || item.tier?.id || '').trim();
        const expiresAt = String(item.expiresAt || '').trim();
        const expiresAtMs = new Date(expiresAt).getTime();
        const isActive = String(item.status || '').toLowerCase() === 'active';
        const isValid = isActive && Number.isFinite(expiresAtMs) && expiresAtMs > now;

        return {
          ...item,
          tierId,
          tierName,
          expiresAt,
          maxListings,
          listingsUsed,
          listingsRemaining,
          isValid,
          isUnlimited: maxListings === -1,
          canCreateListing: maxListings === -1 || listingsRemaining > 0,
          boostCredits: Number(item.tier?.boostCredits || 0),
          boostsRemaining: Number(item.boostsRemaining || 0),
          durationDays: Number(item.tier?.durationDays || 30),
        };
      })
      .filter((item) => item.isValid)
      .sort((a, b) => {
        if (a.isUnlimited !== b.isUnlimited) return a.isUnlimited ? -1 : 1;
        if (a.listingsRemaining !== b.listingsRemaining)
          return b.listingsRemaining - a.listingsRemaining;
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      });
  }, [subscriptionSummaries]);
  const selectableSubscriptionOptions = useMemo(
    () => activeSubscriptionOptions.filter((item) => item.canCreateListing),
    [activeSubscriptionOptions]
  );
  const selectedSubscriptionOption = useMemo(
    () => activeSubscriptionOptions.find((item) => item.id === activeSubscriptionId) || null,
    [activeSubscriptionId, activeSubscriptionOptions]
  );
  const postingSubscriptionOption =
    selectedSubscriptionOption || selectableSubscriptionOptions[0] || null;
  const maxImageUploads =
    mode === 'deal'
      ? dealType === 'combo'
        ? MAX_COMBO_DEAL_IMAGE_UPLOADS
        : MAX_NORMAL_DEAL_IMAGE_UPLOADS
      : MAX_IMAGE_UPLOADS;
  const dealTypeLabel = dealType === 'combo' ? 'Combo Deal' : 'Deal';
  const chooseListingUrl = `/my-listings?dealType=${encodeURIComponent(dealType)}`;
  const listingSteps = [
    { title: 'Basics', hint: 'Title and category' },
    { title: 'Pricing', hint: 'Price and condition' },
    { title: 'Location', hint: 'Where buyers find it' },
    { title: 'Media', hint: 'Photos and video' },
    { title: 'Publish', hint: 'Review and submit' },
  ];
  const dealSteps = [
    { title: 'Deal Type', hint: 'Choose deal style' },
    { title: 'Choose Listing', hint: 'Select an existing listing' },
    { title: 'Deal Details', hint: 'Price, stock and time' },
    { title: 'Review & Publish', hint: 'Confirm and go live' },
  ];
  const sourceListingId = String(searchParams.get('sourceListing') || '').trim();
  const activeDealStep = sourceListingId ? dealStep : Math.min(dealStep, 2);
  const shouldRequireCondition = useMemo(
    () => shouldRequireConditionForCategory(mainCategory, subCategory),
    [mainCategory, subCategory]
  );
  useEffect(() => {
    if (!mainCategoryOptions.length) return;
    if (!mainCategoryOptions.includes(mainCategory)) {
      const fallbackMain = mainCategoryOptions[0];
      const fallbackSubs =
        categoryGroups.find((entry) => entry.mainCategory === fallbackMain)?.subcategories || [];
      setMainCategory(fallbackMain);
      setSubCategory(fallbackSubs[0] || 'Other');
      return;
    }
    if (subCategories.length && !subCategories.includes(subCategory)) {
      setSubCategory(subCategories[0]);
    }
  }, [categoryGroups, mainCategory, mainCategoryOptions, subCategories, subCategory]);
  useEffect(() => {
    if (!priceUnits.length) return;
    if (!priceUnits.includes(priceUnit)) {
      setPriceUnit(priceUnits[0]);
    }
  }, [priceUnit, priceUnits]);
  useEffect(() => {
    if (mode !== 'deal') return;
    if (sourceListingId) {
      setDealStep(2);
    } else {
      setDealStep((step) => Math.min(step, 2));
    }
  }, [mode, sourceListingId]);
  const completionCount = useMemo(() => {
    const checks = [
      Boolean(title.trim()),
      Boolean(mainCategory.trim() && subCategory.trim()),
      Boolean(price.trim()),
      Boolean(description.trim()),
      !shouldRequireCondition || Boolean(condition.trim()),
      Boolean(location.trim()),
      /^\d{6}$/.test(pincode.trim()),
      images.length > 0,
      mode === 'deal' ? Boolean(stock.trim()) : true,
      mode === 'deal'
        ? Boolean(dealStartDate && dealStartTime && dealEndDate && dealEndTime)
        : true,
    ];
    return checks.filter(Boolean).length;
  }, [
    condition,
    dealEndDate,
    dealEndTime,
    description,
    images.length,
    location,
    mainCategory,
    mode,
    pincode,
    price,
    shouldRequireCondition,
    stock,
    subCategory,
    title,
  ]);
  const subscriptionStatusLabel = isLoadingSubscriptionStatus
    ? 'Checking status...'
    : postingSubscriptionOption
      ? `${postingSubscriptionOption.tierName} Active`
      : activeSubscriptionOptions.length > 0
        ? 'Active subscriptions exhausted'
        : starterCredits?.isActive && starterCredits.listingsRemaining > 0
          ? 'Starter Pack Active'
          : 'No Posting Credits';
  const subscriptionStatusHint = postingSubscriptionOption
    ? postingSubscriptionOption.isUnlimited
      ? 'This subscription can create unlimited listings.'
      : `${postingSubscriptionOption.listingsRemaining} listing slot${
          postingSubscriptionOption.listingsRemaining === 1 ? '' : 's'
        } remaining on this subscription.`
    : activeSubscriptionOptions.length > 0
      ? 'Your active subscriptions are out of listing slots. Pick another plan or use starter credits.'
      : starterCredits?.isActive && starterCredits.listingsRemaining > 0
        ? 'You can post ads with starter credits.'
        : 'Buy a plan or apply a valid coupon to publish.';
  const listingsLeftText = isLoadingSubscriptionStatus
    ? '-'
    : postingSubscriptionOption
      ? postingSubscriptionOption.isUnlimited
        ? '∞'
        : String(postingSubscriptionOption.listingsRemaining)
      : String(starterCredits?.listingsRemaining ?? 0);
  const boostsLeftText = isLoadingSubscriptionStatus
    ? '-'
    : postingSubscriptionOption
      ? String(postingSubscriptionOption.boostsRemaining)
      : String(starterCredits?.boostsRemaining ?? 0);
  const needsPostingCredits = !(mode === 'deal' && Boolean(sourceListingId));
  const hasPostingCredits = !needsPostingCredits
    ? true
    : Boolean(
        postingSubscriptionOption?.canCreateListing ||
        (starterCredits?.isActive && starterCredits.listingsRemaining > 0)
      );
  const emiBaseAmount = parsePrice(mode === 'deal' ? offerPrice || price : offerPrice || price);
  const calculateMonthlyEmi = (durationMonths: string): string => {
    const months = Number(durationMonths);
    if (!emiBaseAmount || !Number.isFinite(months) || months <= 0) return '';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
      Math.ceil(emiBaseAmount / months)
    );
  };
  useEffect(() => {
    if (!cameraPreviewRef.current) return;
    cameraPreviewRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  useEffect(() => {
    setImages((prev) => prev.slice(0, maxImageUploads));
  }, [maxImageUploads]);

  useEffect(() => {
    let ignore = false;
    const loadSubscriptionStatus = async () => {
      if (!userId) return;
      setIsLoadingSubscriptionStatus(true);
      try {
        const response = await fetch(`${getApiUrl()}/api/subscriptions`, {
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
            'x-user-phone': userPhone,
          },
        });
        const payload = (await response.json().catch(() => ({}))) as SubscriptionStatusResponse;
        if (!response.ok || !payload.success)
          throw new Error(payload.error || 'Failed to load subscription status');
        if (ignore) return;
        setSubscriptionSummaries(payload.data || []);
        const activePlan = (payload.data || []).find((item) => {
          if (item.status !== 'active') return false;
          const maxListings = Number(item.tier?.maxListings || 0);
          const listingsUsed = Number(item.listingsUsed || 0);
          return maxListings === -1 || listingsUsed < maxListings;
        });
        setStarterCredits(payload.starterCredits || null);
        setActivePlanName(String(activePlan?.tier?.name || '').trim());
        setActiveSubscriptionId(String(activePlan?.id || '').trim());
        setActiveSubscriptionTierId(
          String(activePlan?.subscriptionTierId || activePlan?.tier?.id || '').trim()
        );
      } catch {
        if (!ignore) {
          setStarterCredits(null);
          setActivePlanName('');
          setActiveSubscriptionId('');
          setActiveSubscriptionTierId('');
        }
      } finally {
        if (!ignore) setIsLoadingSubscriptionStatus(false);
      }
    };

    void loadSubscriptionStatus();
    return () => {
      ignore = true;
    };
  }, [userId, userPhone]);

  useEffect(() => {
    if (selectableSubscriptionOptions.length === 0) {
      if (activeSubscriptionId || activeSubscriptionTierId || activePlanName) {
        setActiveSubscriptionId('');
        setActiveSubscriptionTierId('');
        setActivePlanName('');
      }
      return;
    }

    const currentOption =
      selectableSubscriptionOptions.find((item) => item.id === activeSubscriptionId) || null;
    const nextOption = currentOption || selectableSubscriptionOptions[0];

    if (nextOption.id && nextOption.id !== activeSubscriptionId) {
      setActiveSubscriptionId(nextOption.id);
    }

    const nextTierId = String(nextOption.subscriptionTierId || nextOption.tierId || '').trim();
    const nextPlanName = String(nextOption.tierName || '').trim();
    if (nextTierId !== activeSubscriptionTierId) {
      setActiveSubscriptionTierId(nextTierId);
    }
    if (nextPlanName !== activePlanName) {
      setActivePlanName(nextPlanName);
    }
  }, [
    activePlanName,
    activeSubscriptionId,
    activeSubscriptionTierId,
    selectableSubscriptionOptions,
    activeSubscriptionOptions,
  ]);

  useEffect(() => {
    if (mode !== 'deal' || !sourceListingId) return;

    let ignore = false;
    const loadSourceListing = async () => {
      try {
        const response = await fetch(
          `${getApiUrl()}/api/listings/${encodeURIComponent(sourceListingId)}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId,
              'x-user-phone': userPhone,
            },
          }
        );
        const payload = (await response.json().catch(() => ({}))) as SourceListingResponse;
        const source = payload.listing;
        if (!response.ok || !payload.success || !source || ignore) return;

        const shouldReplaceSource = loadedSourceListingId !== sourceListingId;
        setTitle((value) =>
          shouldReplaceSource
            ? String(source.title || '').slice(0, 80)
            : value || String(source.title || '').slice(0, 80)
        );
        setDescription((value) =>
          shouldReplaceSource
            ? String(source.description || '').slice(0, 1000)
            : value || String(source.description || '').slice(0, 1000)
        );
        setPrice((value) =>
          shouldReplaceSource
            ? sanitizePriceInput(source.price)
            : value || sanitizePriceInput(source.price)
        );
        const sourceOfferPrice = sanitizePriceInput(source.offerPrice);
        setListingOfferPrice(sourceOfferPrice);
        setOfferPrice((value) => (shouldReplaceSource ? '' : value));
        setCondition((value) =>
          shouldReplaceSource
            ? String(source.condition || 'Good')
            : value || String(source.condition || 'Good')
        );
        setLocation((value) =>
          shouldReplaceSource
            ? String(source.location || '')
            : value || String(source.location || '')
        );
        setPincode((value) =>
          shouldReplaceSource
            ? String(source.pincode || '')
                .replace(/[^0-9]/g, '')
                .slice(0, 6)
            : value ||
              String(source.pincode || '')
                .replace(/[^0-9]/g, '')
                .slice(0, 6)
        );
        if (source.mainCategory) {
          const nextMain = String(source.mainCategory);
          const nextSubs =
            categoryGroups.find((entry) => entry.mainCategory === nextMain)?.subcategories ||
            getSubCategoriesForMainCategory(nextMain);
          setMainCategory(nextMain);
          setSubCategory(String(source.subCategory || source.category || nextSubs[0] || 'Other'));
        } else if (source.category) {
          setSubCategory(String(source.category));
        }
        const sourceImages = getListingImages(source);
        setImages((items) =>
          shouldReplaceSource
            ? sourceImages.slice(0, maxImageUploads)
            : items.length
              ? items
              : sourceImages.slice(0, maxImageUploads)
        );
        setVideos((items) =>
          shouldReplaceSource
            ? (source.videos || []).slice(0, MAX_VIDEO_UPLOADS)
            : items.length
              ? items
              : (source.videos || []).slice(0, MAX_VIDEO_UPLOADS)
        );
        setLoadedSourceListingId(sourceListingId);
      } catch {
        if (!ignore)
          setMessage(
            'Unable to prefill from this listing. You can still create the deal manually.'
          );
      }
    };

    void loadSourceListing();
    return () => {
      ignore = true;
    };
  }, [
    categoryGroups,
    loadedSourceListingId,
    maxImageUploads,
    mode,
    searchParams,
    sourceListingId,
    userId,
    userPhone,
  ]);

  if (!userId) return <Navigate to="/auth/register" replace />;

  const resetForMode = (nextMode: Mode) => {
    setMode(nextMode);
    setSearchParams(nextMode === 'deal' ? { mode: 'deal' } : {});
    setMessage('');
    setListingStep(1);
    setDealStep(1);
    if (nextMode === 'deal') {
      setPostIntent('sell');
      setOfferPrice(price || offerPrice);
      if (!stock) setStock('10');
      if (!dealStartDate) setDealStartDate(todayDateValue());
      if (!dealStartTime) setDealStartTime(nowTimeValue());
      if (!dealEndDate) setDealEndDate(oneWeekLaterDateValue());
      if (!dealEndTime) setDealEndTime(nowTimeValue());
    }
  };

  const requestPresignedUpload = async (params: {
    mediaType: 'image' | 'video';
    fileName: string;
    contentType: string;
    fileSizeBytes: number;
  }): Promise<{ uploadUrl: string; publicUrl: string }> => {
    const response = await fetch(`${getApiUrl()}/api/media/presign-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const payload = (await response.json().catch(() => ({}))) as PresignResponse;
    if (!response.ok || !payload.success || !payload.data?.uploadUrl || !payload.data?.publicUrl) {
      throw new Error(payload.error || 'Failed to prepare media upload');
    }
    return { uploadUrl: payload.data.uploadUrl, publicUrl: payload.data.publicUrl };
  };

  const uploadFileToR2 = async (file: File, mediaType: 'image' | 'video'): Promise<string> => {
    const contentType = file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
    const presign = await requestPresignedUpload({
      mediaType,
      fileName: file.name,
      contentType,
      fileSizeBytes: file.size,
    });

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      uploadResponse = await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: file,
      });
    }

    if (!uploadResponse.ok) throw new Error(`Upload failed (${uploadResponse.status})`);
    return presign.publicUrl;
  };

  const uploadCapturedFile = async (file: File, mediaType: 'image' | 'video') => {
    setIsUploadingMedia(true);
    setMessage('');
    try {
      const url = await uploadFileToR2(file, mediaType);
      if (mediaType === 'image') {
        setImages((prev) => [...prev, url].slice(0, maxImageUploads));
      } else {
        setVideos((prev) => [...prev, url].slice(0, MAX_VIDEO_UPLOADS));
      }
    } catch {
      setMessage(
        mediaType === 'image'
          ? 'Failed to upload captured photo.'
          : 'Failed to upload recorded video.'
      );
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const closeCamera = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraMode(null);
    setIsRecordingVideo(false);
    recordedChunksRef.current = [];
  };

  const openCamera = async (nextMode: Exclude<CameraMode, null>) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera is not available in this browser.');
      return;
    }
    if (nextMode === 'photo' && images.length >= maxImageUploads) {
      setMessage(`You can upload a maximum of ${maxImageUploads} images.`);
      return;
    }
    if (nextMode === 'video' && videos.length >= MAX_VIDEO_UPLOADS) {
      setMessage(`You can upload a maximum of ${MAX_VIDEO_UPLOADS} videos.`);
      return;
    }

    closeCamera();
    setMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: nextMode === 'video',
      });
      setCameraStream(stream);
      setCameraMode(nextMode);
    } catch {
      setMessage('Unable to open camera. Please allow camera access and try again.');
    }
  };

  const capturePhoto = async () => {
    const video = cameraPreviewRef.current;
    if (!video || !cameraStream) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      setMessage('Unable to capture photo.');
      return;
    }
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );
    if (!blob) {
      setMessage('Unable to capture photo.');
      return;
    }
    await uploadCapturedFile(
      new File([blob], `nearhub-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }),
      'image'
    );
    closeCamera();
  };

  const startVideoRecording = () => {
    if (!cameraStream || typeof MediaRecorder === 'undefined') {
      setMessage('Video recording is not available in this browser.');
      return;
    }
    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    const recorder = new MediaRecorder(cameraStream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      if (blob.size > 0) {
        void uploadCapturedFile(
          new File([blob], `nearhub-video-${Date.now()}.webm`, { type: 'video/webm' }),
          'video'
        );
      }
      closeCamera();
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecordingVideo(true);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const allowed = files.slice(0, Math.max(0, maxImageUploads - images.length));
    if (!allowed.length) {
      setMessage(`You can upload a maximum of ${maxImageUploads} images.`);
      event.target.value = '';
      return;
    }
    setIsUploadingMedia(true);
    setMessage('');
    try {
      const uploaded = await Promise.all(allowed.map((file) => uploadFileToR2(file, 'image')));
      setImages((prev) => [...prev, ...uploaded].slice(0, maxImageUploads));
    } catch {
      setMessage('Failed to upload images. Please try again.');
    } finally {
      setIsUploadingMedia(false);
      event.target.value = '';
    }
  };

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const allowed = files.slice(0, Math.max(0, MAX_VIDEO_UPLOADS - videos.length));
    if (!allowed.length) {
      setMessage(`You can upload a maximum of ${MAX_VIDEO_UPLOADS} videos.`);
      event.target.value = '';
      return;
    }
    setIsUploadingMedia(true);
    setMessage('');
    try {
      const uploaded = await Promise.all(allowed.map((file) => uploadFileToR2(file, 'video')));
      setVideos((prev) => [...prev, ...uploaded].slice(0, MAX_VIDEO_UPLOADS));
    } catch {
      setMessage('Failed to upload videos. Please try again.');
    } finally {
      setIsUploadingMedia(false);
      event.target.value = '';
    }
  };

  const resolveCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setMessage('Current location is not available in this browser.');
      return;
    }
    setIsResolvingLocation(true);
    setMessage('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);
        try {
          const resolved = await fetchLocationFromCoordinates(latitude, longitude);
          const resolvedLocation = formatLocationName(resolved);
          const resolvedPincode = String(resolved?.pincode || '').trim();
          if (resolvedLocation) {
            setLocation(resolvedLocation);
          } else if (mode === 'listing') {
            setLocation(`${latitude}, ${longitude}`);
          } else {
            setMessage('Unable to find a location name. Please enter it manually.');
          }
          if (resolvedPincode) {
            setPincode(resolvedPincode);
          }
        } catch {
          if (mode === 'listing') {
            setLocation(`${latitude}, ${longitude}`);
          } else {
            setMessage('Unable to find a location name. Please enter it manually.');
          }
        } finally {
          setIsResolvingLocation(false);
        }
      },
      () => {
        setIsResolvingLocation(false);
        setMessage('Unable to access current location. Please enter it manually.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const selectMainCategory = (value: string) => {
    const nextSubs =
      categoryGroups.find((entry) => entry.mainCategory === value)?.subcategories ||
      getSubCategoriesForMainCategory(value);
    setMainCategory(value);
    setSubCategory(nextSubs[0] || 'Other');
  };

  const removeSelectedListing = () => {
    setLoadedSourceListingId('');
    setTitle('');
    setDescription('');
    setPrice('');
    setListingOfferPrice('');
    setOfferPrice('');
    setCondition('Good');
    setLocation('');
    setPincode('');
    setBrand('');
    setImages([]);
    setVideos([]);
    setSearchParams({ mode: 'deal', dealType });
    setMessage('Selected listing removed. Choose another listing to promote.');
  };

  const resolveDealLocationForSubmit = async (): Promise<{ location: string; pincode: string }> => {
    let nextLocation = location.trim();
    let nextPincode = pincode.trim();

    if (mode !== 'deal') return { location: nextLocation, pincode: nextPincode };
    if (!nextPincode && isPincodeLabel(nextLocation)) {
      nextPincode = nextLocation;
    }

    const coordinates = parseCoordinateLabel(nextLocation);
    let resolved: LocationLookupResult | null = null;
    try {
      resolved = coordinates
        ? await fetchLocationFromCoordinates(coordinates.latitude, coordinates.longitude)
        : isPincodeLabel(nextPincode) &&
            (!nextLocation ||
              nextLocation === nextPincode ||
              isPincodeLabel(nextLocation) ||
              isPlaceholderLocation(nextLocation))
          ? await fetchLocationFromPincode(nextPincode)
          : null;
    } catch {
      resolved = null;
    }

    const resolvedName = formatLocationName(resolved);
    const resolvedPincode = String(resolved?.pincode || '').trim();

    if (resolvedName) nextLocation = resolvedName;
    if (resolvedPincode) nextPincode = resolvedPincode;

    if (nextLocation !== location.trim()) setLocation(nextLocation);
    if (nextPincode !== pincode.trim()) setPincode(nextPincode);

    return { location: nextLocation, pincode: nextPincode };
  };

  const getAttributeFieldValue = (
    attribute: ListingAttributeDefinition
  ): ListingAttributeValue | '' => {
    const raw = attributeValues[attribute.name];
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'boolean') return raw;
    return String(raw);
  };

  const validateForm = (nextLocation = location, nextPincode = pincode): boolean => {
    if (mode === 'deal' && !sourceListingId) {
      setMessage('Please choose an existing listing to create a deal.');
      return false;
    }
    if (!title.trim()) {
      setMessage(mode === 'deal' ? 'Please enter product title.' : 'Please enter listing title.');
      return false;
    }
    if (!subCategory.trim()) {
      setMessage('Please choose a category.');
      return false;
    }
    if (!price.trim() || Number(price) <= 0) {
      setMessage(mode === 'deal' ? 'Please enter original price.' : 'Please enter a valid price.');
      return false;
    }
    if (mode === 'deal') {
      if (!offerPrice.trim() || Number(offerPrice) <= 0) {
        setMessage('Please enter deal price.');
        return false;
      }
      const dealComparePrice = Number(listingOfferPrice || price);
      if (Number(offerPrice) >= dealComparePrice) {
        setMessage(
          listingOfferPrice
            ? 'Deal price must be lower than offer price.'
            : 'Deal price must be lower than original price.'
        );
        return false;
      }
      if (postDealPriceMode === 'discount') {
        if (!postDealDiscountPrice.trim() || Number(postDealDiscountPrice) <= 0) {
          setMessage('Please enter discount price after deal ends.');
          return false;
        }
        if (Number(postDealDiscountPrice) >= Number(price)) {
          setMessage('Discount price after deal ends must be lower than original price.');
          return false;
        }
      }
      if (!stock.trim() || Number(stock) <= 0) {
        setMessage('Please enter stock available.');
        return false;
      }
      if (!dealStartDate || !dealStartTime) {
        setMessage('Please choose deal start date and time.');
        return false;
      }
      const startAt = new Date(`${dealStartDate}T${dealStartTime}`);
      if (startAt.getTime() <= Date.now()) {
        setMessage('Deal start time must be in the future.');
        return false;
      }
      if (!dealEndDate || !dealEndTime) {
        setMessage('Please choose deal end date and time.');
        return false;
      }
      const endAt = new Date(`${dealEndDate}T${dealEndTime}`);
      if (endAt.getTime() <= Date.now()) {
        setMessage('Deal end time must be in the future.');
        return false;
      }
      if (endAt.getTime() <= startAt.getTime()) {
        setMessage('Deal end time must be after the start time.');
        return false;
      }
      if (dealRecurrence !== 'none') {
        if (!dealRecurrenceUntil) {
          setMessage('Please choose repeat until date.');
          return false;
        }
        const repeatUntil = new Date(`${dealRecurrenceUntil}T23:59`);
        if (repeatUntil.getTime() <= endAt.getTime()) {
          setMessage('Repeat until date must be after the first deal end time.');
          return false;
        }
      }
    }
    if (shouldRequireCondition && !condition.trim()) {
      setMessage('Please select condition.');
      return false;
    }
    const normalizedLocation = nextLocation.trim();
    const normalizedPincode = nextPincode.trim();
    if (!normalizedLocation || (mode === 'deal' && isPlaceholderLocation(normalizedLocation))) {
      setMessage('Please enter location.');
      return false;
    }
    if (mode === 'deal' && isCoordinateLabel(normalizedLocation)) {
      setMessage(
        'Unable to find an area name for these coordinates. Please enter the location name.'
      );
      return false;
    }
    if (!/^\d{6}$/.test(normalizedPincode)) {
      setMessage('Please enter a valid 6-digit pincode.');
      return false;
    }
    return true;
  };

  const submitListing = async () => {
    if (!userId || !authToken) {
      setMessage('Please log in again before creating a listing.');
      const redirectPath = `${window.location.pathname}${window.location.search}`;
      navigate(`/auth/register?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    const resolvedLocation =
      mode === 'deal' && sourceListingId
        ? { location: location.trim(), pincode: pincode.trim() }
        : await resolveDealLocationForSubmit();
    if (!validateForm(resolvedLocation.location, resolvedLocation.pincode)) return;
    if (isUploadingMedia) {
      setMessage('Please wait for media upload to finish.');
      return;
    }

    if (mode === 'listing' && attributeDefinitions.length > 0) {
      const invalidAttribute = attributeDefinitions.find((attribute) => {
        const value = getAttributeFieldValue(attribute);
        return attribute.required && (value === '' || value === null || value === undefined);
      });
      if (invalidAttribute) {
        setMessage(`Please enter ${invalidAttribute.name}.`);
        return;
      }
    }

    setIsSubmitting(true);
    setMessage('');
    try {
      const isDeal = mode === 'deal';
      const dealStartAt = isDeal ? new Date(`${dealStartDate}T${dealStartTime}`) : null;
      const dealEndAt = isDeal ? new Date(`${dealEndDate}T${dealEndTime}`) : null;
      const dealDescription =
        isDeal && brand.trim()
          ? `Brand: ${brand.trim()}\n\n${description.trim()}`
          : description.trim();
      const attributesPayload =
        mode === 'listing' && attributeDefinitions.length > 0
          ? attributeDefinitions.reduce<Record<string, ListingAttributeValue>>((acc, attribute) => {
              const value = getAttributeFieldValue(attribute);
              if (value === '' || value === null || value === undefined) return acc;
              const normalized = normalizeAttributeValue(attribute.fieldType, value);
              if (normalized !== null) acc[attribute.name] = normalized;
              return acc;
            }, {})
          : {};

      if (
        needsPostingCredits &&
        activeSubscriptionId &&
        (!postingSubscriptionOption || !postingSubscriptionOption.canCreateListing)
      ) {
        setMessage(
          'The selected subscription has no listing slots left. Please choose another plan or rely on starter credits.'
        );
        setIsSubmitting(false);
        return;
      }

      if (isDeal && sourceListingId) {
        const response = await fetch(
          `${getApiUrl()}/api/listings/${encodeURIComponent(sourceListingId)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId,
              'x-user-phone': userPhone || '',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
              isDeal: true,
              dealType,
              offerPrice: Number(offerPrice),
              dealStartAt: dealStartAt ? dealStartAt.toISOString() : undefined,
              dealEndAt: dealEndAt ? dealEndAt.toISOString() : undefined,
              dealRecurrence,
              dealRecurrenceUntil:
                dealRecurrence !== 'none'
                  ? new Date(`${dealRecurrenceUntil}T23:59`).toISOString()
                  : undefined,
              dealCycleQuantity: dealRecurrence !== 'none' ? Number(stock) : undefined,
              maxDealBookings: Number(stock),
              dealBookingsUsed: 0,
              postDealPriceMode,
              postDealDiscountPrice:
                postDealPriceMode === 'discount' && postDealDiscountPrice
                  ? Number(postDealDiscountPrice)
                  : undefined,
              dealTerms: 'Voucher can be redeemed while stock is available.',
              voucherEnabled: true,
            }),
          }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          message?: string;
        };
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error || payload.message || 'Failed to create deal.');
        }
        navigate(`/listing/${encodeURIComponent(sourceListingId)}`);
        return;
      }

      const payload = await createListing(
        {
          userId,
          title: title.trim(),
          description: dealDescription,
          mainCategory: mainCategory.trim(),
          subCategory: subCategory.trim(),
          category: subCategory.trim(),
          price: Number(price),
          offerPrice: offerPrice.trim() ? Number(offerPrice) : undefined,
          priceUnit: isDeal ? undefined : priceUnit,
          condition: shouldRequireCondition ? condition : undefined,
          location: resolvedLocation.location,
          pincode: resolvedLocation.pincode || undefined,
          sellerName: String(storedUser?.name || '').trim() || undefined,
          contactPhone: userPhone || undefined,
          images: images.slice(0, maxImageUploads),
          videos: videos.slice(0, MAX_VIDEO_UPLOADS),
          userSubscriptionId:
            needsPostingCredits && postingSubscriptionOption?.canCreateListing
              ? postingSubscriptionOption.id
              : undefined,
          subscriptionTierId:
            needsPostingCredits && postingSubscriptionOption?.canCreateListing
              ? String(
                  postingSubscriptionOption.subscriptionTierId ||
                    postingSubscriptionOption.tierId ||
                    ''
                ).trim()
              : undefined,
          attributes: Object.keys(attributesPayload).length > 0 ? attributesPayload : undefined,
          isDeal,
          dealType: isDeal ? dealType : undefined,
          dealStartAt: dealStartAt ? dealStartAt.toISOString() : undefined,
          dealEndAt: dealEndAt ? dealEndAt.toISOString() : undefined,
          dealRecurrence: isDeal ? dealRecurrence : 'none',
          dealRecurrenceUntil:
            isDeal && dealRecurrence !== 'none'
              ? new Date(`${dealRecurrenceUntil}T23:59`).toISOString()
              : undefined,
          dealCycleQuantity: isDeal && dealRecurrence !== 'none' ? Number(stock) : undefined,
          maxDealBookings: isDeal ? Number(stock) : undefined,
          postDealPriceMode: isDeal ? postDealPriceMode : undefined,
          postDealDiscountPrice:
            isDeal && postDealPriceMode === 'discount' && postDealDiscountPrice
              ? Number(postDealDiscountPrice)
              : undefined,
          comboItems: isDeal ? [] : undefined,
          dealTerms: isDeal ? 'Voucher can be redeemed while stock is available.' : undefined,
          voucherEnabled: isDeal ? true : undefined,
        },
        { userId, userPhone, token: authToken }
      );

      const createdId = String(payload.listing?.id || '').trim();
      navigate(createdId ? `/listing/${createdId}` : '/my-listings');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Failed to create listing. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderModeSwitch = () => (
    <div className="mx-auto mt-5 max-w-4xl px-4 sm:px-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-1.5 font-inter font-normal shadow-[0_16px_40px_-30px_rgba(15,23,42,0.75)]">
        <div className="grid grid-cols-2 gap-2">
          {(['listing', 'deal'] as Mode[]).map((item) => {
            const active = mode === item;
            const Icon = item === 'listing' ? Package : Tag;
            return (
              <button
                key={item}
                type="button"
                onClick={() => resetForMode(item)}
                className={classNames(
                  'flex h-12 items-center justify-center gap-2 rounded-2xl text-xs font-normal font-poppins transition sm:h-[52px] sm:text-sm',
                  active
                    ? 'bg-[#2368e8] text-white shadow-[0_16px_28px_-18px_rgba(35,104,232,0.9)]'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                )}
              >
                <Icon size={16} /> {item === 'listing' ? 'Create Listing' : 'Create Deal'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderWizardNav = ({
    current,
    total,
    onBack,
    onNext,
    onSubmit,
    submitLabel,
    warningText,
  }: {
    current: number;
    total: number;
    onBack: () => void;
    onNext: () => void;
    onSubmit: () => void;
    submitLabel: string;
    warningText?: string;
  }) => (
    <div className="sticky bottom-3 z-20 rounded-[18px] border border-slate-200 bg-white/95 p-3 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.85)] backdrop-blur">
      {warningText ? (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-normal text-amber-800">
          {warningText}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={current <= 1 || isSubmitting || isUploadingMedia}
          className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-normal text-slate-700 transition hover:border-[#9bbdf2] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Back
        </button>
        {current < total ? (
          <button
            type="button"
            onClick={onNext}
            disabled={isSubmitting || isUploadingMedia}
            className="h-11 rounded-xl bg-[#1f63b2] px-6 text-sm font-normal text-white shadow-[0_16px_30px_-20px_rgba(31,99,178,0.8)] disabled:opacity-60"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || isUploadingMedia || !hasPostingCredits}
            className="h-11 rounded-xl bg-[#1f63b2] px-6 text-sm font-normal text-white shadow-[0_16px_30px_-20px_rgba(31,99,178,0.8)] disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <Send size={17} /> {submitLabel}
            </span>
          </button>
        )}
      </div>
    </div>
  );

  const conditionWarningText =
    mode === 'listing' && shouldRequireCondition && !condition.trim()
      ? 'Condition is required for this category. Please choose one before publishing.'
      : undefined;

  const renderListingStatusPanels = () => (
    <>
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-normal font-inter text-slate-900">Choose Subscription</h2>
            <p className="text-xs font-normal text-slate-500">
              Pick the active plan that should power this listing.
            </p>
          </div>
          <Link
            to="/subscriptions"
            className="inline-flex h-9 items-center rounded-full border border-amber-300 bg-amber-50 px-4 text-xs font-normal text-amber-800"
          >
            Manage plans
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {activeSubscriptionOptions.length > 0 ? (
            activeSubscriptionOptions.map((option) => {
              const selected = option.id === activeSubscriptionId;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!option.canCreateListing}
                  onClick={() => {
                    if (!option.canCreateListing || !option.id) return;
                    setActiveSubscriptionId(option.id);
                    setActiveSubscriptionTierId(
                      String(option.subscriptionTierId || option.tierId || '').trim()
                    );
                    setActivePlanName(option.tierName);
                  }}
                  className={classNames(
                    'rounded-2xl border p-4 text-left transition',
                    selected
                      ? 'border-amber-400 bg-amber-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/50',
                    !option.canCreateListing && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-normal text-slate-900">{option.tierName}</p>
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        Expires {formatDateLabel(option.expiresAt)} · {option.durationDays} days
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {selected ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-normal text-emerald-700">
                          Selected
                        </span>
                      ) : null}
                      {!option.canCreateListing ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-normal text-slate-600">
                          Exhausted
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-normal text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Slots</p>
                      <p className="mt-1 text-sm text-slate-900">
                        {option.isUnlimited ? 'Unlimited' : option.listingsRemaining}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Used</p>
                      <p className="mt-1 text-sm text-slate-900">{option.listingsUsed}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Boosts</p>
                      <p className="mt-1 text-sm text-slate-900">{option.boostsRemaining}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] font-normal text-slate-500">
                    This plan will be attached to the listing so the backend can validate quota.
                  </p>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:col-span-2">
              No active subscription with listing slots is available right now.
            </div>
          )}
        </div>

        {starterCredits?.isActive ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-normal text-emerald-800">
            Starter credits are available as a fallback: {starterCredits.listingsRemaining} listings
            and {starterCredits.boostsRemaining} boosts remaining.
          </div>
        ) : null}
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-500">
              <Star className="fill-amber-400" size={19} />
            </span>
            <div>
              <h2 className="text-sm font-normal font-inter text-slate-900">Subscription Status</h2>
              <p className="text-sm font-normal text-slate-800">{subscriptionStatusLabel}</p>
              <p className="text-xs font-normal text-slate-500">{subscriptionStatusHint}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/subscriptions')}
            className="h-9 rounded-full bg-amber-400 px-4 text-xs font-normal text-white"
          >
            View Plans
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-normal text-slate-900">{listingsLeftText}</p>
            <p className="text-xs font-normal text-slate-500">Listings Left</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-normal text-slate-900">{boostsLeftText}</p>
            <p className="text-xs font-normal text-slate-500">Boosts Left</p>
          </div>
        </div>
        <p className="mt-4 text-xs font-normal text-slate-500">
          Upgrade anytime to higher limits and premium boosts.
        </p>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-4 text-sm font-normal text-slate-800">Posting as</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eaf4ff] text-[#1f63b2]">
              <Package size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-normal text-slate-900">
                {storedUser?.name || 'NearHub User'}
              </p>
              <p className="text-xs font-normal text-slate-500">{userPhone || userId}</p>
            </div>
          </div>
          <CheckCircle2 className="shrink-0 text-emerald-500" size={23} />
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm font-normal text-slate-800">Ready to publish?</p>
          <span className="rounded-full bg-[#2368c9] px-3 py-1 text-xs font-normal text-white">
            {completionCount}/10
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-normal text-amber-700 sm:text-sm">
          <AlertTriangle size={17} /> Your listing will appear after admin verification.
        </div>
      </section>
    </>
  );

  const renderImagePreview = () =>
    images.length ? (
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {images.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
          >
            <img
              src={image}
              alt={`Uploaded ${index + 1}`}
              className="h-full w-full object-cover object-center"
            />
            {mode === 'deal' ? (
              <span className="absolute left-2 top-2 rounded-md bg-[#1f63b2] px-2 py-1 text-[10px] font-normal uppercase text-white shadow-sm">
                {dealTypeLabel}
              </span>
            ) : null}
            {mode !== 'deal' && !sourceListingId ? (
              <button
                type="button"
                onClick={() =>
                  setImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                }
                className="absolute right-1 top-1 h-7 w-7 rounded-full bg-white/95 text-xs font-normal text-rose-600 shadow"
                aria-label="Remove image"
                title="Remove image"
              >
                X
              </button>
            ) : null}
          </div>
        ))}
      </div>
    ) : null;

  const renderVideoPreview = () =>
    videos.length ? (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {videos.map((video, index) => (
          <div
            key={`${video}-${index}`}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950"
          >
            <video
              src={video}
              className="aspect-video w-full bg-black object-contain"
              controls
              preload="metadata"
            />
            <button
              type="button"
              onClick={() =>
                setVideos((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
              }
              className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/95 text-xs font-normal text-rose-600 shadow"
              aria-label="Remove video"
            >
              X
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const renderCameraModal = () =>
    cameraMode ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
        <div className="w-full max-w-3xl rounded-[24px] border border-slate-700 bg-slate-950 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-normal text-white">
              {cameraMode === 'photo'
                ? 'Camera'
                : isRecordingVideo
                  ? 'Recording...'
                  : 'Record Video'}
            </p>
            <button
              type="button"
              onClick={closeCamera}
              className="h-9 rounded-full bg-white px-4 text-xs font-normal text-slate-900"
            >
              Close
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl bg-black">
            <video
              ref={cameraPreviewRef}
              autoPlay
              playsInline
              muted
              className="max-h-[70vh] w-full object-contain"
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {cameraMode === 'photo' ? (
              <button
                type="button"
                onClick={() => void capturePhoto()}
                disabled={isUploadingMedia}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2368c9] text-sm font-normal text-white disabled:opacity-60 sm:col-span-2"
              >
                <Camera size={18} /> {isUploadingMedia ? 'Uploading...' : 'Capture Photo'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
                  disabled={isUploadingMedia}
                  className={classNames(
                    'flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-normal text-white disabled:opacity-60',
                    isRecordingVideo ? 'bg-rose-600' : 'bg-[#2368c9]'
                  )}
                >
                  <Mic size={18} /> {isRecordingVideo ? 'Stop Recording' : 'Start Recording'}
                </button>
                <button
                  type="button"
                  onClick={closeCamera}
                  disabled={isRecordingVideo || isUploadingMedia}
                  className="flex h-12 items-center justify-center rounded-2xl bg-white text-sm font-normal text-slate-900 disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          {message ? (
            <p className="mt-3 text-center text-sm font-normal text-rose-300">{message}</p>
          ) : null}
        </div>
      </div>
    ) : null;

  const renderBuyerOptionsSection = (number: number) => {
    const selectedDurations = emiPlans.map((plan) => plan.durationMonths);
    const availableDurations = EMI_DURATION_OPTIONS.filter(
      (duration) => !selectedDurations.includes(duration)
    );
    const nextDuration = availableDurations[0] ?? EMI_DURATION_OPTIONS[0];

    return (
      <Section
        number={number}
        title="Buyer Options"
        className="shadow-[0_16px_46px_-34px_rgba(15,23,42,0.75)]"
      >
        <label className="flex items-start gap-4 rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5">
          <input
            type="checkbox"
            checked={emiAvailable}
            onChange={(event) => setEmiAvailable(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f63b2]"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-3 text-base font-normal text-slate-900">
              <CreditCard size={17} /> EMI available
            </span>
            <span className="mt-2 block text-sm font-normal text-slate-500">
              Show EMI availability on the listing detail page.
            </span>
          </span>
        </label>

        {emiAvailable ? (
          <div className="mt-5 rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-base font-normal text-slate-900">EMI Details</h3>
            <p className="mt-2 text-sm font-normal text-slate-500">
              Select the EMI duration to automatically show the monthly amount.
            </p>
            <div className="mt-5 grid gap-4">
              {emiPlans.map((plan, index) => (
                <div
                  key={`${plan.durationMonths}-${index}`}
                  className="grid gap-4 md:grid-cols-[1fr_1fr_auto] items-end"
                >
                  <label className="block">
                    <span className="mb-2 block text-sm font-normal text-slate-900">
                      Duration (Months)
                    </span>
                    <select
                      value={plan.durationMonths}
                      onChange={(event) => {
                        const durationMonths = event.target.value;
                        setEmiPlans((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, durationMonths } : item
                          )
                        );
                      }}
                      className={textInputClass('appearance-auto')}
                    >
                      {EMI_DURATION_OPTIONS.map((duration) => (
                        <option
                          key={duration}
                          value={duration}
                          disabled={
                            selectedDurations.includes(duration) && duration !== plan.durationMonths
                          }
                        >
                          {duration} Months
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-normal text-slate-900">
                      Monthly Amount (Rs)
                    </span>
                    <input
                      value={calculateMonthlyEmi(plan.durationMonths)}
                      readOnly
                      placeholder="Enter price first"
                      className={textInputClass('bg-slate-50')}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEmiPlans((items) => items.filter((_, itemIndex) => itemIndex !== index))
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-rose-600 transition hover:bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm font-normal text-slate-500">
              The monthly amount will be shown to buyers on the listing detail page.
            </p>
            <button
              type="button"
              onClick={() =>
                setEmiPlans((items) => [...items, { durationMonths: nextDuration }].slice(0, 4))
              }
              disabled={emiPlans.length >= 4 || availableDurations.length === 0}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#9bbdf2] bg-white px-5 text-sm font-normal text-[#1f63b2] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-xl leading-none">+</span> Add Another EMI Plan
            </button>
          </div>
        ) : null}
        <label className="mt-5 block text-sm font-normal text-slate-900">
          Warranty / Guarantee
        </label>
        <input
          value={warrantyText}
          onChange={(event) => setWarrantyText(event.target.value.slice(0, 160))}
          placeholder="e.g. 6 months seller warranty"
          className={textInputClass('mt-2')}
        />
        <label className="mt-5 block text-sm font-normal text-slate-900">Extra features</label>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={dealFeatureDraft}
            onChange={(event) => setDealFeatureDraft(event.target.value.slice(0, 60))}
            placeholder="e.g. Free delivery, Brand new, Exchange available"
            className={textInputClass()}
          />
          <button
            type="button"
            onClick={() => {
              const next = dealFeatureDraft.trim();
              if (!next) return;
              setDealExtraFeatures((items) => [...items, next].slice(0, 10));
              setDealFeatureDraft('');
            }}
            className="h-10 rounded-xl bg-[#1f63b2] px-6 text-sm font-normal text-white"
          >
            Add
          </button>
        </div>
        {dealExtraFeatures.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {dealExtraFeatures.map((item, index) => (
              <button
                key={`${item}-${index}`}
                type="button"
                onClick={() =>
                  setDealExtraFeatures((items) =>
                    items.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-normal text-[#1f63b2]"
              >
                {item} x
              </button>
            ))}
          </div>
        ) : null}
      </Section>
    );
  };

  const renderListingForm = () => (
    <div className="mx-auto mt-6 max-w-6xl px-4 pb-16 font-normal sm:px-6">
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <StepRail steps={listingSteps} activeStep={listingStep} />
        <div className="space-y-5">
          {listingStep === 1 ? (
            <>
              <Section number={1} title="What are you posting?">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { id: 'sell' as PostIntent, label: 'Sell Product', icon: Tag },
                    { id: 'buy' as PostIntent, label: 'Looking to Buy', icon: ShoppingCart },
                    { id: 'service' as PostIntent, label: 'Offer Service', icon: Wrench },
                    { id: 'job' as PostIntent, label: 'Post Job', icon: Briefcase },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = postIntent === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPostIntent(item.id)}
                        className={classNames(
                          'flex h-10 items-center justify-center gap-2 rounded-2xl border text-xs font-normal transition sm:h-11',
                          active
                            ? 'border-[#1f63b2] bg-[#1f63b2] text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-[#1f63b2]/40'
                        )}
                      >
                        <Icon size={15} /> {item.label}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section number={2} title="Title">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What are you selling?"
                  maxLength={80}
                  className={textInputClass()}
                />
              </Section>

              <Section number={3} title="Category">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-normal text-slate-500">
                      Main Category
                    </span>
                    <select
                      value={mainCategory}
                      onChange={(event) => selectMainCategory(event.target.value)}
                      className={textInputClass('appearance-auto')}
                    >
                      {mainCategoryOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-normal text-slate-500">
                      Subcategory
                    </span>
                    <select
                      value={subCategory}
                      onChange={(event) => setSubCategory(event.target.value)}
                      className={textInputClass('appearance-auto')}
                    >
                      {subCategories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-normal text-amber-800">
                  {shouldRequireCondition
                    ? 'Condition is required for this category. You will need to choose one before publishing.'
                    : 'Condition is optional for this category, but you can still set it if it helps buyers.'}
                </div>

                {mode === 'listing' && attributeDefinitions.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-slate-900">Listing Attributes</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Add extra details for {subCategory || 'this category'}.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {attributeDefinitions.map((attribute) => {
                        const fieldId = `listing-attribute-${attribute.name}`;
                        const value = getAttributeFieldValue(attribute);
                        const normalizedFieldType = attribute.fieldType.trim().toLowerCase();
                        const isBooleanField = normalizedFieldType === 'boolean';
                        const inputMode =
                          normalizedFieldType === 'number' || normalizedFieldType === 'price'
                            ? 'numeric'
                            : 'text';
                        const isChecked = value === true || value === 'true';
                        return (
                          <label key={attribute.name} htmlFor={fieldId} className="block">
                            <span className="mb-2 block text-xs font-normal text-slate-500">
                              {attribute.name}
                              {attribute.required ? ' *' : ''}
                            </span>
                            {isBooleanField ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setAttributeValues((current) => ({
                                    ...current,
                                    [attribute.name]: !(
                                      current[attribute.name] === true ||
                                      current[attribute.name] === 'true'
                                    ),
                                  }))
                                }
                                className={`flex h-10 w-full items-center justify-between rounded-xl border px-4 text-left text-sm transition ${
                                  isChecked
                                    ? 'border-[#1f63b2] bg-[#eef6ff] text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <span>{isChecked ? 'Yes' : 'No'}</span>
                                <span className="text-xs text-slate-400">
                                  {attribute.unit || attribute.fieldType}
                                </span>
                              </button>
                            ) : (
                              <input
                                id={fieldId}
                                value={typeof value === 'boolean' ? String(value) : value}
                                onChange={(event) =>
                                  setAttributeValues((current) => ({
                                    ...current,
                                    [attribute.name]: event.target.value,
                                  }))
                                }
                                inputMode={inputMode}
                                placeholder={attribute.fieldType}
                                className={textInputClass()}
                              />
                            )}
                            {attribute.unit ? (
                              <p className="mt-1 text-xs text-slate-500">Unit: {attribute.unit}</p>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </Section>
            </>
          ) : null}

          {listingStep === 2 ? (
            <>
              <Section number={4} title="Price">
                <div className="relative">
                  <IndianRupee
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    value={price}
                    onChange={(event) => setPrice(sanitizePriceInput(event.target.value))}
                    placeholder="0"
                    inputMode="decimal"
                    className={textInputClass('pl-11')}
                  />
                </div>
                <p className="mb-2 mt-4 text-xs font-normal text-slate-500">Unit:</p>
                <div className="flex flex-wrap gap-2">
                  {priceUnits.map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setPriceUnit(unit)}
                      className={classNames(
                        'h-8 rounded-full border px-4 text-xs font-normal',
                        priceUnit === unit
                          ? 'border-[#1f63b2] bg-[#1f63b2] text-white'
                          : 'border-slate-200 bg-white text-slate-600'
                      )}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-sm font-normal text-slate-700">
                  Offer Price (Optional)
                </label>
                <div className="relative">
                  <IndianRupee
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    value={offerPrice}
                    onChange={(event) => setOfferPrice(sanitizePriceInput(event.target.value))}
                    placeholder="0"
                    inputMode="decimal"
                    className={textInputClass('pl-11')}
                  />
                </div>
              </Section>

              <Section number={5} title="Description">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, 1200))}
                  placeholder="Describe your item... (up to 1200 characters)"
                  rows={6}
                  className={textareaClass()}
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    {['B', 'I', 'U'].map((item) => (
                      <span
                        key={item}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-normal text-slate-500"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs font-normal text-slate-500">
                    {description.length}/1200 characters
                  </p>
                </div>
              </Section>

              {shouldRequireCondition ? (
                <Section number={6} title="Condition (Required)">
                  <p className="mb-3 text-xs font-normal text-slate-500">
                    Pick the closest match before you can submit this listing.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['New', 'Like New', 'Good', 'Fair', 'Poor'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCondition(item)}
                        className={classNames(
                          'h-8 rounded-full border px-4 text-xs font-normal',
                          condition === item
                            ? 'border-[#1f63b2] bg-[#1f63b2] text-white'
                            : 'border-slate-200 bg-white text-slate-600'
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </Section>
              ) : null}
            </>
          ) : null}

          {listingStep === 3 ? (
            <>
              <Section number={7} title="Where do you want to Post?">
                <div className="rounded-2xl border border-[#bcd7f7] bg-[#eaf4ff] p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-center">
                    <div className="relative min-w-0">
                      <MapPin
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1f63b2]"
                        size={18}
                      />
                      <input
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="Enter your location"
                        className={textInputClass('bg-white pl-11')}
                      />
                    </div>
                    <input
                      value={pincode}
                      onChange={(event) =>
                        setPincode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                      }
                      placeholder="Enter pincode"
                      inputMode="numeric"
                      maxLength={6}
                      className={textInputClass('bg-white')}
                    />
                    <button
                      type="button"
                      onClick={() => void resolveCurrentLocation()}
                      className="h-10 rounded-xl bg-white px-4 text-xs font-normal text-slate-700 shadow-sm transition hover:text-[#1f63b2]"
                    >
                      {isResolvingLocation ? 'Finding...' : 'Use Current'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-normal text-slate-500">
                    Pincode helps show your post to nearby users.
                  </p>
                </div>
              </Section>

              {renderBuyerOptionsSection(10)}
            </>
          ) : null}

          {listingStep === 4 ? (
            <>
              <Section number={8} title="Upload Photos">
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#2368c9] text-sm font-normal text-white"
                  >
                    <ImagePlus size={17} /> Gallery
                  </button>
                  <button
                    type="button"
                    onClick={() => void openCamera('photo')}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#2368c9] text-sm font-normal text-white"
                  >
                    <Camera size={17} /> Camera
                  </button>
                </div>
                {renderImagePreview()}
              </Section>

              <Section number={9} title="Add Video">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={handleVideoUpload}
                />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-normal text-slate-500">
                    Showcase your products better with AI generated voiceovers
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void openCamera('video')}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#2368c9] text-sm font-normal text-white"
                  >
                    <Mic size={17} /> Record
                  </button>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#2368c9] text-sm font-normal text-white"
                  >
                    <Video size={17} /> Select
                  </button>
                </div>
                {renderVideoPreview()}
              </Section>
            </>
          ) : null}

          {listingStep === 5 ? <>{renderListingStatusPanels()}</> : null}

          {message ? (
            <p className="text-center text-sm font-normal text-rose-600">{message}</p>
          ) : null}
          {renderWizardNav({
            current: listingStep,
            total: listingSteps.length,
            onBack: () => setListingStep((step) => Math.max(1, step - 1)),
            onNext: () => setListingStep((step) => Math.min(listingSteps.length, step + 1)),
            onSubmit: () => void submitListing(),
            submitLabel: isUploadingMedia
              ? 'Uploading Media...'
              : isSubmitting
                ? 'Posting...'
                : 'Post Listing',
            warningText: listingStep >= 2 ? conditionWarningText : undefined,
          })}
        </div>
      </div>
    </div>
  );

  const renderDealForm = () => (
    <div className="mx-auto mt-8 max-w-6xl px-4 pb-24 font-normal sm:px-6">
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <StepRail steps={dealSteps} activeStep={activeDealStep} />
        <div className="space-y-5">
          <section className="rounded-[22px] border border-[#b7cff5] bg-[#f5f9ff] p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-normal uppercase tracking-[0.16em] text-[#1f63b2]">
                  {sourceListingId ? 'Promote existing listing' : 'Choose listing'}
                </p>
                <h2 className="mt-1 text-lg font-normal text-slate-950">
                  {sourceListingId
                    ? 'Turn your listing into a time-limited offer'
                    : 'Create a deal from an existing listing'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-normal leading-6 text-slate-600">
                  {sourceListingId
                    ? 'Your listing details are inherited. Set only the deal price, timing, stock, and deal behavior.'
                    : 'Deals are created from listings you already posted. Select a listing first, then add the deal settings.'}
                </p>
              </div>
              {sourceListingId ? (
                <button
                  type="button"
                  onClick={() => navigate(`/listing/${encodeURIComponent(sourceListingId)}`)}
                  className="h-10 rounded-xl border border-[#9bbdf2] bg-white px-4 text-xs font-normal text-[#1f63b2]"
                >
                  View Listing
                </button>
              ) : null}
            </div>
          </section>

          {!sourceListingId ? (
            <>
              {dealStep === 1 ? (
                <Section number={1} title="Deal Type *">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        type: 'normal' as const,
                        title: 'Deal',
                        hint: 'Discount one listing for a specific time and quantity.',
                        icon: Percent,
                      },
                      {
                        type: 'combo' as const,
                        title: 'Combo Deal',
                        hint: 'Bundle this listing with add-ons or multiple items.',
                        icon: Tag,
                      },
                    ].map((option) => {
                      const Icon = option.icon;
                      const selected = dealType === option.type;
                      return (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => {
                            setDealType(option.type);
                            setSearchParams({ mode: 'deal', dealType: option.type });
                            setMessage('');
                          }}
                          className={classNames(
                            'flex min-h-[96px] items-start gap-3 rounded-2xl border p-4 text-left transition',
                            selected
                              ? 'border-[#1f63b2] bg-[#eef6ff] shadow-sm'
                              : 'border-slate-200 bg-white hover:border-[#9bbdf2]'
                          )}
                        >
                          <span
                            className={classNames(
                              'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                              selected ? 'bg-[#1f63b2] text-white' : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            <Icon size={18} />
                          </span>
                          <span>
                            <span className="block text-sm font-normal text-slate-950">
                              {option.title}
                            </span>
                            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                              {option.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              ) : null}
              {dealStep === 2 ? (
                <Section number={2} title="Choose a Listing">
                  <p className="text-sm font-normal leading-6 text-slate-500">
                    Deals are created from listings you already posted. Open My Listings and choose
                    the listing you want to promote as a {dealTypeLabel}.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(chooseListingUrl)}
                    className="mt-4 h-10 rounded-xl bg-[#1f63b2] px-5 text-xs font-normal text-white"
                  >
                    Go to My Listings
                  </button>
                </Section>
              ) : null}
              {message ? (
                <p className="text-center text-sm font-normal text-rose-600">{message}</p>
              ) : null}
              {renderWizardNav({
                current: Math.min(dealStep, 2),
                total: 2,
                onBack: () => setDealStep((step) => Math.max(1, step - 1)),
                onNext: () => setDealStep((step) => Math.min(2, step + 1)),
                onSubmit: () => navigate(chooseListingUrl),
                submitLabel: 'Choose Listing',
                warningText: undefined,
              })}
            </>
          ) : (
            <>
              {dealStep === 1 ? (
                <Section number={1} title="Deal Type *">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        type: 'normal' as const,
                        title: 'Deal',
                        hint: 'Discount one listing for a specific time and quantity.',
                        icon: Percent,
                      },
                      {
                        type: 'combo' as const,
                        title: 'Combo Deal',
                        hint: 'Bundle this listing with add-ons or multiple items.',
                        icon: Tag,
                      },
                    ].map((option) => {
                      const Icon = option.icon;
                      const selected = dealType === option.type;
                      return (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => {
                            setDealType(option.type);
                            setMessage('');
                          }}
                          className={classNames(
                            'flex min-h-[96px] items-start gap-3 rounded-2xl border p-4 text-left transition',
                            selected
                              ? 'border-[#1f63b2] bg-[#eef6ff] shadow-sm'
                              : 'border-slate-200 bg-white hover:border-[#9bbdf2]'
                          )}
                        >
                          <span
                            className={classNames(
                              'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                              selected ? 'bg-[#1f63b2] text-white' : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            <Icon size={18} />
                          </span>
                          <span>
                            <span className="block text-sm font-normal text-slate-950">
                              {option.title}
                            </span>
                            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                              {option.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              ) : null}

              {dealStep === 2 ? (
                <>
                  <Section number={2} title="Inherited Listing Media">
                    <p className="mb-4 text-sm font-normal text-slate-500">
                      Deal and combo deal images come from the selected listing. Edit the listing if
                      you want to change its media.
                    </p>
                    <div className="mb-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/my-listings')}
                        className="h-10 rounded-xl bg-[#1f63b2] px-4 text-xs font-normal text-white"
                      >
                        Change Listing
                      </button>
                      <button
                        type="button"
                        onClick={removeSelectedListing}
                        className="h-10 rounded-xl border border-rose-200 bg-white px-4 text-xs font-normal text-rose-600"
                      >
                        Remove Selection
                      </button>
                    </div>
                    {renderImagePreview()}
                  </Section>

                  <Section number={3} title="Listing Details">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['Title', title || 'Selected listing'],
                        [
                          'Category',
                          [mainCategory, subCategory].filter(Boolean).join(' / ') || 'Not set',
                        ],
                        ['Brand', brand || 'Not set'],
                        ['Condition', condition || 'Not set'],
                        ['Location', [location, pincode].filter(Boolean).join(' - ') || 'Not set'],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <p className="text-xs font-normal uppercase tracking-[0.12em] text-slate-400">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-normal text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                </>
              ) : null}

              {dealStep === 3 ? (
                <>
                  <div className="grid gap-5 md:grid-cols-3">
                    <Section number={4} title="Original Price">
                      <div className="relative">
                        <IndianRupee
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          size={16}
                        />
                        <input
                          value={price}
                          onChange={(event) => setPrice(sanitizePriceInput(event.target.value))}
                          readOnly={Boolean(sourceListingId)}
                          placeholder="Enter original price"
                          inputMode="decimal"
                          className={textInputClass(
                            `pl-11 ${sourceListingId ? 'bg-slate-50 text-slate-500' : ''}`
                          )}
                        />
                      </div>
                    </Section>
                    <Section number={5} title="Listing Offer Price">
                      <div className="relative">
                        <IndianRupee
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          size={16}
                        />
                        <input
                          value={listingOfferPrice}
                          onChange={(event) =>
                            setListingOfferPrice(sanitizePriceInput(event.target.value))
                          }
                          readOnly={Boolean(sourceListingId)}
                          placeholder={sourceListingId ? 'No offer price set' : 'Enter offer price'}
                          inputMode="decimal"
                          className={textInputClass(
                            `pl-11 ${sourceListingId ? 'bg-slate-50 text-slate-500' : ''}`
                          )}
                        />
                      </div>
                    </Section>
                    <Section number={6} title="Deal Price *">
                      <div className="relative">
                        <IndianRupee
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          size={16}
                        />
                        <input
                          value={offerPrice}
                          onChange={(event) =>
                            setOfferPrice(sanitizePriceInput(event.target.value))
                          }
                          placeholder="Enter deal price"
                          inputMode="decimal"
                          className={textInputClass('pl-11')}
                        />
                      </div>
                    </Section>
                  </div>

                  <Section number={7} title="Stock Available *">
                    <input
                      value={stock}
                      onChange={(event) => setStock(event.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 10"
                      inputMode="numeric"
                      className={textInputClass()}
                    />
                  </Section>

                  <Section number={8} title="Deal Starts & Ends *">
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-sm font-normal text-slate-500">Start</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={dealStartDate}
                            min={todayDateValue()}
                            onChange={(event) => setDealStartDate(event.target.value)}
                            type="date"
                            className={textInputClass()}
                          />
                          <input
                            value={dealStartTime}
                            onChange={(event) => setDealStartTime(event.target.value)}
                            type="time"
                            className={textInputClass()}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-normal text-slate-500">End</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={dealEndDate}
                            min={dealStartDate || todayDateValue()}
                            onChange={(event) => setDealEndDate(event.target.value)}
                            type="date"
                            className={textInputClass()}
                          />
                          <input
                            value={dealEndTime}
                            onChange={(event) => setDealEndTime(event.target.value)}
                            type="time"
                            className={textInputClass()}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr]">
                      <label className="block">
                        <span className="mb-2 block text-sm font-normal text-slate-600">
                          Repeat
                        </span>
                        <select
                          value={dealRecurrence}
                          onChange={(event) =>
                            setDealRecurrence(event.target.value as DealRecurrence)
                          }
                          className={textInputClass('appearance-auto bg-white')}
                        >
                          <option value="none">Does not repeat</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </label>
                      {dealRecurrence !== 'none' ? (
                        <label className="block">
                          <span className="mb-2 block text-sm font-normal text-slate-600">
                            Repeat until
                          </span>
                          <input
                            value={dealRecurrenceUntil}
                            min={dealEndDate || todayDateValue()}
                            onChange={(event) => setDealRecurrenceUntil(event.target.value)}
                            type="date"
                            className={textInputClass('bg-white')}
                          />
                        </label>
                      ) : null}
                    </div>
                  </Section>
                </>
              ) : null}

              {dealStep === 4 ? (
                <>
                  <Section number={9} title="After Deal Ends">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          value: 'original' as const,
                          label: 'Sell at original price',
                          hint: 'After the timer closes, buyers see the original price.',
                        },
                        {
                          value: 'discount' as const,
                          label: 'Sell at discount price',
                          hint: 'After the timer closes, buyers see your after-deal discount price.',
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPostDealPriceMode(option.value)}
                          className={classNames(
                            'rounded-2xl border p-4 text-left transition',
                            postDealPriceMode === option.value
                              ? 'border-[#1f63b2] bg-[#eef4ff] text-[#123d68]'
                              : 'border-slate-200 bg-white text-slate-700'
                          )}
                        >
                          <span className="block text-sm font-normal">{option.label}</span>
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            {option.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                    {postDealPriceMode === 'discount' ? (
                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-normal text-slate-700">
                          Discount Price <span className="text-rose-600">*</span>
                        </label>
                        <div className="relative">
                          <IndianRupee
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                          />
                          <input
                            value={postDealDiscountPrice}
                            onChange={(event) =>
                              setPostDealDiscountPrice(sanitizePriceInput(event.target.value))
                            }
                            placeholder="Price shown after deal ends"
                            inputMode="decimal"
                            className={textInputClass('pl-11')}
                          />
                        </div>
                        <p className="mt-2 text-xs font-normal text-slate-500">
                          This price appears in all categories only after the deal timer ends.
                        </p>
                      </div>
                    ) : null}
                  </Section>
                </>
              ) : null}

              {message ? (
                <p className="text-center text-sm font-normal text-rose-600">{message}</p>
              ) : null}
              {renderWizardNav({
                current: dealStep,
                total: dealSteps.length,
                onBack: () => setDealStep((step) => Math.max(1, step - 1)),
                onNext: () => setDealStep((step) => Math.min(dealSteps.length, step + 1)),
                onSubmit: () => void submitListing(),
                submitLabel: isUploadingMedia
                  ? 'Uploading Media...'
                  : isSubmitting
                    ? 'Publishing...'
                    : 'Publish Deal',
                warningText: undefined,
              })}
              {dealStep === dealSteps.length ? (
                <p className="text-center text-sm font-normal text-slate-500">
                  Your deal will be live once published
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f8fc] text-slate-900">
      <LandingHeader active="browse" />
      <section className="relative overflow-hidden border-b border-[#d9e8fb] bg-[#eaf4ff] pt-24">
        <div className="mx-auto grid min-h-[180px] max-w-6xl items-center gap-8 px-4 pb-8 sm:px-6 lg:grid-cols-[1fr_280px]">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-normal tracking-tight text-slate-950 sm:text-4xl">
              Post on Marketplace
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-normal leading-6 text-slate-600 sm:text-base lg:mx-0">
              {mode === 'deal'
                ? 'Create a deal for an existing listing in a few simple steps.'
                : 'Create a listing with the details buyers need to trust and contact you.'}
            </p>
          </div>
          <div className="hidden justify-end lg:flex">
            <div className="relative h-28 w-44">
              <div className="absolute right-8 top-0 h-24 w-24 rotate-[-10deg] rounded-[24px] bg-[#2368e8] shadow-[0_22px_44px_-24px_rgba(35,104,232,0.95)]" />
              <div className="absolute right-0 top-5 flex h-24 w-24 rotate-[8deg] items-center justify-center rounded-[22px] bg-[#5fb6ff] text-4xl font-normal text-white shadow-[0_20px_42px_-24px_rgba(35,104,232,0.8)]">
                %
              </div>
              <div className="absolute bottom-0 left-0 rounded-2xl border border-white/70 bg-white px-4 py-2.5 text-xs font-normal text-[#1f63b2] shadow-sm">
                {mode === 'deal' ? 'Deal ready' : 'Listing ready'}
              </div>
            </div>
          </div>
        </div>
      </section>
      {renderModeSwitch()}
      {mode === 'listing' ? renderListingForm() : renderDealForm()}
      {renderCameraModal()}
      <LandingFooter />
    </div>
  );
}
