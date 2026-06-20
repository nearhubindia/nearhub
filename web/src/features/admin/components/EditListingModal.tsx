import { useState } from 'react';
import { FileText, Sparkles, Star, Target, Zap, Check } from 'lucide-react';
import {
  AdminListingBasicFields,
  AdminListingCategoryFields,
  AdminListingLocationFields,
  AdminListingPriceFields,
} from '@/features/admin/components/AdminListingFormFields';
import { AdminDealFields } from '@/features/admin/components/AdminDealFields';
import { AdminListingModalFrame } from '@/features/admin/components/AdminListingModalFrame';
import {
  getDefaultAdminSubCategory,
  getMainCategoryForSubCategory,
} from '@/features/admin/constants/listing-taxonomy';
import type { Listing, Enhancements } from '@/features/admin/types/admin-types';
import { useUpdateListing } from '@/features/admin/hooks';
import {
  useAdminListingCategoryOptions,
  useCoordinateLocationAutofill,
  validateAdminListingDetails,
} from '@/features/admin/hooks/useAdminListingFormHelpers';

interface EditListingModalProps {
  listing: Listing | null;
  onClose: () => void;
}

function toLocalDateTimeValue(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const pad = (num: number): string => String(num).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours()
  )}:${pad(parsed.getMinutes())}`;
}

function toIsoFromLocal(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function parseComboItemsText(value?: string[] | string | null): string {
  if (!value) return '';
  const list = Array.isArray(value)
    ? value
    : String(value)
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter(Boolean);
  return list.join('\n');
}

export default function EditListingModal({ listing, onClose }: EditListingModalProps) {
  const updateListing = useUpdateListing();
  const initialSubCategory =
    listing?.subCategory || listing?.category || getDefaultAdminSubCategory();
  const initialMainCategory =
    listing?.mainCategory || getMainCategoryForSubCategory(initialSubCategory);

  const [formData, setFormData] = useState({
    title: listing?.title ?? '',
    description: listing?.description ?? '',
    price: String(listing?.price ?? ''),
    offerPrice: String(listing?.offerPrice ?? ''),
    mainCategory: initialMainCategory,
    subCategory: initialSubCategory,
    category: initialSubCategory,
    condition: listing?.condition ?? 'good',
    location: listing?.location ?? '',
    pincode: listing?.pincode ? String(listing.pincode) : '',
    latitude:
      listing?.latitude !== null && listing?.latitude !== undefined ? String(listing.latitude) : '',
    longitude:
      listing?.longitude !== null && listing?.longitude !== undefined
        ? String(listing.longitude)
        : '',
    status: listing?.status ?? 'active',
    contactPhone: listing?.contactPhone ?? '',
    isDeal: Boolean(listing?.isDeal),
    dealType: String(listing?.dealType || 'normal'),
    dealStartAt: toLocalDateTimeValue(listing?.dealStartAt),
    dealEndAt: toLocalDateTimeValue(listing?.dealEndAt),
    purchaseLimitType: String(listing?.purchaseLimitType || 'ONE_TIME'),
    maxDealBookings:
      listing?.maxDealBookings !== null && listing?.maxDealBookings !== undefined
        ? String(listing.maxDealBookings)
        : '',
    comboItemsText: parseComboItemsText(listing?.comboItems),
    dealTerms: listing?.dealTerms ?? '',
    voucherEnabled: listing?.voucherEnabled ?? true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [enhancements, setEnhancements] = useState<Enhancements>({
    featured: Boolean(listing?.featured || listing?.enhancements?.featured),
    priority: listing?.enhancements?.priority || false,
    verified: listing?.enhancements?.verified || false,
    topSearch: listing?.enhancements?.topSearch || false,
  });
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [sponsored, setSponsored] = useState(Boolean(listing?.sponsored));
  const {
    mainCategories,
    subCategories,
    showConditionField,
    conditions,
    handleMainCategoryChange,
    handleSubCategoryChange,
  } = useAdminListingCategoryOptions(formData, setFormData);
  const { isResolvingLocation, locationResolveError } = useCoordinateLocationAutofill(
    formData,
    setFormData
  );

  const generateTitleWithAI = async (): Promise<void> => {
    if (!formData.description) {
      alert('Please enter a description first');
      return;
    }

    setIsGeneratingTitle(true);
    // TODO: Implement AI title generation when API is ready
    setTimeout(() => setIsGeneratingTitle(false), 1000);
  };

  const generateDescriptionWithAI = async (): Promise<void> => {
    if (!formData.title) {
      alert('Please enter a title first');
      return;
    }

    setIsGeneratingDescription(true);
    // TODO: Implement AI description generation when API is ready
    setTimeout(() => setIsGeneratingDescription(false), 1000);
  };

  const suggestCategoryWithAI = async (): Promise<void> => {
    if (!formData.title) {
      alert('Please enter a title first');
      return;
    }

    setIsSuggestingCategory(true);
    // TODO: Implement AI category suggestion when API is ready
    setTimeout(() => setIsSuggestingCategory(false), 1000);
  };

  const handleEnhancementChange = (enhancementKey: keyof Enhancements): void => {
    setEnhancements({
      ...enhancements,
      [enhancementKey]: !enhancements[enhancementKey],
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormErrors({});

    if (!listing) {
      setFormErrors({ submit: 'No listing to update' });
      return;
    }

    const validation = validateAdminListingDetails(formData);
    if (!validation.ok) {
      setFormErrors(validation.errors);
      return;
    }

    try {
      const dealStartAt = toIsoFromLocal(formData.dealStartAt);
      const dealEndAt = toIsoFromLocal(formData.dealEndAt);
      const comboItems = formData.comboItemsText
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        mainCategory: formData.mainCategory,
        subCategory: formData.subCategory,
        category: formData.subCategory,
        condition: showConditionField ? formData.condition : 'good',
        location: formData.location,
        status: formData.status as 'active' | 'sold' | 'pending',
        contactPhone: String(formData.contactPhone || '').trim(),
        sponsored,
        ...enhancements,
        isDeal: formData.isDeal,
        dealType: formData.isDeal ? formData.dealType : undefined,
        dealStartAt: formData.isDeal ? dealStartAt : undefined,
        dealEndAt: formData.isDeal ? dealEndAt : undefined,
        purchaseLimitType: formData.isDeal ? formData.purchaseLimitType : undefined,
        maxDealBookings:
          formData.isDeal && formData.maxDealBookings
            ? Number(formData.maxDealBookings)
            : undefined,
        comboItems: formData.isDeal && formData.dealType === 'combo' ? comboItems : undefined,
        dealTerms: formData.isDeal ? formData.dealTerms : undefined,
        voucherEnabled: formData.isDeal ? formData.voucherEnabled : undefined,
      };

      payload.pincode = validation.pincode || null;
      payload.latitude = validation.hasLatitude ? validation.latitude : null;
      payload.longitude = validation.hasLongitude ? validation.longitude : null;

      if (formData.offerPrice && Number(formData.offerPrice) > 0) {
        payload.offerPrice = Number(formData.offerPrice);
      }

      if (formData.isDeal) {
        if (!dealStartAt || !dealEndAt) {
          setFormErrors({
            dealStartAt: 'Deal start and end time are required',
            dealEndAt: 'Deal start and end time are required',
          });
          return;
        }
        if (new Date(dealEndAt).getTime() <= new Date(dealStartAt).getTime()) {
          setFormErrors({
            dealEndAt: 'Deal end time must be after start time',
          });
          return;
        }
      }

      await updateListing.mutateAsync({
        id: listing.id,
        data: payload,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update listing:', error);
      setFormErrors({ submit: 'Failed to update listing. Please try again.' });
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-100';
  const labelClass = 'mb-2 block text-sm font-semibold tracking-wide text-slate-700';

  return (
    <AdminListingModalFrame
      onClose={onClose}
      onSubmit={handleSubmit}
      header={
        <div className="relative overflow-hidden border-b border-cyan-200 bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-6 text-white sm:px-8">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <p className="relative mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            <Sparkles size={14} />
            Listing Editor
          </p>
          <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">
            Edit Listing
          </h2>
          {listing && (
            <p className="relative mt-1 text-sm text-cyan-50/95">
              ID: {listing.id} • {listing.title}
            </p>
          )}
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-5 sm:flex-row sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={updateListing.isPending}
            className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateListing.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
          >
            {updateListing.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      {formErrors.submit && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {formErrors.submit}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <FileText size={16} /> Basic Information
        </h3>

        <div className="space-y-4">
          <AdminListingBasicFields
            formData={formData}
            setFormData={setFormData}
            inputClass={inputClass}
            labelClass={labelClass}
            titleAction={
              <button
                type="button"
                onClick={generateTitleWithAI}
                disabled={isGeneratingTitle || !formData.description}
                className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700 transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingTitle ? 'Generating...' : 'AI Generate'}
              </button>
            }
            descriptionAction={
              <button
                type="button"
                onClick={generateDescriptionWithAI}
                disabled={isGeneratingDescription || !formData.title}
                className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700 transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingDescription ? 'Generating...' : 'AI Generate'}
              </button>
            }
          />

          <AdminListingPriceFields
            formData={formData}
            setFormData={setFormData}
            inputClass={inputClass}
            labelClass={labelClass}
          />

          <AdminListingCategoryFields
            formData={formData}
            setFormData={setFormData}
            inputClass={inputClass}
            labelClass={labelClass}
            mainCategories={mainCategories}
            subCategories={subCategories}
            conditions={conditions}
            showConditionField={showConditionField}
            handleMainCategoryChange={handleMainCategoryChange}
            handleSubCategoryChange={handleSubCategoryChange}
            aiSuggestButton={
              <button
                type="button"
                onClick={suggestCategoryWithAI}
                disabled={isSuggestingCategory || !formData.title}
                className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700 transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSuggestingCategory ? 'Suggesting...' : 'AI Suggest'}
              </button>
            }
          />

          <AdminListingLocationFields
            formData={formData}
            setFormData={setFormData}
            inputClass={inputClass}
            labelClass={labelClass}
            formErrors={formErrors}
            isResolvingLocation={isResolvingLocation}
            locationResolveError={locationResolveError}
            statusField={
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'active' | 'sold' | 'pending',
                    })
                  }
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
            }
          />
        </div>
      </div>

      <AdminDealFields
        formData={formData}
        setFormData={setFormData}
        inputClass={inputClass}
        labelClass={labelClass}
        formErrors={formErrors}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Sparkles size={16} /> Enhancement Features
        </h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <input
              type="checkbox"
              checked={sponsored}
              onChange={() => setSponsored((prev) => !prev)}
              className="h-5 w-5 rounded"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Star size={18} className="text-amber-500" />
                Sponsored Tag
              </div>
              <p className="mt-1 text-xs text-slate-600">Separate from featured boost ranking</p>
            </div>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <input
              type="checkbox"
              checked={enhancements.featured}
              onChange={() => handleEnhancementChange('featured')}
              className="h-5 w-5 rounded"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Star size={18} className="text-amber-500" />
                Featured Listing
              </div>
              <p className="mt-1 text-xs text-slate-600">Highlight listing with featured ranking</p>
            </div>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <input
              type="checkbox"
              checked={enhancements.priority}
              onChange={() => handleEnhancementChange('priority')}
              className="h-5 w-5 rounded"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Zap size={18} className="text-blue-500" />
                Priority Listing
              </div>
              <p className="mt-1 text-xs text-slate-600">Show higher in search results</p>
            </div>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <input
              type="checkbox"
              checked={enhancements.verified}
              onChange={() => handleEnhancementChange('verified')}
              className="h-5 w-5 rounded"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Check size={18} className="text-green-500" />
                Verified Badge
              </div>
              <p className="mt-1 text-xs text-slate-600">Show verified seller/item badge</p>
            </div>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 md:col-span-2">
            <input
              type="checkbox"
              checked={enhancements.topSearch}
              onChange={() => handleEnhancementChange('topSearch')}
              className="h-5 w-5 rounded"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Target size={18} className="text-red-500" />
                Top Search Placement
              </div>
              <p className="mt-1 text-xs text-slate-600">Appear at top of relevant searches</p>
            </div>
          </label>
        </div>

        {(sponsored || Object.values(enhancements).some((v) => v)) && (
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="mb-2 text-sm font-bold text-teal-900">Active Enhancements:</p>
            <div className="flex flex-wrap gap-2">
              {sponsored && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                  Sponsored
                </span>
              )}
              {enhancements.featured && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                  Featured
                </span>
              )}
              {enhancements.priority && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  Priority
                </span>
              )}
              {enhancements.verified && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                  Verified
                </span>
              )}
              {enhancements.topSearch && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                  Top Search
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminListingModalFrame>
  );
}
