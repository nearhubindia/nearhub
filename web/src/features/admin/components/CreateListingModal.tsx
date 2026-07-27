import { useState } from 'react';
import { FileText, Plus, Sparkles, X } from 'lucide-react';
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
import { useCreateListing } from '@/features/admin/hooks';
import {
  useAdminListingCategoryOptions,
  useCoordinateLocationAutofill,
  validateAdminListingDetails,
} from '@/features/admin/hooks/useAdminListingFormHelpers';
import { uploadListingImages } from '@/features/admin/utils/listing-media-upload';

function toIsoFromLocal(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

interface CreateListingModalProps {
  onClose: () => void;
}

export default function CreateListingModal({ onClose }: CreateListingModalProps) {
  const createListing = useCreateListing();
  const defaultSubCategory = getDefaultAdminSubCategory();
  const defaultMainCategory = getMainCategoryForSubCategory(defaultSubCategory);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    offerPrice: '',
    mainCategory: defaultMainCategory,
    subCategory: defaultSubCategory,
    category: defaultSubCategory,
    condition: 'good',
    location: '',
    pincode: '',
    latitude: '',
    longitude: '',
    contactPhone: '',
    userId: '',
    images: [] as string[],
    videos: [] as string[],
    featured: false,
    isDeal: false,
    dealType: 'normal',
    dealStartAt: '',
    dealEndAt: '',
    dealRecurrence: 'none',
    dealRecurrenceUntil: '',
    purchaseLimitType: 'ONE_TIME',
    maxDealBookings: '',
    comboItemsText: '',
    dealTerms: '',
    voucherEnabled: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const {
    mainCategories,
    subCategories,
    showConditionField,
    conditions,
    handleMainCategoryChange,
    handleSubCategoryChange,
  } = useAdminListingCategoryOptions(formData, setFormData, {
    ensureMainCategoryFallback: true,
  });
  const { isResolvingLocation, locationResolveError } = useCoordinateLocationAutofill(
    formData,
    setFormData
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setMediaError('');
    setIsUploadingMedia(true);
    try {
      const uploadedUrls = await uploadListingImages(files);

      setFormData((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls],
      }));
    } catch (error) {
      console.error('Failed to upload image(s):', error);
      setMediaError(
        error instanceof TypeError
          ? 'Failed to upload image(s): network or CORS issue while uploading to media storage.'
          : 'Failed to upload image(s). Please try again.'
      );
    } finally {
      setIsUploadingMedia(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number): void => {
    const newImages = [...(formData.images || [])];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormErrors({});

    const sellerLookup = formData.userId.trim();
    if (!sellerLookup) {
      setFormErrors({
        userId: 'Seller ID, username, or phone is required',
      });
      return;
    }

    const validation = validateAdminListingDetails(formData);
    if (!validation.ok) {
      setFormErrors(validation.errors);
      return;
    }

    try {
      if (isUploadingMedia) {
        setFormErrors({
          submit: 'Please wait for media upload to finish before creating listing.',
        });
        return;
      }

      const dealStartAt = toIsoFromLocal(formData.dealStartAt);
      const dealEndAt = toIsoFromLocal(formData.dealEndAt);
      const comboItems = formData.comboItemsText
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter(Boolean);

      if (formData.isDeal) {
        if (!dealStartAt || !dealEndAt) {
          setFormErrors({
            dealStartAt: 'Deal start and end time are required',
            dealEndAt: 'Deal start and end time are required',
          });
          return;
        }

        if (new Date(dealEndAt).getTime() <= new Date(dealStartAt).getTime()) {
          setFormErrors({ dealEndAt: 'Deal end time must be after start time' });
          return;
        }

        if (
          formData.dealRecurrence !== 'none' &&
          (!formData.dealRecurrenceUntil ||
            !toIsoFromLocal(formData.dealRecurrenceUntil) ||
            new Date(toIsoFromLocal(formData.dealRecurrenceUntil) as string).getTime() <=
              new Date(dealEndAt).getTime())
        ) {
          setFormErrors({
            dealRecurrenceUntil: 'Repeat until date must be after the first deal window',
          });
          return;
        }
      }

      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        mainCategory: formData.mainCategory,
        subCategory: formData.subCategory,
        category: formData.subCategory,
        condition: showConditionField ? formData.condition : 'good',
        location: formData.location,
        contactPhone: String(formData.contactPhone || '').trim(),
        userId: sellerLookup,
        images: formData.images,
        videos: undefined,
        featured: Boolean(formData.featured),
        listingType: 'image',
        isDeal: formData.isDeal,
      };

      if (validation.pincode) {
        payload.pincode = validation.pincode;
      }
      if (validation.latitude !== null && validation.longitude !== null) {
        payload.latitude = validation.latitude;
        payload.longitude = validation.longitude;
      }

      if (formData.offerPrice && Number(formData.offerPrice) > 0) {
        payload.offerPrice = Number(formData.offerPrice);
      }

      if (formData.isDeal) {
        payload.dealType = formData.dealType;
        payload.dealStartAt = dealStartAt;
        payload.dealEndAt = dealEndAt;
        payload.dealRecurrence = formData.dealRecurrence;
        payload.dealRecurrenceUntil =
          formData.dealRecurrence !== 'none'
            ? toIsoFromLocal(formData.dealRecurrenceUntil)
            : undefined;
        payload.purchaseLimitType = formData.purchaseLimitType;
        payload.maxDealBookings = Number(formData.maxDealBookings || 0);
        payload.comboItems = formData.dealType === 'combo' ? comboItems : [];
        payload.dealTerms = formData.dealTerms;
        payload.voucherEnabled = formData.voucherEnabled;
      }

      await createListing.mutateAsync(payload);
      onClose();
    } catch (error) {
      console.error('Failed to create listing:', error);
      setFormErrors({ submit: 'Failed to create listing. Please try again.' });
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
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <p className="relative mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            <Sparkles size={14} />
            Seller Console
          </p>
          <h2 className="relative flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Plus size={24} />
            Create New Listing
          </h2>
          <p className="relative mt-1 text-sm text-cyan-50/95">
            Fill in the details to create a new listing.
          </p>
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-5 sm:flex-row sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={createListing.isPending}
            className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              createListing.isPending ||
              !formData.title ||
              !formData.price ||
              !formData.location ||
              !formData.userId.trim()
            }
            className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
          >
            {createListing.isPending ? 'Creating...' : 'Create Listing'}
          </button>
        </div>
      }
    >
      {formErrors.submit && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {formErrors.submit}
        </div>
      )}
      {mediaError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          {mediaError}
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
            titleRequired
            titlePlaceholder="Enter listing title"
            descriptionPlaceholder="Enter listing description (optional)"
          />

          <AdminListingPriceFields
            formData={formData}
            setFormData={setFormData}
            inputClass={inputClass}
            labelClass={labelClass}
            required
            showSavings
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
            required
          />

          <AdminListingLocationFields
            formData={formData}
            setFormData={setFormData}
            inputClass={inputClass}
            labelClass={labelClass}
            formErrors={formErrors}
            isResolvingLocation={isResolvingLocation}
            locationResolveError={locationResolveError}
            required
          />

          <AdminDealFields
            formData={formData}
            setFormData={setFormData}
            inputClass={inputClass}
            labelClass={labelClass}
            formErrors={formErrors}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass}>Seller ID / Username / Phone *</label>
              <input
                type="text"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                placeholder="Enter seller id, username, or mobile"
                className={inputClass}
                required
              />
              {formErrors.userId && (
                <p className="mt-1 text-xs font-medium text-rose-600">{formErrors.userId}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                The server resolves this to the actual seller account.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <label className={labelClass}>Images</label>
          <div className="rounded-xl border-2 border-dashed border-slate-300 p-5 transition hover:border-cyan-400 hover:bg-cyan-50/40">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="flex cursor-pointer flex-col items-center justify-center"
            >
              <Plus className="mb-2 text-slate-400" size={30} />
              <p className="text-center text-sm text-slate-600">
                Click to upload images
                <span className="mt-1 block text-xs text-slate-500">
                  Supports: JPG, PNG, WEBP (auto-optimized)
                </span>
              </p>
            </label>
          </div>
          {isUploadingMedia && <p className="mt-2 text-xs text-cyan-700">Uploading media...</p>}

          {formData.images && formData.images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {formData.images.map((img: string, index: number) => (
                <div key={index} className="group relative">
                  <img
                    src={img}
                    alt={`Preview ${index + 1}`}
                    className="h-24 w-full rounded-lg border-2 border-slate-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-1 top-1 rounded-full bg-rose-500 p-1 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
        <p className="text-sm text-cyan-900">
          <strong>Info:</strong> Users need an active subscription or coupon code with free listings
          to create listings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <input
            type="checkbox"
            checked={formData.featured}
            onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
            className="h-4 w-4 accent-blue-600"
          />
          <div>
            <p className="text-sm font-semibold text-blue-900">Featured Listing</p>
            <p className="text-xs text-blue-800">Use featured ranking for homepage and search.</p>
          </div>
        </label>
      </div>
    </AdminListingModalFrame>
  );
}
