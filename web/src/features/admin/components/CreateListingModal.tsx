import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleDollarSign, FileText, MapPin, Plus, Sparkles, Tag, X } from 'lucide-react';
import {
  ADMIN_CATEGORY_GROUPS,
  getDefaultAdminMainCategory,
  getDefaultAdminSubCategory,
  getMainCategoryForSubCategory,
  getSubCategoriesForMainCategory,
} from '@/features/admin/constants/listing-taxonomy';
import { useCreateListing } from '@/features/admin/hooks';
import { validators } from '@/features/admin/utils';
import { getApiUrl } from '@/lib/config';

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
    sponsored: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationResolveError, setLocationResolveError] = useState<string>('');
  const [lastAutoFilledLocation, setLastAutoFilledLocation] = useState('');
  const [lastAutoFilledPincode, setLastAutoFilledPincode] = useState('');
  const resolveRequestIdRef = useRef(0);

  const mainCategories = useMemo(
    () => ADMIN_CATEGORY_GROUPS.map((group) => group.mainCategory),
    []
  );
  const subCategories = useMemo(
    () => getSubCategoriesForMainCategory(formData.mainCategory),
    [formData.mainCategory]
  );
  const conditions = ['new', 'like_new', 'good', 'fair', 'poor'];

  const parseCoordinate = (
    rawValue: string,
    fieldName: 'latitude' | 'longitude',
    min: number,
    max: number
  ): number | null => {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    const numeric = Number.parseFloat(trimmed);
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
      throw new Error(`${fieldName} must be between ${min} and ${max}`);
    }
    return numeric;
  };

  useEffect(() => {
    const latitudeRaw = formData.latitude.trim();
    const longitudeRaw = formData.longitude.trim();

    if (!latitudeRaw || !longitudeRaw) {
      setIsResolvingLocation(false);
      setLocationResolveError('');
      return;
    }

    const latitude = Number.parseFloat(latitudeRaw);
    const longitude = Number.parseFloat(longitudeRaw);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setIsResolvingLocation(false);
      setLocationResolveError('');
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = resolveRequestIdRef.current + 1;
      resolveRequestIdRef.current = requestId;
      setIsResolvingLocation(true);
      setLocationResolveError('');

      try {
        const apiUrl = getApiUrl();
        let resolvedLocation = '';
        let resolvedPincode = '';

        try {
          const reverseResponse = await fetch(
            `${apiUrl}/api/location/reverse-geocode?latitude=${encodeURIComponent(latitudeRaw)}&longitude=${encodeURIComponent(longitudeRaw)}`
          );
          if (!reverseResponse.ok) {
            throw new Error('Reverse geocode failed');
          }

          const reversePayload = (await reverseResponse.json()) as {
            success?: boolean;
            data?: {
              locationName?: string;
              city?: string;
              state?: string;
              pincode?: string;
            };
          };

          if (reversePayload.success && reversePayload.data) {
            resolvedLocation = String(
              reversePayload.data.locationName ||
                reversePayload.data.city ||
                reversePayload.data.state ||
                ''
            ).trim();
            resolvedPincode = String(reversePayload.data.pincode || '').trim();
          }
        } catch {
          // Fall through to nearby lookup
        }

        if (!resolvedLocation || !resolvedPincode) {
          const nearbyResponse = await fetch(
            `${apiUrl}/api/location/nearby?latitude=${encodeURIComponent(latitudeRaw)}&longitude=${encodeURIComponent(longitudeRaw)}&radius=50`
          );
          if (nearbyResponse.ok) {
            const nearbyPayload = (await nearbyResponse.json()) as Array<{
              locationName?: string;
              city?: string;
              state?: string;
              pincode?: string;
            }>;
            const nearest = Array.isArray(nearbyPayload) ? nearbyPayload[0] : null;
            if (nearest) {
              if (!resolvedLocation) {
                resolvedLocation = String(
                  nearest.locationName || nearest.city || nearest.state || ''
                ).trim();
              }
              if (!resolvedPincode) {
                resolvedPincode = String(nearest.pincode || '').trim();
              }
            }
          }
        }

        if (resolveRequestIdRef.current !== requestId) {
          return;
        }

        if (!resolvedLocation && !resolvedPincode) {
          throw new Error('No internal location match found');
        }

        let nextAutoLocation = '';
        let nextAutoPincode = '';

        setFormData((prev) => {
          const next = { ...prev };
          const canAutoReplaceLocation =
            !prev.location.trim() || prev.location.trim() === lastAutoFilledLocation;
          const canAutoReplacePincode =
            !prev.pincode.trim() || prev.pincode.trim() === lastAutoFilledPincode;

          if (resolvedLocation && canAutoReplaceLocation) {
            next.location = resolvedLocation;
            nextAutoLocation = resolvedLocation;
          }
          if (resolvedPincode && canAutoReplacePincode) {
            next.pincode = resolvedPincode;
            nextAutoPincode = resolvedPincode;
          }
          return next;
        });

        if (nextAutoLocation) {
          setLastAutoFilledLocation(nextAutoLocation);
        }
        if (nextAutoPincode) {
          setLastAutoFilledPincode(nextAutoPincode);
        }
      } catch {
        if (resolveRequestIdRef.current === requestId) {
          setLocationResolveError('Unable to auto-resolve location for these coordinates');
        }
      } finally {
        if (resolveRequestIdRef.current === requestId) {
          setIsResolvingLocation(false);
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [formData.latitude, formData.longitude, lastAutoFilledLocation, lastAutoFilledPincode]);

  useEffect(() => {
    if (subCategories.includes(formData.subCategory)) {
      return;
    }

    const fallbackSubCategory = subCategories[0] || getDefaultAdminSubCategory();
    setFormData((prev) => ({
      ...prev,
      subCategory: fallbackSubCategory,
      category: fallbackSubCategory,
      mainCategory: prev.mainCategory || getDefaultAdminMainCategory(),
    }));
  }, [formData.subCategory, subCategories]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData((prev) => ({
          ...prev,
          images: [...(prev.images || []), base64String],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData((prev) => ({
          ...prev,
          videos: [...(prev.videos || []), base64String],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number): void => {
    const newImages = [...(formData.images || [])];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };

  const removeVideo = (index: number): void => {
    const newVideos = [...(formData.videos || [])];
    newVideos.splice(index, 1);
    setFormData({ ...formData, videos: newVideos });
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

    // Validate form
    const errors = validators.validateListingForm({
      title: formData.title,
      description: formData.description,
      price: formData.price,
      location: formData.location,
    });

    if (errors.length > 0) {
      const errorMap = errors.reduce((acc, err) => ({ ...acc, [err.field]: err.message }), {});
      setFormErrors(errorMap);
      return;
    }

    const pincode = formData.pincode.trim();
    if (pincode && !/^\d{6}$/.test(pincode)) {
      setFormErrors({ pincode: 'Pincode must be a 6-digit number' });
      return;
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      latitude = parseCoordinate(formData.latitude, 'latitude', -90, 90);
      longitude = parseCoordinate(formData.longitude, 'longitude', -180, 180);
    } catch (error) {
      setFormErrors({
        latitude:
          error instanceof Error ? error.message : 'Invalid coordinates. Check latitude/longitude.',
      });
      return;
    }

    const hasLatitude = latitude !== null;
    const hasLongitude = longitude !== null;
    if (hasLatitude !== hasLongitude) {
      setFormErrors({
        latitude: 'Both latitude and longitude are required together',
        longitude: 'Both latitude and longitude are required together',
      });
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        mainCategory: formData.mainCategory,
        subCategory: formData.subCategory,
        category: formData.subCategory,
        condition: formData.condition,
        location: formData.location,
        contactPhone: String(formData.contactPhone || '').trim(),
        userId: sellerLookup,
        images: formData.images,
        videos: formData.videos,
        featured: Boolean(formData.featured),
        sponsored: Boolean(formData.sponsored),
        listingType:
          formData.videos.length > 0 && formData.images.length === 0
            ? 'video'
            : formData.videos.length > 0
              ? 'mixed'
              : 'image',
      };

      if (pincode) {
        payload.pincode = pincode;
      }
      if (latitude !== null && longitude !== null) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      if (formData.offerPrice && Number(formData.offerPrice) > 0) {
        payload.offerPrice = Number(formData.offerPrice);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-[0_24px_80px_-24px_rgba(2,6,23,0.65)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 z-20 rounded-full bg-white/90 p-2 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
        >
          <X size={16} />
        </button>

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

        <form onSubmit={handleSubmit}>
          <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6 sm:p-8">
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
                <div>
                  <label className={labelClass}>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter listing title"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter listing description (optional)"
                    rows={4}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className={`${labelClass} flex items-center gap-2`}>
                      <CircleDollarSign size={14} /> Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0"
                      min="0"
                      className={inputClass}
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500">Price in INR</p>
                  </div>

                  <div>
                    <label className={`${labelClass} flex items-center gap-2`}>
                      <Tag size={14} /> Offer Price (₹)
                      <span className="text-xs font-normal text-slate-500">Optional</span>
                    </label>
                    <input
                      type="number"
                      value={formData.offerPrice}
                      onChange={(e) => setFormData({ ...formData, offerPrice: e.target.value })}
                      placeholder="Discounted price"
                      min="0"
                      className={inputClass}
                    />
                    {formData.offerPrice &&
                      parseFloat(formData.offerPrice) > 0 &&
                      parseFloat(formData.offerPrice) >= parseFloat(formData.price || '0') && (
                        <p className="mt-1 text-xs font-medium text-rose-600">
                          Offer price must be less than listed price.
                        </p>
                      )}
                    {formData.offerPrice &&
                      parseFloat(formData.offerPrice) > 0 &&
                      parseFloat(formData.offerPrice) < parseFloat(formData.price || '0') && (
                        <p className="mt-1 text-xs font-medium text-emerald-600">
                          Saving ₹
                          {(
                            parseFloat(formData.price || '0') - parseFloat(formData.offerPrice)
                          ).toLocaleString()}
                        </p>
                      )}
                  </div>

                  <div>
                    <label className={labelClass}>Main Category *</label>
                    <select
                      value={formData.mainCategory}
                      onChange={(e) => {
                        const nextMainCategory = e.target.value;
                        const nextSubCategories = getSubCategoriesForMainCategory(nextMainCategory);
                        const nextSubCategory =
                          nextSubCategories[0] || getDefaultAdminSubCategory();
                        setFormData({
                          ...formData,
                          mainCategory: nextMainCategory,
                          subCategory: nextSubCategory,
                          category: nextSubCategory,
                        });
                      }}
                      className={inputClass}
                      required
                    >
                      {mainCategories.map((main) => (
                        <option key={main} value={main}>
                          {main}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Subcategory *</label>
                    <select
                      value={formData.subCategory}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subCategory: e.target.value,
                          category: e.target.value,
                        })
                      }
                      className={inputClass}
                      required
                    >
                      {subCategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Condition *</label>
                    <select
                      value={formData.condition}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                      className={inputClass}
                      required
                    >
                      {conditions.map((cond) => (
                        <option key={cond} value={cond}>
                          {cond.replace('_', ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className={`${labelClass} flex items-center gap-2`}>
                      <MapPin size={14} /> Location *
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="City, State"
                      className={inputClass}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Pincode <span className="text-xs font-normal text-slate-500">Optional</span>
                    </label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="6-digit pincode"
                      className={inputClass}
                      inputMode="numeric"
                    />
                    {formErrors.pincode && (
                      <p className="mt-1 text-xs font-medium text-rose-600">{formErrors.pincode}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      Latitude <span className="text-xs font-normal text-slate-500">Optional</span>
                    </label>
                    <input
                      type="text"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="e.g. 78.4867"
                      className={inputClass}
                    />
                    {(formErrors.latitude || formErrors.longitude) && (
                      <p className="mt-1 text-xs font-medium text-rose-600">
                        {formErrors.latitude || formErrors.longitude}
                      </p>
                    )}
                    {!formErrors.latitude && !formErrors.longitude && isResolvingLocation && (
                      <p className="mt-1 text-xs text-cyan-700">
                        Resolving location from coordinates...
                      </p>
                    )}
                    {!formErrors.latitude && !formErrors.longitude && locationResolveError && (
                      <p className="mt-1 text-xs text-slate-500">{locationResolveError}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      Contact Number{' '}
                      <span className="text-xs font-normal text-slate-500">Optional</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className={inputClass}
                    />
                  </div>

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
                        Supports: JPG, PNG, GIF
                      </span>
                    </p>
                  </label>
                </div>

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

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <label className={labelClass}>Videos</label>
                <div className="rounded-xl border-2 border-dashed border-slate-300 p-5 transition hover:border-cyan-400 hover:bg-cyan-50/40">
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoUpload}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className="flex cursor-pointer flex-col items-center justify-center"
                  >
                    <Plus className="mb-2 text-slate-400" size={30} />
                    <p className="text-center text-sm text-slate-600">
                      Click to upload videos
                      <span className="mt-1 block text-xs text-slate-500">
                        Supports: MP4, MOV, WEBM
                      </span>
                    </p>
                  </label>
                </div>

                {formData.videos && formData.videos.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {formData.videos.map((video: string, index: number) => (
                      <div key={index} className="group relative">
                        <video
                          src={video}
                          className="h-28 w-full rounded-lg border-2 border-slate-200 bg-slate-100 object-cover"
                          controls
                        />
                        <button
                          type="button"
                          onClick={() => removeVideo(index)}
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
                <strong>Info:</strong> Users need an active subscription or coupon code with free
                listings to create listings.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <input
                  type="checkbox"
                  checked={formData.sponsored}
                  onChange={(e) => setFormData({ ...formData, sponsored: e.target.checked })}
                  className="h-4 w-4 accent-amber-600"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Sponsored Tag</p>
                  <p className="text-xs text-amber-800">Show sponsored label in cards/details.</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="h-4 w-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Featured Listing</p>
                  <p className="text-xs text-blue-800">
                    Use featured ranking separately from sponsored.
                  </p>
                </div>
              </label>
            </div>
          </div>

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
        </form>
      </div>
    </div>
  );
}
