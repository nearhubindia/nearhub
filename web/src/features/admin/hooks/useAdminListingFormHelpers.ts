import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  getDefaultAdminMainCategory,
  getDefaultAdminSubCategory,
  shouldRequireConditionForCategory,
} from '@/features/admin/constants/listing-taxonomy';
import { useListingTaxonomy } from '@/features/admin/hooks/useListingTaxonomy';
import { validators } from '@/features/admin/utils';
import { getApiUrl } from '@/lib/config';

type CategoryForm = {
  mainCategory: string;
  subCategory: string;
  category: string;
};

type LocationForm = {
  latitude: string;
  longitude: string;
  location: string;
  pincode: string;
};

type ListingValidationForm = LocationForm & {
  title: string;
  description: string;
  price: string;
};

type ListingValidationResult =
  | {
      ok: true;
      pincode: string;
      latitude: number | null;
      longitude: number | null;
      hasLatitude: boolean;
      hasLongitude: boolean;
    }
  | {
      ok: false;
      errors: Record<string, string>;
    };

export const ADMIN_LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

export function parseListingCoordinate(
  rawValue: string,
  fieldName: 'latitude' | 'longitude',
  min: number,
  max: number
): number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }
  return numeric;
}

export function validateAdminListingDetails(formData: ListingValidationForm): ListingValidationResult {
  const listingErrors = validators.validateListingForm({
    title: formData.title,
    description: formData.description,
    price: formData.price,
    location: formData.location,
  });

  if (listingErrors.length > 0) {
    return {
      ok: false,
      errors: listingErrors.reduce(
        (acc, err) => ({ ...acc, [err.field]: err.message }),
        {} as Record<string, string>
      ),
    };
  }

  const pincode = formData.pincode.trim();
  if (pincode && !/^\d{6}$/.test(pincode)) {
    return { ok: false, errors: { pincode: 'Pincode must be a 6-digit number' } };
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  try {
    latitude = parseListingCoordinate(formData.latitude, 'latitude', -90, 90);
    longitude = parseListingCoordinate(formData.longitude, 'longitude', -180, 180);
  } catch (error) {
    return {
      ok: false,
      errors: {
        latitude:
          error instanceof Error ? error.message : 'Invalid coordinates. Check latitude/longitude.',
      },
    };
  }

  const hasLatitude = latitude !== null;
  const hasLongitude = longitude !== null;
  if (hasLatitude !== hasLongitude) {
    return {
      ok: false,
      errors: {
        latitude: 'Both latitude and longitude are required together',
        longitude: 'Both latitude and longitude are required together',
      },
    };
  }

  return { ok: true, pincode, latitude, longitude, hasLatitude, hasLongitude };
}

export function useAdminListingCategoryOptions<TForm extends CategoryForm>(
  formData: TForm,
  setFormData: Dispatch<SetStateAction<TForm>>,
  options: { ensureMainCategoryFallback?: boolean } = {}
) {
  const { groups: categoryGroups } = useListingTaxonomy();

  const mainCategories = useMemo(
    () => categoryGroups.map((group) => group.mainCategory),
    [categoryGroups]
  );
  const subCategories = useMemo(
    () =>
      categoryGroups.find((entry) => entry.mainCategory === formData.mainCategory)?.subcategories ||
      categoryGroups[0]?.subcategories ||
      ['Other'],
    [categoryGroups, formData.mainCategory]
  );
  const showConditionField = useMemo(
    () => shouldRequireConditionForCategory(formData.mainCategory, formData.subCategory),
    [formData.mainCategory, formData.subCategory]
  );

  useEffect(() => {
    if (subCategories.includes(formData.subCategory)) {
      return;
    }

    const fallbackSubCategory = subCategories[0] || getDefaultAdminSubCategory();
    setFormData((prev) => ({
      ...prev,
      subCategory: fallbackSubCategory,
      category: fallbackSubCategory,
      ...(options.ensureMainCategoryFallback
        ? { mainCategory: prev.mainCategory || getDefaultAdminMainCategory() }
        : {}),
    }));
  }, [formData.subCategory, options.ensureMainCategoryFallback, setFormData, subCategories]);

  const handleMainCategoryChange = (nextMainCategory: string) => {
    const nextSubCategories =
      categoryGroups.find((entry) => entry.mainCategory === nextMainCategory)?.subcategories || [];
    const nextSubCategory = nextSubCategories[0] || getDefaultAdminSubCategory();
    setFormData((prev) => ({
      ...prev,
      mainCategory: nextMainCategory,
      subCategory: nextSubCategory,
      category: nextSubCategory,
    }));
  };

  const handleSubCategoryChange = (nextSubCategory: string) => {
    setFormData((prev) => ({
      ...prev,
      subCategory: nextSubCategory,
      category: nextSubCategory,
    }));
  };

  return {
    categoryGroups,
    mainCategories,
    subCategories,
    showConditionField,
    conditions: ADMIN_LISTING_CONDITIONS,
    handleMainCategoryChange,
    handleSubCategoryChange,
  };
}

export function useCoordinateLocationAutofill<TForm extends LocationForm>(
  formData: TForm,
  setFormData: Dispatch<SetStateAction<TForm>>
) {
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationResolveError, setLocationResolveError] = useState('');
  const [lastAutoFilledLocation, setLastAutoFilledLocation] = useState('');
  const [lastAutoFilledPincode, setLastAutoFilledPincode] = useState('');
  const resolveRequestIdRef = useRef(0);

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
  }, [formData.latitude, formData.longitude, lastAutoFilledLocation, lastAutoFilledPincode, setFormData]);

  return {
    isResolvingLocation,
    locationResolveError,
  };
}
