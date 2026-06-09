import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { CircleDollarSign, MapPin, Tag } from 'lucide-react';

type BaseListingForm = {
  title: string;
  description: string;
  price: string;
  offerPrice: string;
  mainCategory: string;
  subCategory: string;
  category: string;
  condition: string;
  location: string;
  pincode: string;
  latitude: string;
  longitude: string;
  contactPhone: string;
};

export function AdminListingBasicFields<TForm extends BaseListingForm>({
  formData,
  setFormData,
  inputClass,
  labelClass,
  titleRequired = false,
  titlePlaceholder,
  descriptionPlaceholder,
  titleAction,
  descriptionAction,
}: {
  formData: TForm;
  setFormData: Dispatch<SetStateAction<TForm>>;
  inputClass: string;
  labelClass: string;
  titleRequired?: boolean;
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  titleAction?: ReactNode;
  descriptionAction?: ReactNode;
}) {
  return (
    <>
      <div>
        {titleAction ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className={labelClass}>Title{titleRequired ? ' *' : ''}</label>
            {titleAction}
          </div>
        ) : (
          <label className={labelClass}>Title{titleRequired ? ' *' : ''}</label>
        )}
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder={titlePlaceholder}
          className={inputClass}
          required={titleRequired}
        />
      </div>

      <div>
        {descriptionAction ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className={labelClass}>Description</label>
            {descriptionAction}
          </div>
        ) : (
          <label className={labelClass}>Description</label>
        )}
        <textarea
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder={descriptionPlaceholder}
          rows={4}
          className={inputClass}
        />
      </div>
    </>
  );
}

export function AdminListingPriceFields<TForm extends BaseListingForm>({
  formData,
  setFormData,
  inputClass,
  labelClass,
  required = false,
  showSavings = false,
}: {
  formData: TForm;
  setFormData: Dispatch<SetStateAction<TForm>>;
  inputClass: string;
  labelClass: string;
  required?: boolean;
  showSavings?: boolean;
}) {
  const price = Number.parseFloat(formData.price || '0');
  const offerPrice = Number.parseFloat(formData.offerPrice || '0');
  const hasOfferPrice = formData.offerPrice && offerPrice > 0;
  const invalidOfferPrice = Boolean(hasOfferPrice && offerPrice >= price);
  const hasSavings = Boolean(showSavings && hasOfferPrice && offerPrice < price);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className={`${labelClass} flex items-center gap-2`}>
          <CircleDollarSign size={14} /> Price{required ? ' (₹) *' : ''}
        </label>
        <input
          type={required ? 'number' : 'text'}
          value={formData.price}
          onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
          placeholder={required ? '0' : undefined}
          min={required ? '0' : undefined}
          className={inputClass}
          required={required}
        />
        {required ? <p className="mt-1 text-xs text-slate-500">Price in INR</p> : null}
      </div>

      <div>
        <label className={`${labelClass} flex items-center gap-2`}>
          <Tag size={14} /> Offer Price{required ? ' (₹)' : ''}
          <span className="text-xs font-normal text-slate-500">Optional</span>
        </label>
        <input
          type={required ? 'number' : 'text'}
          value={formData.offerPrice || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, offerPrice: e.target.value }))}
          placeholder="Discounted price"
          min={required ? '0' : undefined}
          className={inputClass}
        />
        {invalidOfferPrice ? (
          <p className="mt-1 text-xs font-medium text-rose-600">
            Offer price must be less than listed price.
          </p>
        ) : null}
        {hasSavings ? (
          <p className="mt-1 text-xs font-medium text-emerald-600">
            Saving ₹{(price - offerPrice).toLocaleString()}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AdminListingCategoryFields<TForm extends BaseListingForm>({
  formData,
  setFormData,
  inputClass,
  labelClass,
  mainCategories,
  subCategories,
  conditions,
  showConditionField,
  handleMainCategoryChange,
  handleSubCategoryChange,
  required = false,
  aiSuggestButton,
}: {
  formData: TForm;
  setFormData: Dispatch<SetStateAction<TForm>>;
  inputClass: string;
  labelClass: string;
  mainCategories: string[];
  subCategories: string[];
  conditions: string[];
  showConditionField: boolean;
  handleMainCategoryChange: (nextMainCategory: string) => void;
  handleSubCategoryChange: (nextSubCategory: string) => void;
  required?: boolean;
  aiSuggestButton?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        {aiSuggestButton ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className={labelClass}>Main Category</label>
            {aiSuggestButton}
          </div>
        ) : (
          <label className={labelClass}>Main Category{required ? ' *' : ''}</label>
        )}
        <select
          value={formData.mainCategory}
          onChange={(e) => handleMainCategoryChange(e.target.value)}
          className={inputClass}
          required={required}
        >
          {!required ? <option value="">Select Main Category</option> : null}
          {mainCategories.map((main) => (
            <option key={main} value={main}>
              {main}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Subcategory{required ? ' *' : ''}</label>
        <select
          value={formData.subCategory}
          onChange={(e) => handleSubCategoryChange(e.target.value)}
          className={inputClass}
          required={required}
        >
          {subCategories.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>
      </div>

      {showConditionField ? (
        <div>
          <label className={labelClass}>Condition{required ? ' *' : ''}</label>
          <select
            value={formData.condition}
            onChange={(e) => setFormData((prev) => ({ ...prev, condition: e.target.value }))}
            className={inputClass}
            required={required}
          >
            {conditions.map((cond) => (
              <option key={cond} value={cond}>
                {required ? cond.replace('_', ' ').toUpperCase() : cond.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

export function AdminListingLocationFields<TForm extends BaseListingForm>({
  formData,
  setFormData,
  inputClass,
  labelClass,
  formErrors,
  isResolvingLocation,
  locationResolveError,
  required = false,
  statusField,
}: {
  formData: TForm;
  setFormData: Dispatch<SetStateAction<TForm>>;
  inputClass: string;
  labelClass: string;
  formErrors: Record<string, string>;
  isResolvingLocation: boolean;
  locationResolveError: string;
  required?: boolean;
  statusField?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className={`${labelClass} flex items-center gap-2`}>
          <MapPin size={14} /> Location{required ? ' *' : ''}
        </label>
        <input
          type="text"
          value={formData.location}
          onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
          placeholder="City, State"
          className={inputClass}
          required={required}
        />
      </div>

      <div>
        <label className={labelClass}>
          Pincode <span className="text-xs font-normal text-slate-500">Optional</span>
        </label>
        <input
          type="text"
          value={formData.pincode}
          onChange={(e) => setFormData((prev) => ({ ...prev, pincode: e.target.value }))}
          placeholder="6-digit pincode"
          className={inputClass}
          inputMode="numeric"
        />
        {formErrors.pincode ? (
          <p className="mt-1 text-xs font-medium text-rose-600">{formErrors.pincode}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass}>
          Latitude <span className="text-xs font-normal text-slate-500">Optional</span>
        </label>
        <input
          type="text"
          value={formData.latitude}
          onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value }))}
          placeholder="e.g. 17.3850"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          Longitude <span className="text-xs font-normal text-slate-500">Optional</span>
        </label>
        <input
          type="text"
          value={formData.longitude}
          onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value }))}
          placeholder="e.g. 78.4867"
          className={inputClass}
        />
        {formErrors.latitude || formErrors.longitude ? (
          <p className="mt-1 text-xs font-medium text-rose-600">
            {formErrors.latitude || formErrors.longitude}
          </p>
        ) : null}
        {!formErrors.latitude && !formErrors.longitude && isResolvingLocation ? (
          <p className="mt-1 text-xs text-cyan-700">Resolving location from coordinates...</p>
        ) : null}
        {!formErrors.latitude && !formErrors.longitude && locationResolveError ? (
          <p className="mt-1 text-xs text-slate-500">{locationResolveError}</p>
        ) : null}
      </div>

      {statusField}

      <div>
        <label className={labelClass}>
          Contact Number <span className="text-xs font-normal text-slate-500">Optional</span>
        </label>
        <input
          type="tel"
          value={formData.contactPhone}
          onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
          placeholder="e.g. 9876543210"
          className={inputClass}
        />
      </div>
    </div>
  );
}
