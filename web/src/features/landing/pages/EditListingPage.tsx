import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, IndianRupee, MapPin, Save } from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { readStoredWebUser } from '@/lib/web-auth-storage';
import { parseMediaList, parseTextList } from '@/features/landing/lib/listing-parsers';
import {
  ADMIN_CATEGORY_GROUPS,
  getDefaultAdminMainCategory,
  getSubCategoriesForMainCategory,
  shouldRequireConditionForCategory,
} from '@/features/admin/constants/listing-taxonomy';

type StoredUser = { id?: string; phone?: string; name?: string };
type PurchaseLimitType = 'ONE_TIME' | 'UNLIMITED' | '';

type ListingPayload = {
  success?: boolean;
  listing?: EditableListing;
  data?: EditableListing;
  error?: string;
  message?: string;
};

type EditableListing = {
  id?: string;
  title?: string;
  description?: string;
  mainCategory?: string;
  main_category?: string;
  subCategory?: string;
  sub_category?: string;
  category?: string;
  condition?: string;
  location?: string;
  address?: string;
  pincode?: string | number;
  pinCode?: string | number;
  postalCode?: string | number;
  price?: string | number;
  offerPrice?: string | number;
  priceUnit?: string;
  images?: string[] | string;
  videos?: string[] | string;
  status?: string;
  contactPhone?: string;
  sellerPhone?: string;
  isDeal?: boolean;
  is_deal?: boolean;
  dealType?: string;
  deal_type?: string;
  purchaseLimitType?: string;
  purchase_limit_type?: string;
  dealStartAt?: string;
  deal_start_at?: string;
  dealEndAt?: string;
  deal_end_at?: string;
  maxDealBookings?: string | number;
  max_deal_bookings?: string | number;
  postDealPriceMode?: string;
  post_deal_price_mode?: string;
  postDealDiscountPrice?: string | number;
  post_deal_discount_price?: string | number;
  emiAvailable?: boolean;
  emi_available?: boolean;
  warrantyText?: string;
  warranty_text?: string;
  dealExtraFeatures?: string[] | string;
  deal_extra_features?: string[] | string;
};

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

function toInputDateTime(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: '', time: '' };
  return {
    date: date.toISOString().slice(0, 10),
    time: date.toTimeString().slice(0, 5),
  };
}

function textInputClass(extra = ''): string {
  return [
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1f63b2] focus:ring-4 focus:ring-[#1f63b2]/10',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

function textareaClass(extra = ''): string {
  return [
    'w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1f63b2] focus:ring-4 focus:ring-[#1f63b2]/10',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

function Section({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-base font-black text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

export default function EditListingPage(): ReactElement {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const storedUser = readStoredWebUser() as StoredUser | null;
  const userId = String(storedUser?.id || '').trim();
  const userPhone = String(storedUser?.phone || '').trim();

  const [isLoading, setIsLoading] = useState(() => Boolean(id && userId));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isDeal, setIsDeal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainCategory, setMainCategory] = useState(defaultMainCategory);
  const [subCategory, setSubCategory] = useState(defaultSubCategory);
  const [price, setPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('per unit');
  const [condition, setCondition] = useState('Good');
  const [location, setLocation] = useState('');
  const [pincode, setPincode] = useState('');
  const [status, setStatus] = useState('active');
  const [contactPhone, setContactPhone] = useState('');
  const [imagesText, setImagesText] = useState('');
  const [videosText, setVideosText] = useState('');
  const [dealType, setDealType] = useState('normal');
  const [purchaseLimitType, setPurchaseLimitType] = useState<PurchaseLimitType>('');
  const [dealEndDate, setDealEndDate] = useState('');
  const [dealEndTime, setDealEndTime] = useState('');
  const [stock, setStock] = useState('');
  const [postDealPriceMode, setPostDealPriceMode] = useState('original');
  const [postDealDiscountPrice, setPostDealDiscountPrice] = useState('');
  const [emiAvailable, setEmiAvailable] = useState(false);
  const [warrantyText, setWarrantyText] = useState('');
  const [extraFeaturesText, setExtraFeaturesText] = useState('');

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', 'x-user-id': userId, 'x-user-phone': userPhone }),
    [userId, userPhone]
  );
  const subCategories = useMemo(
    () => getSubCategoriesForMainCategory(mainCategory),
    [mainCategory]
  );
  const shouldRequireCondition = shouldRequireConditionForCategory(mainCategory, subCategory);

  useEffect(() => {
    if (!id || !userId) return;

    let ignore = false;
    const loadListing = async () => {
      setIsLoading(true);
      setMessage('');
      try {
        const response = await fetch(`${getApiUrl()}/api/listings/${encodeURIComponent(id)}`, {
          headers,
        });
        const payload = (await response.json().catch(() => ({}))) as ListingPayload;
        const listing = payload.listing || payload.data;
        if (!response.ok || !payload.success || !listing) {
          setMessage(payload.error || 'Failed to load listing.');
          return;
        }
        if (ignore) return;

        const nextMain = String(
          listing.mainCategory || listing.main_category || defaultMainCategory
        );
        const nextSub = String(
          listing.subCategory ||
            listing.sub_category ||
            listing.category ||
            getSubCategoriesForMainCategory(nextMain)[0] ||
            defaultSubCategory
        );
        const nextDeal = Boolean(listing.isDeal ?? listing.is_deal);
        const dealEnd = toInputDateTime(String(listing.dealEndAt || listing.deal_end_at || ''));

        setIsDeal(nextDeal);
        setTitle(String(listing.title || ''));
        setDescription(String(listing.description || ''));
        setMainCategory(nextMain);
        setSubCategory(nextSub);
        setPrice(sanitizePriceInput(listing.price));
        setOfferPrice(sanitizePriceInput(listing.offerPrice));
        setPriceUnit(String(listing.priceUnit || 'per unit'));
        setCondition(String(listing.condition || 'Good'));
        setLocation(String(listing.address || listing.location || ''));
        setPincode(
          String(listing.pincode || listing.pinCode || listing.postalCode || '')
            .replace(/[^0-9]/g, '')
            .slice(0, 6)
        );
        setStatus(String(listing.status || 'active'));
        setContactPhone(
          String(listing.contactPhone || listing.sellerPhone || userPhone || '')
            .replace(/[^0-9]/g, '')
            .slice(0, 10)
        );
        setImagesText(parseMediaList(listing.images).join('\n'));
        setVideosText(parseMediaList(listing.videos).join('\n'));
        setDealType(
          String(listing.dealType || listing.deal_type || 'normal').toLowerCase() === 'combo'
            ? 'combo'
            : 'normal'
        );
        const nextPurchaseLimit = String(
          listing.purchaseLimitType || listing.purchase_limit_type || ''
        ).toUpperCase();
        setPurchaseLimitType(
          nextPurchaseLimit === 'ONE_TIME' || nextPurchaseLimit === 'UNLIMITED'
            ? nextPurchaseLimit
            : ''
        );
        setDealEndDate(dealEnd.date);
        setDealEndTime(dealEnd.time);
        setStock(
          String(listing.maxDealBookings ?? listing.max_deal_bookings ?? '').replace(/[^0-9]/g, '')
        );
        setPostDealPriceMode(
          String(listing.postDealPriceMode || listing.post_deal_price_mode || 'original')
        );
        setPostDealDiscountPrice(
          sanitizePriceInput(listing.postDealDiscountPrice ?? listing.post_deal_discount_price)
        );
        setEmiAvailable(Boolean(listing.emiAvailable ?? listing.emi_available));
        setWarrantyText(String(listing.warrantyText || listing.warranty_text || ''));
        setExtraFeaturesText(
          parseTextList(listing.dealExtraFeatures || listing.deal_extra_features).join('\n')
        );
      } catch {
        if (!ignore) setMessage('Failed to load listing.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    void loadListing();
    return () => {
      ignore = true;
    };
  }, [headers, id, userId, userPhone]);

  const selectMainCategory = (value: string) => {
    const nextSubs = getSubCategoriesForMainCategory(value);
    setMainCategory(value);
    setSubCategory(nextSubs[0] || 'Other');
  };

  const saveChanges = async () => {
    if (!id) return;
    if (!title.trim()) {
      setMessage('Please enter title.');
      return;
    }
    if (!subCategory.trim()) {
      setMessage('Please choose a category.');
      return;
    }
    if (!price.trim() || Number(price) <= 0) {
      setMessage('Please enter a valid price.');
      return;
    }
    if (offerPrice && Number(offerPrice) >= Number(price)) {
      setMessage('Offer price must be lower than original price.');
      return;
    }
    if (shouldRequireCondition && !condition.trim()) {
      setMessage('Please select condition.');
      return;
    }
    if (!location.trim()) {
      setMessage('Please enter location.');
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setMessage('Please enter a valid 6-digit pincode.');
      return;
    }
    if (isDeal) {
      if (!offerPrice.trim() || Number(offerPrice) <= 0) {
        setMessage('Please enter deal price.');
        return;
      }
      if (!stock.trim() || Number(stock) <= 0) {
        setMessage('Please enter stock available.');
        return;
      }
      if (!dealEndDate || !dealEndTime) {
        setMessage('Please choose deal end date and time.');
        return;
      }
      if (!purchaseLimitType) {
        setMessage('Please select a purchase limit type.');
        return;
      }
    }

    setIsSaving(true);
    setMessage('');
    try {
      const images = parseMediaList(imagesText);
      const videos = parseMediaList(videosText);
      const dealEndAt =
        isDeal && dealEndDate && dealEndTime
          ? new Date(`${dealEndDate}T${dealEndTime}`).toISOString()
          : undefined;
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        mainCategory: mainCategory.trim(),
        subCategory: subCategory.trim(),
        category: subCategory.trim(),
        price: Number(price),
        offerPrice: offerPrice.trim() ? Number(offerPrice) : undefined,
        priceUnit: isDeal ? undefined : priceUnit,
        condition: shouldRequireCondition ? condition : undefined,
        location: location.trim(),
        pincode: pincode.trim(),
        status,
        contactPhone: contactPhone.trim() || undefined,
        images,
        videos,
        isDeal,
        dealType: isDeal ? dealType : undefined,
        purchaseLimitType: isDeal ? purchaseLimitType : undefined,
        dealEndAt,
        maxDealBookings: isDeal ? Number(stock) : undefined,
        postDealPriceMode: isDeal ? postDealPriceMode : undefined,
        postDealDiscountPrice:
          isDeal && postDealPriceMode === 'discount' && postDealDiscountPrice
            ? Number(postDealDiscountPrice)
            : undefined,
        emiAvailable,
        warrantyText: warrantyText.trim() || undefined,
        dealExtraFeatures: parseTextList(extraFeaturesText),
      };

      const response = await fetch(`${getApiUrl()}/api/listings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as ListingPayload;
      if (!response.ok || !payload.success) {
        setMessage(payload.error || payload.message || 'Failed to save listing.');
        return;
      }
      setMessage('Listing updated successfully.');
      setTimeout(() => navigate('/my-listings'), 700);
    } catch {
      setMessage('Failed to save listing.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!userId) return <Navigate to="/auth/register" replace />;
  if (!id) return <Navigate to="/my-listings" replace />;

  return (
    <div className="min-h-screen bg-[#f4f8fc] text-slate-950">
      <LandingHeader active="browse" />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-24 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#1f63b2]">
              Seller Listing Editor
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Edit Product</h1>
          </div>
          <Link
            to="/my-listings"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-[#1f63b2] shadow-sm"
          >
            <ArrowLeft size={16} /> Back to My Listings
          </Link>
        </div>

        {isLoading ? (
          <p className="rounded-xl bg-white p-5 text-sm font-bold text-slate-600">
            Loading listing...
          </p>
        ) : null}

        {!isLoading ? (
          <div className="space-y-5">
            <Section title="Basic Details">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-black text-slate-700">Title *</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value.slice(0, 120))}
                    className={textInputClass()}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Main Category *
                  </span>
                  <select
                    value={mainCategory}
                    onChange={(event) => selectMainCategory(event.target.value)}
                    className={textInputClass()}
                  >
                    {ADMIN_CATEGORY_GROUPS.map((group) => (
                      <option key={group.mainCategory} value={group.mainCategory}>
                        {group.mainCategory}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Subcategory *
                  </span>
                  <select
                    value={subCategory}
                    onChange={(event) => setSubCategory(event.target.value)}
                    className={textInputClass()}
                  >
                    {subCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                {shouldRequireCondition ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">
                      Condition *
                    </span>
                    <select
                      value={condition}
                      onChange={(event) => setCondition(event.target.value)}
                      className={textInputClass()}
                    >
                      {['New', 'Like New', 'Good', 'Fair', 'Poor'].map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">Status</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={textInputClass()}
                  >
                    {['active', 'pending', 'sold'].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Section>

            <Section title="Price">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Original Price *
                  </span>
                  <span className="relative block">
                    <IndianRupee
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={16}
                    />
                    <input
                      value={price}
                      onChange={(event) => setPrice(sanitizePriceInput(event.target.value))}
                      inputMode="decimal"
                      className={textInputClass('pl-11')}
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    {isDeal ? 'Deal Price *' : 'Offer Price'}
                  </span>
                  <span className="relative block">
                    <IndianRupee
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={16}
                    />
                    <input
                      value={offerPrice}
                      onChange={(event) => setOfferPrice(sanitizePriceInput(event.target.value))}
                      inputMode="decimal"
                      className={textInputClass('pl-11')}
                    />
                  </span>
                </label>
                {!isDeal ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">Price Unit</span>
                    <select
                      value={priceUnit}
                      onChange={(event) => setPriceUnit(event.target.value)}
                      className={textInputClass()}
                    >
                      <option value="per unit">per unit</option>
                      <option value="per piece">per piece</option>
                    </select>
                  </label>
                ) : null}
              </div>
            </Section>

            <Section title="Description">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 1500))}
                rows={7}
                className={textareaClass()}
              />
              <p className="mt-2 text-right text-xs font-semibold text-slate-500">
                {description.length}/1500
              </p>
            </Section>

            <Section title="Location and Contact">
              <div className="grid gap-4 md:grid-cols-[1fr_180px_180px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">Location *</span>
                  <span className="relative block">
                    <MapPin
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={17}
                    />
                    <input
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      className={textInputClass('pl-11')}
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">Pincode *</span>
                  <input
                    value={pincode}
                    onChange={(event) =>
                      setPincode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    inputMode="numeric"
                    className={textInputClass()}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Contact Phone
                  </span>
                  <input
                    value={contactPhone}
                    onChange={(event) =>
                      setContactPhone(event.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                    }
                    inputMode="numeric"
                    className={textInputClass()}
                  />
                </label>
              </div>
            </Section>

            <Section title="Media">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">Image URLs</span>
                  <textarea
                    value={imagesText}
                    onChange={(event) => setImagesText(event.target.value)}
                    rows={6}
                    placeholder="One image URL per line"
                    className={textareaClass()}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">Video URLs</span>
                  <textarea
                    value={videosText}
                    onChange={(event) => setVideosText(event.target.value)}
                    rows={6}
                    placeholder="One video URL per line"
                    className={textareaClass()}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Use the existing uploaded media URLs, one per line.
              </p>
            </Section>

            {isDeal ? (
              <Section title="Deal Details">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">Deal Type</span>
                    <select
                      value={dealType}
                      onChange={(event) => setDealType(event.target.value)}
                      className={textInputClass()}
                    >
                      <option value="normal">Deals</option>
                      <option value="combo">Combo Deal</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">
                      Stock Available *
                    </span>
                    <input
                      value={stock}
                      onChange={(event) => setStock(event.target.value.replace(/[^0-9]/g, ''))}
                      inputMode="numeric"
                      className={textInputClass()}
                    />
                  </label>
                  <div className="md:col-span-2">
                    <span className="mb-2 block text-sm font-black text-slate-700">
                      Purchase Limit Type *
                    </span>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        {
                          value: 'ONE_TIME' as const,
                          label: 'One Time Purchase Per Customer',
                          hint: 'A customer can purchase this deal only once.',
                        },
                        {
                          value: 'UNLIMITED' as const,
                          label: 'Unlimited Purchases Per Customer',
                          hint: 'A customer can purchase this deal multiple times.',
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPurchaseLimitType(option.value)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            purchaseLimitType === option.value
                              ? 'border-[#1f63b2] bg-[#eef4ff] text-[#123d68] ring-4 ring-[#1f63b2]/10'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span className="block text-sm font-black">{option.label}</span>
                          <span className="mt-1 block text-xs font-semibold text-slate-500">
                            {option.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">
                      Deal End Date *
                    </span>
                    <input
                      value={dealEndDate}
                      onChange={(event) => setDealEndDate(event.target.value)}
                      type="date"
                      className={textInputClass()}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">
                      Deal End Time *
                    </span>
                    <input
                      value={dealEndTime}
                      onChange={(event) => setDealEndTime(event.target.value)}
                      type="time"
                      className={textInputClass()}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">
                      After Deal Ends
                    </span>
                    <select
                      value={postDealPriceMode}
                      onChange={(event) => setPostDealPriceMode(event.target.value)}
                      className={textInputClass()}
                    >
                      <option value="original">Sell at original price</option>
                      <option value="discount">Sell at discount price</option>
                    </select>
                  </label>
                  {postDealPriceMode === 'discount' ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700">
                        After-Deal Discount Price
                      </span>
                      <input
                        value={postDealDiscountPrice}
                        onChange={(event) =>
                          setPostDealDiscountPrice(sanitizePriceInput(event.target.value))
                        }
                        inputMode="decimal"
                        className={textInputClass()}
                      />
                    </label>
                  ) : null}
                </div>
              </Section>
            ) : null}

            <Section title="Buyer Options">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-black text-slate-800">
                <input
                  type="checkbox"
                  checked={emiAvailable}
                  onChange={(event) => setEmiAvailable(event.target.checked)}
                  className="h-5 w-5 accent-[#1f63b2]"
                />
                EMI available
              </label>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Warranty / Guarantee
                  </span>
                  <input
                    value={warrantyText}
                    onChange={(event) => setWarrantyText(event.target.value.slice(0, 160))}
                    className={textInputClass()}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Extra Features
                  </span>
                  <textarea
                    value={extraFeaturesText}
                    onChange={(event) => setExtraFeaturesText(event.target.value)}
                    rows={4}
                    placeholder="One feature per line"
                    className={textareaClass()}
                  />
                </label>
              </div>
            </Section>

            {message ? (
              <p
                className={`rounded-xl px-4 py-3 text-sm font-bold ${message.includes('successfully') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
              >
                {message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void saveChanges()}
              disabled={isSaving}
              className="sticky bottom-4 z-10 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1f63b2] text-sm font-black text-white shadow-[0_18px_34px_-20px_rgba(31,99,178,0.85)] disabled:opacity-60"
            >
              <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : null}
      </main>
      <LandingFooter />
    </div>
  );
}
