import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { Category, CATEGORIES, CONDITIONS, PriceUnit, PRICE_UNITS } from '@/lib/types';
import {
  MainCategory,
  getCategoryGroupsForListingType,
  getDefaultCategoryForListingType,
  getDefaultMainCategoryForListingType,
  getMainCategoryForSubcategory,
  shouldRequireConditionForListing,
} from '@/lib/listing-taxonomy';
import UploadProgressBar from '@/shared/components/UploadProgressBar';
import { deleteCloudflareMedia, uploadMediaToCloudflare } from '@/lib/cloudflare-media-upload';
import { VideoRecorderModal } from '@/shared/components/VideoRecorderModal';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { getApiUrl } from '@/lib/query-client';
import {
  isRemoteMediaUrl,
  toPortableImageUri,
  uploadImagesToCloudflare as uploadImagesToCloudflareUtil,
} from '@/lib/media-images';

interface LocationSuggestion {
  pincode: string;
  locationName: string;
  city: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  region: string;
}

interface UploadProgressState {
  uploadId: string;
  chunksUploaded: number;
  totalChunks: number;
  progress: number;
  isComplete: boolean;
}

const LISTING_IMAGE_CROP_ASPECT: [number, number] = [3, 4];

export default function EditListingScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getListingById, updateListing } = useListings();

  const listing = getListingById(id);

  const [title, setTitle] = useState(listing?.title || '');
  const [description, setDescription] = useState(listing?.description || '');
  const [price, setPrice] = useState(listing?.price?.toString() || '');
  const [offerPrice, setOfferPrice] = useState(listing?.offerPrice?.toString() || '');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(listing?.priceUnit || 'per unit');
  const [listingType, setListingType] = useState<'sell' | 'buy' | 'service' | 'job'>(
    listing?.listingType || 'sell'
  );
  const [category, setCategory] = useState<Category>(listing?.category || 'Electronics');
  const [mainCategory, setMainCategory] = useState<MainCategory>(
    getMainCategoryForSubcategory(
      listing?.category || 'Electronics',
      listing?.listingType || 'sell'
    ) || getDefaultMainCategoryForListingType(listing?.listingType || 'sell')
  );
  const [condition, setCondition] = useState<'new' | 'like_new' | 'good' | 'fair' | 'poor'>(
    listing?.condition || 'good'
  );
  const [locationCity, setLocationCity] = useState(listing?.location?.city || '');
  const [latitude, setLatitude] = useState<number>(listing?.location?.latitude || 0);
  const [longitude, setLongitude] = useState<number>(listing?.location?.longitude || 0);
  const [latitudeInput, setLatitudeInput] = useState(
    listing?.location?.latitude ? String(listing.location.latitude) : ''
  );
  const [longitudeInput, setLongitudeInput] = useState(
    listing?.location?.longitude ? String(listing.location.longitude) : ''
  );
  const [pincode, setPincode] = useState(listing?.pincode || '');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [mapsLinkInput, setMapsLinkInput] = useState('');
  const [isResolvingMapsLink, setIsResolvingMapsLink] = useState(false);
  const [pincodeSearchInput, setPincodeSearchInput] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [pincodeSearchError, setPincodeSearchError] = useState<string | null>(null);
  const [isResolvingCoordinates, setIsResolvingCoordinates] = useState(false);
  const [coordinateResolveError, setCoordinateResolveError] = useState<string | null>(null);
  const [coordinateResolveSuccess, setCoordinateResolveSuccess] = useState<string | null>(null);
  const [coordinateResolveTrigger, setCoordinateResolveTrigger] = useState(0);
  const [isResolvingCurrentCoordinates, setIsResolvingCurrentCoordinates] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const coordinateResolveRequestIdRef = useRef(0);
  const [images, setImages] = useState<string[]>(listing?.images || []);
  const [videos, setVideos] = useState<string[]>(listing?.videos || []);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<UploadProgressState | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitStatusMessage, setSubmitStatusMessage] = useState('');
  const [showMainCategoryPicker, setShowMainCategoryPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const [showPriceUnitPicker, setShowPriceUnitPicker] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const categoryGroups = useMemo(() => getCategoryGroupsForListingType(listingType), [listingType]);
  const visibleMainCategories = useMemo(
    () => categoryGroups.map((group) => group.mainCategory),
    [categoryGroups]
  );
  const visibleSubcategories = useMemo(
    () =>
      categoryGroups.find((group) => group.mainCategory === mainCategory)?.subcategories ||
      categoryGroups[0]?.subcategories ||
      [],
    [categoryGroups, mainCategory]
  );
  const showConditionField = shouldRequireConditionForListing({
    listingType,
    mainCategory,
    subCategory: category,
  });

  if (!listing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top || webTopInset }]}>
        <Text style={styles.errorText}>Listing not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const uploadImagesToCloudflare = async (uris: string[]): Promise<string[]> => {
    return uploadImagesToCloudflareUtil(uris, {
      fileNamePrefix: 'listing_edit_image',
    });
  };

  useEffect(() => {
    if (categoryGroups.length === 0) return;

    const inferredMain = getMainCategoryForSubcategory(category, listingType);
    const hasCurrentMain = categoryGroups.some((group) => group.mainCategory === mainCategory);
    const normalizedMain = hasCurrentMain
      ? mainCategory
      : inferredMain || categoryGroups[0].mainCategory;

    if (normalizedMain !== mainCategory) {
      setMainCategory(normalizedMain);
      return;
    }

    const currentGroup =
      categoryGroups.find((group) => group.mainCategory === normalizedMain) || categoryGroups[0];
    const fallbackCategory =
      currentGroup.subcategories[0] || getDefaultCategoryForListingType(listingType);

    if (!currentGroup.subcategories.includes(category) && fallbackCategory !== category) {
      setCategory(fallbackCategory);
    }
  }, [categoryGroups, mainCategory, category, listingType]);

  const applyLocationSuggestion = (suggestion: LocationSuggestion) => {
    const cityName = suggestion.locationName?.trim() || suggestion.city?.trim() || 'Unknown';
    setPincode(suggestion.pincode || '');
    setLocationCity(cityName);
    setLatitude(suggestion.latitude || 0);
    setLongitude(suggestion.longitude || 0);
    setLatitudeInput(String(suggestion.latitude || ''));
    setLongitudeInput(String(suggestion.longitude || ''));
    setPincodeSearchInput('');
    setLocationSuggestions([]);
    setPincodeSearchError(null);
    setCoordinateResolveError(null);
    setCoordinateResolveSuccess(null);
    setShowLocationModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const parseCoordinatesFromMapsLink = (
    input: string
  ): { latitude: number; longitude: number } | null => {
    const raw = input.trim();
    if (!raw) {
      return null;
    }

    const isValidCoordinates = (lat: number, lon: number) =>
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180;

    const buildCoordinates = (latRaw: string, lonRaw: string) => {
      const parsedLatitude = Number.parseFloat(latRaw);
      const parsedLongitude = Number.parseFloat(lonRaw);
      if (!isValidCoordinates(parsedLatitude, parsedLongitude)) {
        return null;
      }
      return {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      };
    };

    const standaloneCoordinateMatch = raw.match(
      /^\s*[\[(]?\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*[\])]?\s*$/
    );
    if (standaloneCoordinateMatch) {
      const built = buildCoordinates(
        standaloneCoordinateMatch[1] ?? '',
        standaloneCoordinateMatch[2] ?? ''
      );
      if (built) return built;
    }

    const extractPlusCodeCandidate = (value: string) => {
      const normalized = value.trim().toUpperCase();
      if (!normalized) {
        return null;
      }

      const match = normalized.match(/([23456789CFGHJMPQRVWX0]{2,8}\+[23456789CFGHJMPQRVWX0]{2,})/);
      return match?.[1] ?? null;
    };

    const isShortPlusCode = (code: string) => {
      const separatorIndex = code.indexOf('+');
      return separatorIndex > 0 && separatorIndex < 8;
    };

    const decodeFullPlusCode = (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,}$/.test(normalized)) {
        return null;
      }

      const alphabet = '23456789CFGHJMPQRVWX';
      const pairResolutions = [20, 1, 0.05, 0.0025, 0.000125];
      const gridRows = 5;
      const gridColumns = 4;
      const gridSize = 0.000125;
      const codeWithoutSeparator = normalized.replace('+', '');
      const pairCodeLength = Math.min(codeWithoutSeparator.length, 10);

      if (pairCodeLength < 2 || pairCodeLength % 2 !== 0) {
        return null;
      }

      let decodedLatitude = -90;
      let decodedLongitude = -180;

      for (let i = 0; i < pairCodeLength; i += 2) {
        const latitudeDigit = alphabet.indexOf(codeWithoutSeparator[i] ?? '');
        const longitudeDigit = alphabet.indexOf(codeWithoutSeparator[i + 1] ?? '');
        if (latitudeDigit < 0 || longitudeDigit < 0) {
          return null;
        }

        const resolution = pairResolutions[i / 2] ?? pairResolutions[pairResolutions.length - 1];
        decodedLatitude += latitudeDigit * resolution;
        decodedLongitude += longitudeDigit * resolution;
      }

      let latitudePlaceValue =
        pairCodeLength < 10 ? (pairResolutions[pairCodeLength / 2 - 1] ?? 20) : gridSize;
      let longitudePlaceValue = latitudePlaceValue;

      for (let i = pairCodeLength; i < codeWithoutSeparator.length; i += 1) {
        const digit = alphabet.indexOf(codeWithoutSeparator[i] ?? '');
        if (digit < 0) {
          return null;
        }

        const row = Math.floor(digit / gridColumns);
        const column = digit % gridColumns;
        latitudePlaceValue /= gridRows;
        longitudePlaceValue /= gridColumns;
        decodedLatitude += row * latitudePlaceValue;
        decodedLongitude += column * longitudePlaceValue;
      }

      const centerLatitude = decodedLatitude + latitudePlaceValue / 2;
      const centerLongitude = decodedLongitude + longitudePlaceValue / 2;
      if (!isValidCoordinates(centerLatitude, centerLongitude)) {
        return null;
      }

      return {
        latitude: centerLatitude,
        longitude: centerLongitude,
      };
    };

    const toDecimal = (degrees: string, minutes: string, seconds: string, direction: string) => {
      const absolute =
        Number.parseFloat(degrees) +
        Number.parseFloat(minutes) / 60 +
        Number.parseFloat(seconds) / 3600;
      return /[SW]/i.test(direction) ? -absolute : absolute;
    };

    const queue: string[] = [raw];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const candidateRaw = queue.shift();
      if (!candidateRaw) continue;
      const candidate = candidateRaw.trim();
      if (!candidate || visited.has(candidate)) continue;
      visited.add(candidate);

      const variants = [candidate];
      let decodeAttempt = candidate;
      for (let i = 0; i < 3; i += 1) {
        try {
          const next = decodeURIComponent(decodeAttempt);
          if (!next || next === decodeAttempt) break;
          variants.push(next);
          decodeAttempt = next;
        } catch {
          break;
        }
      }

      for (const variant of variants) {
        const encodedReverseDataMatch = variant.match(
          /%212d(-?\d+(?:\.\d+)?)%213d(-?\d+(?:\.\d+)?)/i
        );
        if (encodedReverseDataMatch) {
          const built = buildCoordinates(
            encodedReverseDataMatch[2] ?? '',
            encodedReverseDataMatch[1] ?? ''
          );
          if (built) return built;
        }

        const reverseDataMatch = variant.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i);
        if (reverseDataMatch) {
          const built = buildCoordinates(reverseDataMatch[2] ?? '', reverseDataMatch[1] ?? '');
          if (built) return built;
        }

        const simplePatterns = [
          /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
          /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
          /[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i,
          /\/search\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
          /geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
        ];

        for (const pattern of simplePatterns) {
          const match = variant.match(pattern);
          if (!match) continue;
          const built = buildCoordinates(match[1] ?? '', match[2] ?? '');
          if (built) return built;
        }

        const dmsMatch = variant.match(
          /(\d{1,2})°\s*(\d{1,2})[’'′]\s*(\d{1,2}(?:\.\d+)?)[”"″]?\s*([NS]).*?(\d{1,3})°\s*(\d{1,2})[’'′]\s*(\d{1,2}(?:\.\d+)?)[”"″]?\s*([EW])/i
        );
        if (dmsMatch) {
          const latitudeFromDms = toDecimal(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
          const longitudeFromDms = toDecimal(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);
          if (isValidCoordinates(latitudeFromDms, longitudeFromDms)) {
            return {
              latitude: latitudeFromDms,
              longitude: longitudeFromDms,
            };
          }
        }

        const plusCodeCandidate = extractPlusCodeCandidate(variant);
        if (plusCodeCandidate && !isShortPlusCode(plusCodeCandidate)) {
          const decodedPlusCode = decodeFullPlusCode(plusCodeCandidate);
          if (decodedPlusCode) {
            return decodedPlusCode;
          }
        }

        try {
          const normalized = /^https?:\/\//i.test(variant) ? variant : `https://${variant}`;
          const parsedUrl = new URL(normalized);
          const queryCoordinateKeys = ['q', 'query', 'll', 'sll', 'daddr', 'destination', 'center'];
          for (const key of queryCoordinateKeys) {
            const value = parsedUrl.searchParams.get(key);
            if (!value) continue;
            const parts = value.split(',').map((part) => part.trim());
            if (parts.length < 2) continue;
            const built = buildCoordinates(parts[0] ?? '', parts[1] ?? '');
            if (built) return built;
          }

          const nestedLink = parsedUrl.searchParams.get('link');
          if (nestedLink && !visited.has(nestedLink)) {
            queue.push(nestedLink);
          }
        } catch {
          // Ignore invalid URL parsing and continue
        }
      }
    }

    return null;
  };

  const expandGoogleMapsShortLink = async (input: string): Promise<string> => {
    const raw = input.trim();
    if (!raw) {
      return raw;
    }

    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(normalized)) {
      return normalized;
    }

    try {
      const response = await fetch(normalized, { method: 'GET' });
      const redirected = response.url || normalized;

      if (redirected && redirected !== normalized) {
        const redirectedParsed = parseCoordinatesFromMapsLink(redirected);
        if (redirectedParsed) {
          return redirected;
        }
      }

      const html = await response.text();
      const canonicalMatch = html.match(
        /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
      );
      const canonicalUrl = canonicalMatch?.[1]?.trim();
      if (canonicalUrl) {
        const canonicalParsed = parseCoordinatesFromMapsLink(canonicalUrl);
        if (canonicalParsed) {
          return canonicalUrl;
        }
      }

      if (canonicalUrl) {
        return canonicalUrl;
      }

      if (redirected && redirected !== normalized) {
        return redirected;
      }

      return normalized;
    } catch {
      return normalized;
    }
  };

  const extractMapsInputCandidate = (input: string): string => {
    const normalizeToken = (value: string): string =>
      value
        .trim()
        .replace(/^[<([{'"`\s]+/, '')
        .replace(/[>\])}'"`,;!\s]+$/, '');

    const normalizedInput = normalizeToken(input);
    if (!normalizedInput) {
      return '';
    }

    const mapsLinkRegex =
      /(https?:\/\/[^\s<>"']+|(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[^\s<>"']+)/i;
    const directMatch = normalizedInput.match(mapsLinkRegex);
    if (directMatch?.[1]) {
      return normalizeToken(directMatch[1]);
    }

    const lineMatch = normalizedInput
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find((line) => mapsLinkRegex.test(line));
    if (lineMatch) {
      return normalizeToken(lineMatch);
    }

    return normalizedInput;
  };

  const openGoogleMapsPicker = async () => {
    const latitudeCandidate = latitudeInput.trim();
    const longitudeCandidate = longitudeInput.trim();
    const fallbackCoords = latitude && longitude ? `${latitude},${longitude}` : '';
    const query =
      latitudeCandidate && longitudeCandidate
        ? `${latitudeCandidate},${longitudeCandidate}`
        : fallbackCoords;

    const mapsUrl = query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : 'https://www.google.com/maps';

    try {
      await Linking.openURL(mapsUrl);
    } catch {
      Alert.alert(
        'Unable to open Google Maps',
        'Please open Google Maps manually, copy the share link, and paste it here.'
      );
    }
  };

  const applyCurrentCoordinatesFromDevice = async () => {
    if (isResolvingCurrentCoordinates) {
      return;
    }

    setIsResolvingCurrentCoordinates(true);
    setCoordinateResolveError(null);
    setCoordinateResolveSuccess(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCoordinateResolveError(
          'Location permission is required to capture your current coordinates'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });

      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      setLatitude(lat);
      setLongitude(lon);
      setLatitudeInput(String(lat));
      setLongitudeInput(String(lon));
      setCoordinateResolveTrigger((value) => value + 1);
      setCoordinateResolveError(null);
      setCoordinateResolveSuccess('Current coordinates captured.');
      Haptics.selectionAsync();
    } catch (error) {
      console.error('[EditListing] Error capturing current coordinates:', error);
      setCoordinateResolveSuccess(null);
      setCoordinateResolveError('Unable to capture current coordinates. Please try again');
    } finally {
      setIsResolvingCurrentCoordinates(false);
    }
  };

  const applyCoordinatesFromMapsLink = async () => {
    const rawInput = mapsLinkInput.trim();
    if (!rawInput) {
      setCoordinateResolveSuccess(null);
      setCoordinateResolveError('Paste a Google Maps link that contains coordinates');
      return;
    }
    const raw = extractMapsInputCandidate(rawInput);

    setIsResolvingMapsLink(true);
    setCoordinateResolveSuccess(null);
    setCoordinateResolveError(null);

    let parsed: { latitude: number; longitude: number } | null = null;
    let backendErrorCode = '';
    let backendErrorMessage = '';

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/location/parse-maps-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: raw }),
      });

      const responseData = (await response.json()) as {
        success?: boolean;
        code?: string;
        error?: string;
        data?: {
          latitude?: number;
          longitude?: number;
        };
      };

      if (
        response.ok &&
        responseData?.success &&
        Number.isFinite(responseData.data?.latitude) &&
        Number.isFinite(responseData.data?.longitude)
      ) {
        parsed = {
          latitude: Number(responseData.data?.latitude),
          longitude: Number(responseData.data?.longitude),
        };
      } else {
        backendErrorCode = String(responseData?.code || '');
        backendErrorMessage = String(responseData?.error || '');
      }
    } catch (error) {
      console.warn('[EditListing] Backend maps parser failed, trying local fallback:', error);
    }

    // Emergency fallback if backend is temporarily unreachable or returns a non-actionable parse error.
    if (!parsed && backendErrorCode !== 'SHORT_PLUS_CODE_REQUIRES_CONTEXT') {
      let expandedLink = raw;
      parsed = parseCoordinatesFromMapsLink(raw);
      if (!parsed) {
        parsed = parseCoordinatesFromMapsLink(rawInput);
      }
      if (!parsed) {
        expandedLink = await expandGoogleMapsShortLink(raw);
        parsed = parseCoordinatesFromMapsLink(expandedLink);
      }
    }

    if (!parsed) {
      if (backendErrorCode === 'SHORT_PLUS_CODE_REQUIRES_CONTEXT') {
        setCoordinateResolveSuccess(null);
        setCoordinateResolveError(
          backendErrorMessage ||
            'Short Plus Code needs area context. Paste full Plus Code or lat,long like 17.3850,78.4867'
        );
        setIsResolvingMapsLink(false);
        return;
      }

      setCoordinateResolveSuccess(null);
      setCoordinateResolveError(
        backendErrorMessage ||
          'Could not extract coordinates. Paste full Plus Code or pin coordinates like 17.3850,78.4867'
      );
      setIsResolvingMapsLink(false);
      return;
    }

    const requestId = coordinateResolveRequestIdRef.current + 1;
    coordinateResolveRequestIdRef.current = requestId;
    setLatitude(parsed.latitude);
    setLongitude(parsed.longitude);
    setLatitudeInput(String(parsed.latitude));
    setLongitudeInput(String(parsed.longitude));
    // Ensure reverse-geocode runs even if parsed coordinates equal current inputs.
    setCoordinateResolveTrigger((value) => value + 1);
    setCoordinateResolveError(null);
    setCoordinateResolveSuccess('Coordinates captured from Google Maps.');
    setMapsLinkInput('');
    setIsResolvingMapsLink(false);
    Haptics.selectionAsync();
  };

  const getLocationDetailsFromCoordinates = async (
    lat: number,
    lon: number,
    options?: { requestId?: number }
  ): Promise<boolean> => {
    try {
      const requestId = options?.requestId;
      const apiUrl = getApiUrl();
      let resolvedLocation = '';
      let resolvedPincode = '';

      try {
        const reverseResponse = await fetch(
          `${apiUrl}/api/location/reverse-geocode?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}`
        );

        if (reverseResponse.ok) {
          const reverseData = (await reverseResponse.json()) as {
            success?: boolean;
            data?: {
              locationName?: string;
              city?: string;
              state?: string;
              pincode?: string;
            };
          };

          if (reverseData.success && reverseData.data) {
            resolvedLocation = String(
              reverseData.data.locationName || reverseData.data.city || reverseData.data.state || ''
            ).trim();
            resolvedPincode = String(reverseData.data.pincode || '').trim();
          }
        }
      } catch {
        // Fall through to nearby lookup
      }

      if (!resolvedLocation || !resolvedPincode) {
        const nearbyResponse = await fetch(
          `${apiUrl}/api/location/nearby?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&radius=50`
        );

        if (nearbyResponse.ok) {
          const nearbyData = (await nearbyResponse.json()) as Array<{
            locationName?: string;
            city?: string;
            state?: string;
            pincode?: string;
          }>;
          const nearest = Array.isArray(nearbyData) ? nearbyData[0] : null;

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

      if (!resolvedLocation && !resolvedPincode) {
        return false;
      }

      if (requestId && coordinateResolveRequestIdRef.current !== requestId) {
        return false;
      }

      if (resolvedLocation) {
        setLocationCity(resolvedLocation);
      }
      if (resolvedPincode) {
        setPincode(resolvedPincode);
      }
      return true;
    } catch (error) {
      console.error('Error resolving location from coordinates:', error);
      return false;
    }
  };

  useEffect(() => {
    if (!showLocationModal) {
      return;
    }

    const latitudeRaw = latitudeInput.trim();
    const longitudeRaw = longitudeInput.trim();

    if (!latitudeRaw || !longitudeRaw) {
      setIsResolvingCoordinates(false);
      setCoordinateResolveError(null);
      setCoordinateResolveSuccess(null);
      return;
    }

    const parsedLatitude = Number.parseFloat(latitudeRaw);
    const parsedLongitude = Number.parseFloat(longitudeRaw);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      setIsResolvingCoordinates(false);
      setCoordinateResolveSuccess(null);
      setCoordinateResolveError('Latitude and longitude must be valid numbers');
      return;
    }

    if (parsedLatitude < -90 || parsedLatitude > 90) {
      setIsResolvingCoordinates(false);
      setCoordinateResolveSuccess(null);
      setCoordinateResolveError('Latitude must be between -90 and 90');
      return;
    }

    if (parsedLongitude < -180 || parsedLongitude > 180) {
      setIsResolvingCoordinates(false);
      setCoordinateResolveSuccess(null);
      setCoordinateResolveError('Longitude must be between -180 and 180');
      return;
    }

    setLatitude(parsedLatitude);
    setLongitude(parsedLongitude);

    const timeoutId = setTimeout(async () => {
      const requestId = coordinateResolveRequestIdRef.current + 1;
      coordinateResolveRequestIdRef.current = requestId;
      setIsResolvingCoordinates(true);
      setCoordinateResolveError(null);

      const resolved = await getLocationDetailsFromCoordinates(parsedLatitude, parsedLongitude, {
        requestId,
      });
      if (coordinateResolveRequestIdRef.current !== requestId) {
        return;
      }

      if (!resolved) {
        setCoordinateResolveSuccess(null);
        setCoordinateResolveError('Unable to auto-resolve city/pincode for these coordinates');
      }

      setIsResolvingCoordinates(false);
    }, 450);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [latitudeInput, longitudeInput, showLocationModal, coordinateResolveTrigger]);

  useEffect(() => {
    if (!showLocationModal) return;

    let active = true;
    const query = pincodeSearchInput.trim();

    if (!query) {
      setLocationSuggestions([]);
      setPincodeSearchError(null);
      setIsSearchingLocation(false);
      return;
    }

    if (!/^\d+$/.test(query) && query.length < 2) {
      setLocationSuggestions([]);
      setPincodeSearchError(null);
      setIsSearchingLocation(false);
      return;
    }

    if (/^\d+$/.test(query) && query.length < 6) {
      setLocationSuggestions([]);
      setPincodeSearchError(null);
      setIsSearchingLocation(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearchingLocation(true);
      setPincodeSearchError(null);

      try {
        const apiUrl = await getApiUrl();
        if (/^\d{6}$/.test(query)) {
          const response = await fetch(`${apiUrl}/api/location/pincode/${query}`);
          if (!response.ok) {
            if (active) {
              setLocationSuggestions([]);
              setPincodeSearchError('Pincode not found');
            }
            return;
          }

          const responseData = await response.json();
          const location = responseData.data;
          const suggestion: LocationSuggestion | null =
            location && location.latitude !== undefined && location.longitude !== undefined
              ? {
                  pincode: query,
                  locationName:
                    location.locationName || location.city || location.state || 'Unknown',
                  city: location.city || location.state || 'Unknown',
                  state: location.state || '',
                  district: location.district || '',
                  latitude: location.latitude,
                  longitude: location.longitude,
                  region: '',
                }
              : null;

          if (active) {
            setLocationSuggestions(suggestion ? [suggestion] : []);
            if (!suggestion) {
              setPincodeSearchError('Pincode found but coordinates are missing');
            }
          }
          return;
        }

        const response = await fetch(
          `${apiUrl}/api/location/cities/search?q=${encodeURIComponent(query)}&limit=10`
        );

        if (!response.ok) {
          if (active) setLocationSuggestions([]);
          return;
        }

        const responseData = (await response.json()) as {
          success?: boolean;
          data?: LocationSuggestion[];
        };
        const suggestions =
          responseData.success && Array.isArray(responseData.data) ? responseData.data : [];
        if (active) setLocationSuggestions(suggestions);
      } catch (error) {
        console.error('Error searching location:', error);
        if (active) {
          setLocationSuggestions([]);
          setPincodeSearchError(null);
        }
      } finally {
        if (active) setIsSearchingLocation(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [pincodeSearchInput, showLocationModal]);

  const pickImages = async (useCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: LISTING_IMAGE_CROP_ASPECT,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery access is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 0.8,
          selectionLimit: 5 - images.length,
        });
      }

      if (!result.canceled && result.assets) {
        const portableImages = (
          await Promise.all(
            result.assets.map(async (asset) => {
              try {
                return await toPortableImageUri(asset.uri);
              } catch (error) {
                console.error('Error converting selected image:', error);
                return null;
              }
            })
          )
        ).filter(Boolean) as string[];

        if (portableImages.length === 0) {
          Alert.alert('Error', 'Failed to process selected images. Please try again.');
          return;
        }

        setImages([...images, ...portableImages].slice(0, 5));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const uploadPickedVideo = async (videoUri: string) => {
    try {
      setIsUploadingVideo(true);
      setVideoUploadProgress(null);

      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 0,
        quality: 0.7,
      });
      setVideoThumbnail(thumbUri);

      const fileName = `listing_edit_video_${Date.now()}.mp4`;
      setVideoUploadProgress({
        uploadId: fileName,
        chunksUploaded: 0,
        totalChunks: 1,
        progress: 20,
        isComplete: false,
      });
      const uploadResult = await uploadMediaToCloudflare({
        uri: videoUri,
        mediaType: 'video',
        fileName,
      });
      setVideoUploadProgress({
        uploadId: fileName,
        chunksUploaded: 1,
        totalChunks: 1,
        progress: 100,
        isComplete: true,
      });

      setVideos([uploadResult.url]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Video Ready', 'Video uploaded successfully.');
    } catch (error) {
      console.error('Error uploading video:', error);
      Alert.alert('Upload Failed', 'Failed to upload video. Please try again.');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const pickVideo = async (useCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required to record videos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['videos'],
          allowsEditing: true,
          quality: 0.7,
          videoMaxDuration: 35,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery access is required to select videos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          allowsEditing: true,
          quality: 0.7,
          videoMaxDuration: 35,
        });
      }

      if (!result.canceled && result.assets[0]) {
        await uploadPickedVideo(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Video picker error:', error);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const removeImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages(images.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVideos([]);
    setVideoThumbnail(null);
    setVideoUploadProgress(null);
  };

  const handleRecordedVideo = async (uri: string) => {
    setShowRecorder(false);
    await uploadPickedVideo(uri);
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (!price || Number(price) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    if (images.length === 0 && listingType !== 'job') {
      Alert.alert('Error', 'Please add at least one image');
      return;
    }

    if (!locationCity.trim()) {
      Alert.alert('Error', 'Please enter location');
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress(10);
    setSubmitStatusMessage('Preparing your update...');

    try {
      const portableImages = await uploadImagesToCloudflare(images);
      setSubmitProgress(55);
      setSubmitStatusMessage('Uploading media...');

      if (portableImages.length === 0) {
        Alert.alert('Error', 'Images could not be processed. Please re-add images and try again.');
        setIsSubmitting(false);
        setSubmitProgress(0);
        setSubmitStatusMessage('');
        return;
      }

      setSubmitProgress(80);
      setSubmitStatusMessage('Saving changes...');

      await updateListing(id, {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        offerPrice: offerPrice ? Number(offerPrice) : undefined,
        priceUnit,
        listingType,
        mainCategory,
        subCategory: category,
        category,
        ...(showConditionField ? { condition } : {}),
        location: {
          city: locationCity.trim(),
          latitude,
          longitude,
        },
        pincode: pincode.trim() || undefined,
        images: portableImages,
        videos,
      });

      const previousMedia = [...(listing.images || []), ...(listing.videos || [])];
      const currentMedia = new Set([...portableImages, ...videos]);
      const removedRemoteMedia = previousMedia.filter(
        (url) => isRemoteMediaUrl(url) && !currentMedia.has(url)
      );
      if (removedRemoteMedia.length > 0) {
        deleteCloudflareMedia(removedRemoteMedia).catch((cleanupError) => {
          console.warn('[EditListing] Failed to delete old Cloudflare media:', cleanupError);
        });
      }

      setSubmitProgress(100);
      setSubmitStatusMessage('Listing updated successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/my-listings', params: { edited: '1' } });
    } catch (error) {
      console.error('Error updating listing:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update listing. Please try again.');
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
      setSubmitStatusMessage('');
    }
  };

  const normalizedSubmitProgress = Math.max(0, Math.min(100, Math.round(submitProgress)));
  const progressCircleRadius = 82;
  const progressCircleStroke = 14;
  const progressCircleSize = 220;
  const progressCircleCircumference = 2 * Math.PI * progressCircleRadius;
  const progressCircleStrokeOffset =
    progressCircleCircumference * (1 - normalizedSubmitProgress / 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.headerButton}
          hitSlop={8}
        >
          <Feather name="x" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Listing</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        >
          {/* Listing Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Listing Type *</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeButton, listingType === 'sell' && styles.typeButtonActive]}
                onPress={() => setListingType('sell')}
              >
                <Text style={[styles.typeText, listingType === 'sell' && styles.typeTextActive]}>
                  Sell
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeButton, listingType === 'buy' && styles.typeButtonActive]}
                onPress={() => setListingType('buy')}
              >
                <Text style={[styles.typeText, listingType === 'buy' && styles.typeTextActive]}>
                  Buy
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeButton, listingType === 'service' && styles.typeButtonActive]}
                onPress={() => setListingType('service')}
              >
                <Text style={[styles.typeText, listingType === 'service' && styles.typeTextActive]}>
                  Service
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeButton, listingType === 'job' && styles.typeButtonActive]}
                onPress={() => setListingType('job')}
              >
                <Text style={[styles.typeText, listingType === 'job' && styles.typeTextActive]}>
                  Job
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Images Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({images.length}/5)</Text>
            <View style={styles.mediaActionsRow}>
              <Pressable
                style={styles.mediaActionButton}
                onPress={() => pickImages(true)}
                disabled={images.length >= 5}
              >
                <Feather name="camera" size={16} color={Colors.primary} />
                <Text style={styles.mediaActionText}>Camera</Text>
              </Pressable>
              <Pressable
                style={styles.mediaActionButton}
                onPress={() => pickImages(false)}
                disabled={images.length >= 5}
              >
                <Feather name="image" size={16} color={Colors.primary} />
                <Text style={styles.mediaActionText}>Gallery</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageScroll}
            >
              {images.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.image} contentFit="cover" />
                  <Pressable style={styles.removeImageButton} onPress={() => removeImage(index)}>
                    <Feather name="x" size={16} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {images.length < 5 && (
                <Pressable style={styles.addImageButton} onPress={() => pickImages(false)}>
                  <Feather name="plus" size={32} color={Colors.primary} />
                  <Text style={styles.addImageText}>Add Photo</Text>
                </Pressable>
              )}
            </ScrollView>
            {listingType === 'job' && images.length === 0 ? (
              <Text style={styles.helperText}>Photos are optional for job listings.</Text>
            ) : null}
          </View>

          {/* Video Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Video (Optional)</Text>
            <View style={styles.mediaActionsRow}>
              <Pressable style={styles.mediaActionButton} onPress={() => setShowRecorder(true)}>
                <Feather name="video" size={16} color={Colors.primary} />
                <Text style={styles.mediaActionText}>Record</Text>
              </Pressable>
              <Pressable style={styles.mediaActionButton} onPress={() => pickVideo(false)}>
                <Feather name="film" size={16} color={Colors.primary} />
                <Text style={styles.mediaActionText}>Select</Text>
              </Pressable>
            </View>

            {isUploadingVideo && (
              <View style={styles.videoUploadCard}>
                <Text style={styles.helperText}>
                  Uploading video... {videoUploadProgress?.progress || 0}%
                </Text>
                <UploadProgressBar progress={videoUploadProgress?.progress || 0} />
              </View>
            )}

            {videos.length > 0 && (
              <View style={styles.videoCard}>
                <View style={styles.videoPreview}>
                  {videoThumbnail ? (
                    <Image
                      source={{ uri: videoThumbnail }}
                      style={styles.videoThumbImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <Feather name="play-circle" size={28} color={Colors.textSecondary} />
                    </View>
                  )}
                </View>
                <View style={styles.videoMeta}>
                  <Text style={styles.videoMetaTitle}>1 video attached</Text>
                  <Text style={styles.videoMetaUrl} numberOfLines={2}>
                    {videos[0]}
                  </Text>
                </View>
                <Pressable style={styles.removeVideoButton} onPress={removeVideo}>
                  <Feather name="x" size={16} color="#fff" />
                </Pressable>
              </View>
            )}
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter listing title"
              placeholderTextColor={Colors.textTertiary}
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description *</Text>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe your item in detail..."
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Main Category *</Text>
            <Pressable
              style={styles.picker}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowMainCategoryPicker(!showMainCategoryPicker);
              }}
            >
              <Text style={styles.pickerText}>{mainCategory}</Text>
              <Feather name="chevron-down" size={20} color={Colors.textSecondary} />
            </Pressable>
            {showMainCategoryPicker && (
              <View style={styles.pickerOptions}>
                {visibleMainCategories.map((main) => (
                  <Pressable
                    key={main}
                    style={[
                      styles.pickerOption,
                      main === mainCategory && styles.pickerOptionActive,
                    ]}
                    onPress={() => {
                      setMainCategory(main);
                      setShowMainCategoryPicker(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        main === mainCategory && styles.pickerOptionTextActive,
                      ]}
                    >
                      {main}
                    </Text>
                    {main === mainCategory && <Feather name="check" size={20} color="#FFFFFF" />}
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.label}>Category *</Text>
            <Pressable
              style={styles.picker}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCategoryPicker(!showCategoryPicker);
              }}
            >
              <Text style={styles.pickerText}>{category}</Text>
              <Feather name="chevron-down" size={20} color={Colors.textSecondary} />
            </Pressable>
            {showCategoryPicker && (
              <View style={styles.pickerOptions}>
                {visibleSubcategories.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.pickerOption, cat === category && styles.pickerOptionActive]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryPicker(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        cat === category && styles.pickerOptionTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                    {cat === category && <Feather name="check" size={20} color="#FFFFFF" />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {showConditionField && (
            <View style={styles.section}>
              <Text style={styles.label}>Condition *</Text>
              <Pressable
                style={styles.picker}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowConditionPicker(!showConditionPicker);
                }}
              >
                <Text style={styles.pickerText}>
                  {CONDITIONS.find((c) => c.value === condition)?.label || condition}
                </Text>
                <Feather name="chevron-down" size={20} color={Colors.textSecondary} />
              </Pressable>
              {showConditionPicker && (
                <View style={styles.pickerOptions}>
                  {CONDITIONS.map((cond) => (
                    <Pressable
                      key={cond.value}
                      style={[
                        styles.pickerOption,
                        cond.value === condition && styles.pickerOptionActive,
                      ]}
                      onPress={() => {
                        setCondition(cond.value);
                        setShowConditionPicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          cond.value === condition && styles.pickerOptionTextActive,
                        ]}
                      >
                        {cond.label}
                      </Text>
                      {cond.value === condition && (
                        <Feather name="check" size={20} color="#FFFFFF" />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Price */}
          <View style={styles.section}>
            <Text style={styles.label}>Price (₹) *</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.input, styles.priceInput]}
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
              <Pressable
                style={styles.priceUnitButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowPriceUnitPicker(!showPriceUnitPicker);
                }}
              >
                <Text style={styles.priceUnitText}>{priceUnit}</Text>
                <Feather name="chevron-down" size={16} color={Colors.textSecondary} />
              </Pressable>
            </View>
            {showPriceUnitPicker && (
              <View style={styles.pickerOptions}>
                {Object.values(PRICE_UNITS)
                  .flat()
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((unit: PriceUnit) => (
                    <Pressable
                      key={unit}
                      style={[styles.pickerOption, unit === priceUnit && styles.pickerOptionActive]}
                      onPress={() => {
                        setPriceUnit(unit);
                        setShowPriceUnitPicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          unit === priceUnit && styles.pickerOptionTextActive,
                        ]}
                      >
                        {unit}
                      </Text>
                      {unit === priceUnit && <Feather name="check" size={20} color="#FFFFFF" />}
                    </Pressable>
                  ))}
              </View>
            )}
          </View>

          {/* Offer Price (Optional) */}
          <View style={styles.section}>
            <Text style={styles.label}>Offer Price (Optional)</Text>
            <TextInput
              style={styles.input}
              value={offerPrice}
              onChangeText={setOfferPrice}
              placeholder="Discounted price"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Location *</Text>
            <Pressable
              style={styles.locationCard}
              onPress={() => {
                setCoordinateResolveError(null);
                setIsResolvingCoordinates(false);
                setLatitudeInput(latitude ? String(latitude) : '');
                setLongitudeInput(longitude ? String(longitude) : '');
                setShowLocationModal(true);
              }}
            >
              <View style={styles.locationCardMain}>
                <Feather name="map-pin" size={16} color={Colors.primary} />
                <View style={styles.locationCardTextWrap}>
                  <Text style={styles.locationTitleText}>{locationCity || 'Choose location'}</Text>
                  <Text style={styles.locationMetaText}>
                    {pincode ? `Pincode ${pincode}` : 'Search by city or pincode'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Update Listing</Text>
          )}
        </Pressable>
      </View>

      <VideoRecorderModal
        visible={showRecorder}
        onClose={() => setShowRecorder(false)}
        onVideoRecorded={handleRecordedVideo}
        maxDuration={30}
      />

      {isSubmitting && (
        <View style={styles.submitOverlay}>
          <View style={styles.submitOverlayCard}>
            <View style={styles.submitProgressRingWrap}>
              <Svg
                width={progressCircleSize}
                height={progressCircleSize}
                style={styles.submitProgressSvg}
              >
                <Circle
                  cx={progressCircleSize / 2}
                  cy={progressCircleSize / 2}
                  r={progressCircleRadius}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={progressCircleStroke}
                  fill="none"
                />
                <Circle
                  cx={progressCircleSize / 2}
                  cy={progressCircleSize / 2}
                  r={progressCircleRadius}
                  stroke="#38BDF8"
                  strokeWidth={progressCircleStroke}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${progressCircleCircumference} ${progressCircleCircumference}`}
                  strokeDashoffset={progressCircleStrokeOffset}
                />
              </Svg>
              <View style={styles.submitProgressCenter}>
                <Text style={styles.submitProgressText}>{normalizedSubmitProgress}%</Text>
                <Text style={styles.submitProgressSubtext}>Updating</Text>
              </View>
            </View>
            <Text style={styles.submitOverlayMessage}>
              {submitStatusMessage || 'Updating your listing...'}
            </Text>
          </View>
        </View>
      )}

      <Modal
        visible={showLocationModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.locationModalContainer}>
          <View style={styles.locationModalHeader}>
            <Pressable
              style={styles.locationModalClose}
              onPress={() => {
                setShowLocationModal(false);
                setPincodeSearchInput('');
                setLocationSuggestions([]);
                setPincodeSearchError(null);
                setCoordinateResolveError(null);
                setCoordinateResolveSuccess(null);
                setIsResolvingCoordinates(false);
                setIsResolvingMapsLink(false);
              }}
            >
              <Feather name="arrow-left" size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.locationModalTitle}>Select Location</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.locationModalScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingBottom: insets.bottom + 36 }}
          >
            <View style={styles.locationManualCard}>
              <View style={styles.locationManualHeader}>
                <Text style={styles.locationManualTitle}>Coordinates</Text>
                <Pressable
                  style={[
                    styles.locationRefreshButton,
                    isResolvingCurrentCoordinates && styles.locationRefreshButtonDisabled,
                  ]}
                  onPress={applyCurrentCoordinatesFromDevice}
                  disabled={isResolvingCurrentCoordinates}
                >
                  {isResolvingCurrentCoordinates ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Feather name="refresh-cw" size={15} color={Colors.primary} />
                  )}
                </Pressable>
              </View>

              <View style={styles.locationManualRow}>
                <View style={styles.locationManualField}>
                  <Text style={styles.locationManualLabel}>Latitude</Text>
                  <TextInput
                    style={styles.locationManualInput}
                    value={latitudeInput}
                    onChangeText={setLatitudeInput}
                    placeholder="e.g. 17.3850"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.locationManualField}>
                  <Text style={styles.locationManualLabel}>Longitude</Text>
                  <TextInput
                    style={styles.locationManualInput}
                    value={longitudeInput}
                    onChangeText={setLongitudeInput}
                    placeholder="e.g. 78.4867"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <View style={styles.locationManualRow}>
                <View style={styles.locationManualField}>
                  <Text style={styles.locationManualLabel}>Pincode</Text>
                  <TextInput
                    style={styles.locationManualInput}
                    value={pincode}
                    onChangeText={(text) => setPincode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="Auto-filled from coordinates"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <View style={styles.locationManualField}>
                  <Text style={styles.locationManualLabel}>City / Location</Text>
                  <TextInput
                    style={styles.locationManualInput}
                    value={locationCity}
                    onChangeText={setLocationCity}
                    placeholder="Auto-filled from coordinates"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>

              {isResolvingCoordinates ? (
                <Text style={styles.locationResolveHint}>
                  Resolving city and pincode from coordinates...
                </Text>
              ) : null}
              {coordinateResolveError ? (
                <Text style={styles.locationResolveError}>{coordinateResolveError}</Text>
              ) : null}
            </View>

            <View style={styles.mapLinkCard}>
              <Text style={styles.mapLinkTitle}>Google Maps</Text>
              <Pressable style={styles.mapActionButton} onPress={openGoogleMapsPicker}>
                <Feather name="external-link" size={16} color="#FFFFFF" />
                <Text style={styles.mapActionButtonText}>Find in Google Maps</Text>
              </Pressable>
              <TextInput
                style={styles.mapLinkInput}
                value={mapsLinkInput}
                onChangeText={(text) => {
                  setMapsLinkInput(text);
                  setCoordinateResolveSuccess(null);
                }}
                placeholder="Paste Google Maps link with dropped pin"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[
                  styles.mapApplyButton,
                  (mapsLinkInput.trim().length === 0 || isResolvingMapsLink) &&
                    styles.mapApplyButtonDisabled,
                ]}
                onPress={applyCoordinatesFromMapsLink}
                disabled={mapsLinkInput.trim().length === 0 || isResolvingMapsLink}
              >
                <Text style={styles.mapApplyButtonText}>
                  {isResolvingMapsLink ? 'Resolving Link...' : 'Use Link Coordinates'}
                </Text>
              </Pressable>
              {coordinateResolveSuccess ? (
                <Text style={styles.mapResolveSuccess}>{coordinateResolveSuccess}</Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 8,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  typeTextActive: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  imageScroll: {
    flexDirection: 'row',
  },
  mediaActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  mediaActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  mediaActionText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
    marginTop: 4,
  },
  videoUploadCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  videoCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  videoPreview: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  videoThumbImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoMeta: {
    flex: 1,
    paddingRight: 26,
  },
  videoMetaTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 4,
  },
  videoMetaUrl: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  removeVideoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  pickerOptions: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerOptionActive: {
    backgroundColor: Colors.primary,
  },
  pickerOptionText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  pickerOptionTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInput: {
    flex: 1,
  },
  priceUnitButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 140,
    justifyContent: 'space-between',
  },
  priceUnitText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  locationCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 14,
  },
  locationCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationCardTextWrap: {
    flex: 1,
  },
  locationTitleText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  locationMetaText: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  locationModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  locationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  locationModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationModalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  locationModalScroll: {
    flex: 1,
  },
  locationFallbackLabel: {
    marginTop: 12,
    marginHorizontal: 16,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  locationManualCard: {
    marginTop: 10,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 12,
    gap: 10,
  },
  locationManualTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  locationManualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationRefreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRefreshButtonDisabled: {
    opacity: 0.65,
  },
  locationManualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  locationManualField: {
    flex: 1,
    gap: 6,
  },
  locationManualLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  locationManualInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  locationResolveHint: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  locationResolveError: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.error,
  },
  mapResolveSuccess: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.success,
  },
  mapLinkCard: {
    marginTop: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 12,
    gap: 10,
  },
  mapLinkTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  mapActionButton: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapActionButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  mapLinkInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  mapApplyButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapApplyButtonDisabled: {
    opacity: 0.55,
  },
  mapApplyButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  locationSearchWrap: {
    marginTop: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    paddingVertical: 10,
  },
  locationErrorText: {
    marginTop: 8,
    marginHorizontal: 16,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.error,
  },
  locationResultsList: {
    marginTop: 10,
    paddingHorizontal: 16,
  },
  locationStateWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationStateText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  locationResultItem: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationResultTextWrap: {
    flex: 1,
  },
  locationResultTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  locationResultMeta: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1200,
    elevation: 1200,
  },
  submitOverlayCard: {
    width: '86%',
    maxWidth: 360,
    alignItems: 'center',
  },
  submitProgressRingWrap: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitProgressSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  submitProgressCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitProgressText: {
    fontSize: 44,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    lineHeight: 48,
  },
  submitProgressSubtext: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.4,
  },
  submitOverlayMessage: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8FAFC',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignSelf: 'center',
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
