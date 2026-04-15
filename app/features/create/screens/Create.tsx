import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  BackHandler,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import UploadProgressBar from '@/shared/components/UploadProgressBar';
import {
  useAuth,
  isProfileComplete,
  getMissingProfileFields,
} from '@/shared/contexts/auth-context';
import { Category, CATEGORIES, CONDITIONS, PriceUnit, PRICE_UNITS, Listing } from '@/lib/types';
import { getApiUrl } from '@/lib/query-client';
import { compressVideoWithProgress } from '@/lib/video-compressor';
import {
  analyzeVideoForS3,
  recommendCompressionForS3,
  compressVideoForS3,
} from '@/lib/video-compressor-s3';
import { uploadMediaToCloudflare } from '@/lib/cloudflare-media-upload';
import {
  toPortableImageUri,
  uploadImagesToCloudflare as uploadImagesToCloudflareUtil,
} from '@/lib/media-images';
import { VideoRecorderModal } from '@/shared/components/VideoRecorderModal';
import { compressImagesWithProgress, QUALITY_PRESETS } from '@/lib/image-compressor';
import * as ImageStorage from '@/lib/image-storage';
import * as ImageHasher from '@/lib/image-hasher';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { createResponsiveStyles } from '@/lib/responsive';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

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

const JOB_CATEGORIES: Category[] = [
  'Jobs',
  'Freelance',
  'Services',
  'Business',
  'Education',
  'Health',
  'Other',
];

const SERVICE_CATEGORIES: Category[] = [
  'Services',
  'Freelance',
  'Home & Garden',
  'Education',
  'Health',
  'Business',
  'Events',
  'Food',
  'Other',
];

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const { addListing } = useListings();
  const { user, isAuthenticated } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('per unit');
  const [category, setCategory] = useState<Category>('Electronics');
  const [condition, setCondition] = useState<'new' | 'like_new' | 'good' | 'fair' | 'poor'>('good');
  const [listingType, setListingType] = useState<'sell' | 'buy' | 'service' | 'job'>('sell');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [images, setImages] = useState<string[]>([]);
  const [imageHashes, setImageHashes] = useState<string[]>([]); // SHA256 hashes for deduplication
  const [imageDeduplicationInfo, setImageDeduplicationInfo] = useState<string | null>(null); // Info about deduplicated images
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0); // 0-100 percentage

  const priceValue = Number(price) || 0;

  // Subscription type
  type SubscriptionData = {
    id: string;
    status: string;
    expiresAt: string;
    subscribedAt: string;
    listingsUsed: number;
    totalListingsCreated: number;
    tier: {
      id: string;
      name: string;
      price: string;
      durationDays: number;
      maxListings: number;
      featuredListingsPerMonth: number;
      features: string[];
    } | null;
  };

  type StarterCreditsSummary = {
    isActive: boolean;
    listingsTotal: number;
    listingsUsed: number;
    listingsRemaining: number;
    boostsTotal: number;
    boostsUsed: number;
    boostsRemaining: number;
  };

  // Active subscription state
  const [allSubscriptions, setAllSubscriptions] = useState<SubscriptionData[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionData | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionData | null>(null); // For backward compatibility
  const [starterCredits, setStarterCredits] = useState<StarterCreditsSummary | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [showSubscriptionSelector, setShowSubscriptionSelector] = useState(false);
  const previousSubscriptionCount = useRef(0);
  const selectedSubscriptionRef = useRef<SubscriptionData | null>(null);
  const isFetchingSubscriptionRef = useRef(false);
  const lastSubscriptionFetchAtRef = useRef(0);
  const SUBSCRIPTION_FETCH_THROTTLE_MS = 2000;
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isCompressingImages, setIsCompressingImages] = useState(false);
  const [imageCompressionProgress, setImageCompressionProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    selectedSubscriptionRef.current = selectedSubscription;
  }, [selectedSubscription]);

  // Location state
  const [pincode, setPincode] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationDistrict, setLocationDistrict] = useState('');
  const [locationState, setLocationState] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
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
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const pincodeInputRef = useRef<TextInput>(null);
  const coordinateResolveRequestIdRef = useRef(0);
  const hasUserManagedLocationRef = useRef(false);
  const lastLocationSourceRef = useRef<{ source: string; priority: number } | null>(null);

  const LOCATION_PRIORITY: Record<string, number> = {
    user: 4,
    suggestion: 4,
    'manual-input': 4,
    'maps-link': 3,
    device: 2,
    auto: 1,
  };

  const setLocationIfAllowed = useCallback(
    (
      source: string,
      lat: number,
      lon: number,
      options?: { setInputs?: boolean; setCity?: boolean; pincode?: string; force?: boolean }
    ) => {
      const newPriority = LOCATION_PRIORITY[source] ?? 0;
      const currentPriority = lastLocationSourceRef.current?.priority ?? 0;
      if (!options?.force && newPriority < currentPriority) {
        return false;
      }

      lastLocationSourceRef.current = { source, priority: newPriority };

      setLatitude(lat);
      setLongitude(lon);
      if (options?.setInputs) {
        setLatitudeInput(String(lat));
        setLongitudeInput(String(lon));
      }
      if (options?.pincode) {
        setPincode(options.pincode);
      }
      if (options?.setCity) {
        setLocationCity((prev) => prev || 'Current Location');
      }

      return true;
    },
    []
  );

  const visibleCategories =
    listingType === 'job'
      ? JOB_CATEGORIES
      : listingType === 'service'
        ? SERVICE_CATEGORIES
        : CATEGORIES;

  const showConditionField = listingType !== 'job';
  const totalSteps = showConditionField ? 9 : 8;
  const completedSteps = [
    Boolean(listingType),
    listingType === 'job' ? true : images.length > 0,
    true, // video is optional
    title.trim().length > 0,
    price.trim().length > 0 && !Number.isNaN(Number(price)),
    Boolean(category),
    Boolean(locationCity || (latitude !== null && longitude !== null)),
    showConditionField ? Boolean(condition) : true,
    description.trim().length > 0,
  ].filter(Boolean).length;
  const completionPercentage = Math.round((completedSteps / totalSteps) * 100);
  const descriptionStepNumber = showConditionField ? 9 : 8;

  const subscriptionStats = useMemo(() => {
    let totalUsed = 0;
    let totalAvailable = 0;
    let totalLimit = 0;
    let isUnlimited = false;

    allSubscriptions.forEach((subscription) => {
      if (!subscription.tier) return;
      totalUsed += subscription.listingsUsed;
      if (subscription.tier.maxListings === -1) {
        isUnlimited = true;
      } else {
        totalLimit += subscription.tier.maxListings;
        totalAvailable += subscription.tier.maxListings - subscription.listingsUsed;
      }
    });

    return {
      totalUsed,
      totalAvailable,
      totalLimit,
      isUnlimited,
      isMultiple: allSubscriptions.length > 1,
      isFull: !isUnlimited && totalAvailable <= 0,
    };
  }, [allSubscriptions]);

  const hasStarterListingsAvailable = useMemo(
    () => Boolean(starterCredits?.isActive && (starterCredits?.listingsRemaining || 0) > 0),
    [starterCredits]
  );

  useEffect(() => {
    if (listingType === 'job' && !JOB_CATEGORIES.includes(category)) {
      setCategory('Jobs');
    }
    if (listingType === 'service' && !SERVICE_CATEGORIES.includes(category)) {
      setCategory('Services');
    }
  }, [listingType, category]);

  const markLocationAsUserManaged = useCallback(() => {
    hasUserManagedLocationRef.current = true;
    lastLocationSourceRef.current = { source: 'user', priority: LOCATION_PRIORITY.user };
  }, []);

  const applyLocationSuggestion = useCallback(
    (suggestion: LocationSuggestion) => {
      markLocationAsUserManaged();
      const cityName = suggestion.locationName?.trim() || suggestion.city?.trim() || 'Unknown';

      const applied = setLocationIfAllowed(
        'suggestion',
        suggestion.latitude,
        suggestion.longitude,
        {
          setInputs: true,
          setCity: true,
          pincode: suggestion.pincode || '',
        }
      );

      if (applied) {
        setLocationDistrict(suggestion.district || '');
        setLocationState(suggestion.state || '');
        setPincodeSearchInput('');
        setLocationSuggestions([]);
        setPincodeSearchError(null);
        setCoordinateResolveError(null);
        setCoordinateResolveSuccess(null);
        setShowLocationModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [markLocationAsUserManaged]
  );

  const parseCoordinatesFromMapsLink = useCallback((input: string) => {
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
      if (built) {
        return built;
      }
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
          // Ignore invalid URL parsing and continue with next variant
        }
      }
    }

    return null;
  }, []);

  const expandGoogleMapsShortLink = useCallback(async (input: string): Promise<string> => {
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
  }, []);

  const extractMapsInputCandidate = useCallback((input: string): string => {
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
  }, []);

  const openGoogleMapsPicker = useCallback(async () => {
    const latitudeCandidate = latitudeInput.trim();
    const longitudeCandidate = longitudeInput.trim();
    const fallbackCoords =
      latitude !== null && longitude !== null ? `${latitude},${longitude}` : '';
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
  }, [latitude, longitude, latitudeInput, longitudeInput]);

  const applyCurrentCoordinatesFromDevice = useCallback(async () => {
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

      // Attempt to apply device coords only if allowed by priority
      const applied = setLocationIfAllowed('device', lat, lon, { setInputs: true });
      if (applied) {
        hasUserManagedLocationRef.current = true;
        setCoordinateResolveTrigger((value) => value + 1);
        setCoordinateResolveError(null);
        setCoordinateResolveSuccess('Current coordinates captured.');
        Haptics.selectionAsync();
      }
    } catch (error) {
      console.error('[Create] Error capturing current coordinates:', error);
      setCoordinateResolveSuccess(null);
      setCoordinateResolveError('Unable to capture current coordinates. Please try again');
    } finally {
      setIsResolvingCurrentCoordinates(false);
    }
  }, [isResolvingCurrentCoordinates, markLocationAsUserManaged, setLocationIfAllowed]);

  const applyCoordinatesFromMapsLink = useCallback(async () => {
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
      console.warn('[Create] Backend maps parser failed, trying local fallback:', error);
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

    // Prefer maps-link over lower-priority sources
    hasUserManagedLocationRef.current = true;
    const requestId = coordinateResolveRequestIdRef.current + 1;
    coordinateResolveRequestIdRef.current = requestId;
    const applied = setLocationIfAllowed('maps-link', parsed.latitude, parsed.longitude, {
      setInputs: true,
      force: true,
    });
    setMapsLinkInput('');
    setCoordinateResolveError(null);

    try {
      setIsResolvingMapsLink(true);
      const resolved = await getLocationDetailsFromCoordinates(parsed.latitude, parsed.longitude, {
        requestId,
      });
      setIsResolvingMapsLink(false);
      if (applied && resolved) {
        setCoordinateResolveSuccess('Coordinates captured from Google Maps.');
        setShowLocationModal(false);
        Haptics.selectionAsync();
      } else {
        // Ensure reverse-geocode runs via trigger even if not immediate
        setCoordinateResolveTrigger((value) => value + 1);
        setCoordinateResolveSuccess('Coordinates captured from Google Maps.');
        Haptics.selectionAsync();
      }
    } catch (err) {
      setIsResolvingMapsLink(false);
      setCoordinateResolveTrigger((value) => value + 1);
      setCoordinateResolveSuccess('Coordinates captured from Google Maps.');
      Haptics.selectionAsync();
    }
  }, [
    mapsLinkInput,
    parseCoordinatesFromMapsLink,
    expandGoogleMapsShortLink,
    extractMapsInputCandidate,
    setLocationIfAllowed,
  ]);

  // Live search by location name / pincode (similar to select location page)
  useEffect(() => {
    if (!showLocationModal) {
      return;
    }

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
          if (active) {
            setLocationSuggestions([]);
          }
          return;
        }

        const responseData = (await response.json()) as {
          success?: boolean;
          data?: LocationSuggestion[];
        };

        const suggestions =
          responseData.success && Array.isArray(responseData.data) ? responseData.data : [];

        if (active) {
          setLocationSuggestions(suggestions);
        }
      } catch (error) {
        console.error('Error searching location:', error);
        if (active) {
          setLocationSuggestions([]);
          // Keep UX similar to Select Location page: silent fallback to empty results
          setPincodeSearchError(null);
        }
      } finally {
        if (active) {
          setIsSearchingLocation(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [pincodeSearchInput, showLocationModal]);

  // Get location details from coordinates via internal APIs
  const getLocationDetailsFromCoordinates = useCallback(
    async (
      lat: number,
      lon: number,
      options?: { notify?: boolean; skipIfManualOverride?: boolean; requestId?: number }
    ): Promise<boolean> => {
      const notify = options?.notify ?? false;
      const skipIfManualOverride = options?.skipIfManualOverride ?? false;
      const requestId = options?.requestId;

      if (skipIfManualOverride && hasUserManagedLocationRef.current) {
        return false;
      }

      try {
        const apiUrl = getApiUrl();
        let resolvedLocation = '';
        let resolvedPincode = '';
        let resolvedDistrict = '';
        let resolvedState = '';

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
                district?: string;
                pincode?: string;
              };
            };

            if (reverseData.success && reverseData.data) {
              resolvedLocation = String(
                reverseData.data.locationName ||
                  reverseData.data.city ||
                  reverseData.data.state ||
                  ''
              ).trim();
              resolvedPincode = String(reverseData.data.pincode || '').trim();
              resolvedDistrict = String(reverseData.data.district || '').trim();
              resolvedState = String(reverseData.data.state || '').trim();
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
              district?: string;
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
              if (!resolvedDistrict) {
                resolvedDistrict = String(nearest.district || '').trim();
              }
              if (!resolvedState) {
                resolvedState = String(nearest.state || '').trim();
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

        if (skipIfManualOverride && hasUserManagedLocationRef.current) {
          return false;
        }

        if (resolvedPincode) {
          setPincode(resolvedPincode);
        }
        if (resolvedLocation) {
          setLocationCity(resolvedLocation);
        }
        setLocationDistrict(resolvedDistrict);
        setLocationState(resolvedState);

        if (notify) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        return true;
      } catch (error) {
        console.error('Error getting location details:', error);
        return false;
      }
    },
    []
  );

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
  }, [
    getLocationDetailsFromCoordinates,
    latitudeInput,
    longitudeInput,
    showLocationModal,
    coordinateResolveTrigger,
  ]);

  // Auto-request device location on component mount
  useEffect(() => {
    const requestDeviceLocation = async () => {
      setIsLoadingLocation(true);

      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          console.log('[Create] Location permission denied');
          Alert.alert(
            'Location Permission',
            'Location access helps buyers find your listing. You can still enter your location manually.',
            [{ text: 'OK' }]
          );
          setIsLoadingLocation(false);
          return;
        }

        // Get current device location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: true,
        });

        if (hasUserManagedLocationRef.current) {
          console.log('[Create] Skipping auto-location because user manually selected location');
          setIsLoadingLocation(false);
          return;
        }

        const { latitude: lat, longitude: lon } = location.coords;

        // Set coordinates
        setLatitude(lat);
        setLongitude(lon);
        setLatitudeInput(String(lat));
        setLongitudeInput(String(lon));
        setLocationCity((prev) => prev || 'Current Location');
        setCoordinateResolveError(null);
        setCoordinateResolveSuccess(null);

        // Try to get location details (pincode, city) from reverse geocoding
        await getLocationDetailsFromCoordinates(lat, lon, {
          notify: true,
          skipIfManualOverride: true,
        });

        console.log('[Create] Auto-captured location:', {
          lat,
          lon,
          pincode: pincode || 'pending',
        });
      } catch (error) {
        console.error('[Create] Error auto-capturing location:', error);
        Alert.alert(
          'Location Error',
          'Could not auto-detect your location. Please make sure location services are enabled, or enter your location manually.',
          [{ text: 'OK' }]
        );
      } finally {
        setIsLoadingLocation(false);
      }
    };

    requestDeviceLocation();
  }, [getLocationDetailsFromCoordinates]);

  // Fetch active subscription on mount
  const fetchActiveSubscription = useCallback(
    async (options?: { force?: boolean }): Promise<number> => {
      if (!user?.id) {
        setStarterCredits(null);
        setIsLoadingSubscription(false);
        return 0;
      }

      const now = Date.now();
      const shouldThrottle =
        !options?.force &&
        now - lastSubscriptionFetchAtRef.current < SUBSCRIPTION_FETCH_THROTTLE_MS;
      if (shouldThrottle) {
        console.log('[Create] fetchActiveSubscription - Throttled', {
          elapsedMs: now - lastSubscriptionFetchAtRef.current,
          throttleMs: SUBSCRIPTION_FETCH_THROTTLE_MS,
        });
        return previousSubscriptionCount.current;
      }

      if (isFetchingSubscriptionRef.current) {
        return previousSubscriptionCount.current;
      }
      isFetchingSubscriptionRef.current = true;
      lastSubscriptionFetchAtRef.current = now;

      console.log('[Create] fetchActiveSubscription - Starting fetch for user:', user.id);

      try {
        const apiUrl = getApiUrl();
        const timestamp = Date.now();
        const response = await fetch(`${apiUrl}/api/subscriptions?t=${timestamp}`, {
          headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
          cache: 'no-store',
        });

        const data = await response.json();
        setStarterCredits(data?.starterCredits || null);
        console.log('[Create] fetchActiveSubscription - Response:', {
          status: response.status,
          ok: response.ok,
          success: data.success,
          subscriptionCount: data.data?.length || 0,
          error: data.error,
          subscriptions: data.data?.map((s: SubscriptionData) => ({
            id: s.id,
            status: s.status,
            tierName: s.tier?.name,
            listingsUsed: s.listingsUsed,
            maxListings: s.tier?.maxListings,
          })),
        });

        if (!response.ok || data.success !== true) {
          console.warn('[Create] fetchActiveSubscription - API returned failure', {
            status: response.status,
            success: data.success,
            error: data.error,
          });

          if (response.status === 401) {
            setAllSubscriptions([]);
            setSelectedSubscription(null);
            setActiveSubscription(null);
            setStarterCredits(null);
            previousSubscriptionCount.current = 0;
            return 0;
          }

          // Keep existing UI state on transient errors to avoid subscriptions disappearing suddenly
          return previousSubscriptionCount.current;
        }

        if (Array.isArray(data.data) && data.data.length > 0) {
          // Get all active non-expired subscriptions
          const activeSubs = data.data.filter(
            (s: SubscriptionData) => s.status === 'active' && new Date(s.expiresAt) > new Date()
          );

          console.log(
            '[Create] fetchActiveSubscription - Active subscriptions:',
            activeSubs.length
          );

          setAllSubscriptions(activeSubs);

          // Try to keep current selection if it's still valid and has quota
          let selected = null;
          const currentSelectedSubscription = selectedSubscriptionRef.current;
          if (currentSelectedSubscription) {
            const stillValid = activeSubs.find(
              (s: SubscriptionData) =>
                s.id === currentSelectedSubscription.id &&
                s.tier &&
                (s.tier.maxListings === -1 || s.listingsUsed < s.tier.maxListings)
            );
            if (stillValid) {
              selected = stillValid;
              console.log(
                '[Create] fetchActiveSubscription - Keeping current selection:',
                selected.id
              );
            }
          }

          // If no valid selection, auto-select first subscription with available quota
          if (!selected) {
            const firstAvailable = activeSubs.find(
              (s: SubscriptionData) =>
                s.tier && (s.tier.maxListings === -1 || s.listingsUsed < s.tier.maxListings)
            );
            selected = firstAvailable || activeSubs[0] || null;
            console.log(
              '[Create] fetchActiveSubscription - Auto-selected subscription:',
              selected?.id
            );
          }

          setSelectedSubscription(selected);
          setActiveSubscription(selected); // For backward compatibility

          // Update ref for tracking subscription count changes
          const prevCount = previousSubscriptionCount.current;
          previousSubscriptionCount.current = activeSubs.length;

          console.log('[Create] fetchActiveSubscription - Updated state:', {
            previousCount: prevCount,
            newCount: activeSubs.length,
            selectedId: selected?.id,
          });

          return activeSubs.length;
        } else {
          console.log('[Create] fetchActiveSubscription - No subscriptions found');
          setAllSubscriptions([]);
          setSelectedSubscription(null);
          setActiveSubscription(null);
          previousSubscriptionCount.current = 0;
          return 0;
        }
      } catch (error) {
        console.error('[Create] Error fetching active subscription:', error);
        // Keep existing subscription state on network/runtime failures
        return previousSubscriptionCount.current;
      } finally {
        isFetchingSubscriptionRef.current = false;
        setIsLoadingSubscription(false);
      }
    },
    [user?.id, user?.phone]
  );

  // Refetch subscriptions when screen comes into focus (e.g., after purchasing a subscription)
  useFocusEffect(
    useCallback(() => {
      console.log('[Create] Screen focused - refreshing subscriptions');
      const previousCount = previousSubscriptionCount.current;

      fetchActiveSubscription().then((newCount) => {
        console.log('[Create] useFocusEffect - Fetch complete:', {
          previousCount,
          newCount,
          shouldShowAlert: newCount > previousCount && previousCount > 0,
        });

        // Show alert if new subscriptions were added (after purchase)
        if (newCount > previousCount && previousCount > 0) {
          requestAnimationFrame(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              '🎉 New Subscription Active',
              `You now have ${newCount} active subscription${newCount !== 1 ? 's' : ''}. Tap "Change" to switch between them.`,
              [{ text: 'Got it!' }]
            );
          });
        }
      });
    }, [fetchActiveSubscription])
  );

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const bottomCtaSafeSpacing = Platform.OS === 'web' ? 34 : 86;
  const heroTopPadding = Platform.OS === 'web' ? 18 : 18 + Math.max(insets.top, 10);

  const uploadImagesToCloudflare = async (uris: string[]): Promise<string[]> => {
    return uploadImagesToCloudflareUtil(uris, {
      fileNamePrefix: 'listing_image',
      userId: user?.id || undefined,
    });
  };

  const pickImage = useCallback(async (useCamera: boolean) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery access is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Start image compression
        setIsCompressingImages(true);
        setImageCompressionProgress({ current: 0, total: 1 });

        try {
          setValidationMessage('Optimizing image for faster upload...');

          const compressedResults = await compressImagesWithProgress(
            [asset.uri],
            (progress, current, total) => {
              setImageCompressionProgress({ current, total });
            },
            {
              maxWidth: QUALITY_PRESETS.ultraLight.maxWidth,
              maxHeight: QUALITY_PRESETS.ultraLight.maxHeight,
              quality: QUALITY_PRESETS.ultraLight.quality,
            }
          );

          if (compressedResults.length > 0) {
            const compressedUri = compressedResults[0].uri;

            let finalImageData = compressedUri;
            try {
              finalImageData = await toPortableImageUri(compressedUri);
            } catch (conversionError) {
              console.error('[Create] Image portability conversion failed:', conversionError);
              Alert.alert('Image Error', 'Failed to process image. Please try again.');
              setIsCompressingImages(false);
              setImageCompressionProgress(null);
              return;
            }

            // Check for duplicate using hash
            const duplicateHash = await ImageStorage.findDuplicateHash(finalImageData);
            if (duplicateHash) {
              setImageDeduplicationInfo(
                `✓ Image already in use (hash: ${ImageHasher.getShortHash(duplicateHash)})`
              );
            }

            // Store image hash and increment usage
            try {
              const hash = await ImageStorage.saveImageByHash(
                finalImageData,
                compressedResults[0].width,
                compressedResults[0].height,
                QUALITY_PRESETS.ultraLight.quality,
                compressedResults[0].compressedSize
              );
              setImageHashes((prev) => [...prev, hash]);
            } catch (hashError) {
              console.error('Failed to hash image:', hashError);
            }

            console.log(
              '[Create] Adding image to array, starts with:',
              finalImageData.substring(0, 30)
            );
            setImages((prev) => [...prev, finalImageData]);
            if (duplicateHash) {
              setValidationMessage('Duplicate image detected. Reusing optimized storage.');
            }
          }
        } catch (compressionError) {
          console.error('Image compression error:', compressionError);
          // Fallback: use original image if compression fails
          let finalImageData = asset.uri;
          try {
            finalImageData = await toPortableImageUri(asset.uri);
          } catch (conversionError) {
            console.error('[Create] Fallback conversion failed:', conversionError);
            Alert.alert('Image Error', 'Failed to process image. Please try again.');
            setIsCompressingImages(false);
            setImageCompressionProgress(null);
            return;
          }

          setValidationMessage('Using original image quality.');
          setImages((prev) => [...prev, finalImageData]);
        } finally {
          setIsCompressingImages(false);
          setImageCompressionProgress(null);
          setValidationMessage('');
        }
      }
    } catch (e) {
      console.error('Image picker error:', e);
      setIsCompressingImages(false);
    }
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));

    // Decrement hash usage if available
    if (imageHashes[index]) {
      ImageStorage.decrementImageUsage(imageHashes[index]).catch((error) => {
        console.error('Failed to decrement image usage:', error);
      });
    }

    setImageHashes((prev) => prev.filter((_, i) => i !== index));
    setImageDeduplicationInfo(null);
  };

  const handleRecordedVideo = useCallback(async (recordedUri: string) => {
    try {
      console.log('[Create] Received recorded video URI:', recordedUri);

      // Compress the recorded video
      setIsCompressing(true);
      setCompressionProgress(0);
      setValidationMessage('Optimizing video for faster upload...');

      const compressedResult = await compressVideoWithProgress(
        recordedUri,
        (progress) => {
          setCompressionProgress(Math.min(Math.round(progress), 99));
        },
        { quality: 'low' }
      );

      console.log('[Create] Video compression complete:', {
        originalSize: compressedResult.originalSize,
        compressedSize: compressedResult.compressedSize,
        uri: compressedResult.uri,
      });

      setCompressionProgress(100);
      setVideoUri(compressedResult.uri);

      // Generate thumbnail
      try {
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(compressedResult.uri, {
          time: 0,
          quality: 0.7,
        });
        setVideoThumbnail(thumbUri);
      } catch (thumbError) {
        console.warn('[Create] Could not generate video thumbnail:', thumbError);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (compressionError) {
      console.error('[Create] Video compression error:', compressionError);
      setValidationMessage('Using original video quality.');
      setVideoUri(recordedUri);

      // Generate thumbnail for fallback
      try {
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(recordedUri, {
          time: 0,
          quality: 0.7,
        });
        setVideoThumbnail(thumbUri);
      } catch (thumbError) {
        console.warn('[Create] Could not generate video thumbnail:', thumbError);
      }
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
      setValidationMessage('');
    }
  }, []);

  const pickVideo = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Gallery access is required to select videos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 35, // Allow buffer for frame timing (target: 30s, buffer: 5s)
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;

        // Start compression
        setIsCompressing(true);
        setCompressionProgress(0);

        try {
          setValidationMessage('Optimizing video for faster upload...');

          const compressedResult = await compressVideoWithProgress(
            uri,
            (progress) => {
              setCompressionProgress(Math.min(Math.round(progress), 99));
            },
            { quality: 'low' }
          );

          setCompressionProgress(100);
          setVideoUri(compressedResult.uri);

          // Generate thumbnail
          try {
            const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(
              compressedResult.uri,
              {
                time: 0,
                quality: 0.7,
              }
            );
            setVideoThumbnail(thumbUri);
          } catch (thumbError) {
            console.warn('[Create] Could not generate video thumbnail:', thumbError);
          }

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (compressionError) {
          console.error('Video compression error:', compressionError);
          // Fall back to original video if compression fails
          setValidationMessage('Using original video quality.');
          setVideoUri(uri);

          // Generate thumbnail for fallback
          try {
            const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
              time: 0,
              quality: 0.7,
            });
            setVideoThumbnail(thumbUri);
          } catch (thumbError) {
            console.warn('[Create] Could not generate video thumbnail:', thumbError);
          }
        } finally {
          setIsCompressing(false);
          setCompressionProgress(0);
          setValidationMessage('');
        }
      }
    } catch (e) {
      console.error('Video picker error:', e);
      setIsCompressing(false);
    }
  }, []);

  // Upload progress UI helper
  const renderUploadProgress = () => {
    if (!isUploading || !uploadProgress) return null;
    const percentage = uploadProgress.progress;

    return (
      <View style={{ marginTop: 8 }}>
        <Text style={{ color: Colors.textSecondary, marginBottom: 6 }}>
          Uploading video: {percentage}%
        </Text>
        <UploadProgressBar progress={percentage} />
      </View>
    );
  };

  const parseRetryAfter = (message?: string): string | undefined => {
    if (!message) return undefined;
    const match = message.match(/"retryAfter"\s*:\s*"([^"]+)"/);
    return match?.[1];
  };

  const showDailyLimitAlert = (error: {
    message?: string;
    retryAfter?: string;
    limit?: number;
  }): void => {
    const retryAfter = error.retryAfter || parseRetryAfter(error.message) || '24 hours';
    const limit = typeof error.limit === 'number' ? error.limit : 50;

    Alert.alert(
      'Daily Limit Reached',
      `You can create up to ${limit} listings per day. Please try again after ${retryAfter}.`,
      [{ text: 'OK' }]
    );
  };

  const submitListing = async (duration?: number, overrideSubscription?: SubscriptionData) => {
    // Use override subscription if provided, otherwise use selected subscription
    const subscriptionToUse = overrideSubscription || selectedSubscription;

    console.log(
      '[Create] submitListing called — isSubmitting:',
      isSubmitting,
      'duration:',
      duration,
      'subscription:',
      subscriptionToUse?.tier?.name
    );

    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a title for your listing.');
      return;
    }
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('Missing Info', 'Please enter a valid price.');
      return;
    }
    if (offerPrice && Number(offerPrice) > 0 && Number(offerPrice) >= Number(price)) {
      Alert.alert('Invalid Offer Price', 'Offer price must be less than the listed price.');
      return;
    }
    // Photos are required for non-job listings, optional for jobs
    if (images.length === 0 && listingType !== 'job') {
      Alert.alert('Missing Info', 'Please add at least one photo.');
      return;
    }

    setIsSubmitting(true);
    setIsUploading(false);
    setUploadProgress(null);
    setOverallProgress(10); // Starting
    setValidationMessage('Preparing your listing...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // For jobs without images, use default job posting image (briefcase icon)
      let listingImages = images;
      if (listingType === 'job' && images.length === 0) {
        // Default job posting image placeholder
        listingImages = [
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ];
      }

      // Upload all new images directly to Cloudflare, keep existing remote URLs as-is.
      listingImages = await uploadImagesToCloudflare(listingImages);

      console.log(
        '[Create] Submitting listing with images count:',
        listingImages.length,
        'duration:',
        duration
      );
      listingImages.forEach((img, idx) => {
        console.log(
          `[Create] Image ${idx}: ${img.startsWith('blob:') ? 'BLOB URL!' : img.startsWith('data:') ? 'BASE64 ✓' : 'OTHER'} (${img.substring(0, 50)}...)`
        );
      });

      setOverallProgress(20); // Images prepared
      let finalVideoUrl: string | undefined = undefined;

      // Upload video optionally if user provided one
      if (videoUri) {
        setIsUploading(true);
        setValidationMessage('📹 Uploading your video... This may take a moment.');

        const fileName = `video_${Date.now()}.mp4`;
        setUploadProgress({
          uploadId: fileName,
          chunksUploaded: 0,
          totalChunks: 1,
          progress: 10,
          isComplete: false,
        });
        const uploadResult = await uploadMediaToCloudflare({
          uri: videoUri,
          mediaType: 'video',
          fileName,
          userId: user?.id || undefined,
        });

        finalVideoUrl = uploadResult.url;
        setUploadProgress({
          uploadId: fileName,
          chunksUploaded: 1,
          totalChunks: 1,
          progress: 100,
          isComplete: true,
        });
        setOverallProgress(70);
        console.log(
          '[Create] Video upload result:',
          JSON.stringify({ success: !!uploadResult, videoUrl: uploadResult.url }, null, 2)
        );
        console.log('[Create] finalVideoUrl set to:', finalVideoUrl);
        setIsUploading(false);
        setValidationMessage('✅ Video uploaded! Creating your listing...');
      } else {
        setOverallProgress(30); // No video, skip to next stage
      }

      console.log('[Create] About to call addListing with:', {
        finalVideoUrl,
        videosArray: finalVideoUrl ? [finalVideoUrl] : undefined,
      });

      // Fallback location chain: deviceLocation -> userStoredLocation -> requireManualLocation
      let finalLat = latitude;
      let finalLon = longitude;
      let finalCity = locationCity;

      // If no location captured, try user's stored location
      if (!finalLat || !finalLon) {
        if (user?.location?.latitude && user?.location?.longitude) {
          finalLat = user.location.latitude;
          finalLon = user.location.longitude;
          finalCity = user.location.city || finalCity || 'Unknown Location';
          console.log('[Create] Using stored user location:', { finalLat, finalLon, finalCity });
        } else {
          // Show warning if no location is set
          Alert.alert(
            'Location Missing',
            'Please set your location or allow location access so buyers can find your listing nearby.',
            [
              {
                text: 'Set Location',
                onPress: () => setShowLocationModal(true),
              },
              {
                text: 'Continue Anyway',
                style: 'destructive',
                onPress: () => {
                  // Use a default placeholder showing it's required
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }
      }

      console.log('[Create] Final listing location:', {
        latitude: finalLat,
        longitude: finalLon,
        city: finalCity,
        pincode,
      });

      setOverallProgress(75);
      setValidationMessage('📝 Finalizing your listing... Almost done!');

      await addListing(
        {
          userId: user?.id || '',
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          offerPrice: offerPrice ? Number(offerPrice) : undefined,
          priceUnit,
          category,
          images: listingImages,
          imageHashes: imageHashes.length > 0 ? imageHashes : undefined,
          videos: finalVideoUrl ? [finalVideoUrl] : undefined, // videos array is optional
          sellerName: user?.name || 'Anonymous',
          sellerPhone: user?.phone || '',
          location: {
            latitude: finalLat || 0,
            longitude: finalLon || 0,
            city: finalCity || 'Unknown Location',
          },
          pincode: pincode || undefined,
          condition,
          listingType: 'sell' as Listing['listingType'], // default to sell
          duration, // Pass duration for paid listings
        },
        duration,
        undefined, // no coupon code
        subscriptionToUse?.tier?.id,
        subscriptionToUse?.id // Pass userSubscriptionId for quota tracking
      );

      // Refresh subscription data to get updated listing counts
      await fetchActiveSubscription({ force: true });

      setOverallProgress(100);
      setValidationMessage('✅ Success! Your listing is submitted for admin review.');

      // Show success message briefly before clearing
      await new Promise((resolve) => setTimeout(resolve, 800));
      setTitle('');
      setDescription('');
      setPrice('');
      setOfferPrice('');
      setMediaType('photo');
      setImages([]);
      setImageHashes([]);
      setImageDeduplicationInfo(null);
      setVideoUri(null);
      setVideoThumbnail(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/my-listings', params: { posted: '1' } });
    } catch (e) {
      const error = e as any;
      console.error('[Create] Listing creation error:', error);

      if (
        error?.code === 'DAILY_LISTING_LIMIT_REACHED' ||
        error?.code === 'RATE_LIMIT_EXCEEDED' ||
        error?.message?.includes('HTTP 429')
      ) {
        showDailyLimitAlert(error);
      } else if (error?.code === 'SUBSCRIPTION_STARTER_OR_COUPON_REQUIRED') {
        Alert.alert(
          'Plan Required',
          error?.message ||
            'You need an active subscription, starter listing credit, or valid coupon to post.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'View Plans', onPress: () => router.push('/subscriptions') },
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to create listing. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
      setUploadProgress(null);
      setValidationMessage('');
      setOverallProgress(0);
    }
  };

  const handleSubmit = async () => {
    // Check if profile is complete before allowing listing
    if (!isProfileComplete(user)) {
      const missing = getMissingProfileFields(user);
      const missingText = missing
        .map((f) => (f === 'name' ? 'Name' : f === 'phone' ? 'Mobile Number' : 'Address'))
        .join(', ');

      Alert.alert(
        'Complete Your Profile',
        `Please fill in the following information: ${missingText}`,
        [
          {
            text: 'Cancel',
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: 'Go to Profile',
            onPress: () => {
              router.push('/profile');
            },
          },
        ]
      );
      return;
    }

    // If no paid plan is selected, let backend decide starter/coupon eligibility.
    // This avoids stale local subscription state blocking valid starter-credit posts.
    if (!selectedSubscription || !selectedSubscription.tier) {
      await submitListing();
      return;
    }

    // Check listing limits - Check consolidated quota for all subscriptions of same type
    const currentTierId = selectedSubscription.tier.id;
    const currentDuration = selectedSubscription.tier.durationDays;
    const sameTypeSubs = allSubscriptions.filter(
      (s) => s.tier?.id === currentTierId && s.tier?.durationDays === currentDuration
    );

    // Calculate total available across all same-type subscriptions
    let totalAvailable = 0;
    let hasUnlimited = false;

    sameTypeSubs.forEach((sub) => {
      if (sub.tier) {
        if (sub.tier.maxListings === -1) {
          hasUnlimited = true;
        } else {
          totalAvailable += sub.tier.maxListings - sub.listingsUsed;
        }
      }
    });

    if (!hasUnlimited && totalAvailable <= 0) {
      if (hasStarterListingsAvailable) {
        await submitListing();
        return;
      }

      // All subscriptions of this type are full
      Alert.alert(
        'All Subscriptions Full',
        sameTypeSubs.length > 1
          ? `All ${sameTypeSubs.length} of your ${selectedSubscription.tier.name} subscriptions are at capacity. Upgrade or purchase a new plan to create more listings.`
          : `You've used all listings in your ${selectedSubscription.tier.name} plan. Upgrade your plan to create more listings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade Plan',
            onPress: () => router.push('/subscriptions'),
          },
        ]
      );
      return;
    }

    // Auto-select a subscription with available quota from the same-type group
    const subscriptionToUse =
      sameTypeSubs.find(
        (sub) =>
          sub.tier && (sub.tier.maxListings === -1 || sub.listingsUsed < sub.tier.maxListings)
      ) || selectedSubscription;

    console.log('[Create] handleSubmit - Using subscription:', {
      id: subscriptionToUse.id,
      tierName: subscriptionToUse.tier?.name,
      listingsUsed: subscriptionToUse.listingsUsed,
      maxListings: subscriptionToUse.tier?.maxListings,
    });

    // Submit listing with auto-selected subscription (one that has available quota)
    await submitListing(subscriptionToUse.tier?.durationDays, subscriptionToUse);
  };

  // Focus pincode input when location modal is shown
  const handleLocationModalShow = useCallback(() => {
    const timer = setTimeout(() => {
      pincodeInputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Handle Android back button for location overlay
  useEffect(() => {
    if (showLocationModal) {
      const timer = setTimeout(() => {
        pincodeInputRef.current?.focus();
      }, 400);
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        setShowLocationModal(false);
        setPincodeSearchInput('');
        setPincodeSearchError(null);
        setCoordinateResolveError(null);
        setIsResolvingCoordinates(false);
        return true;
      });
      return () => {
        clearTimeout(timer);
        backHandler.remove();
      };
    }
  }, [showLocationModal]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: (insets.top || webTopInset) + 20 }]}>
        <View style={styles.authGate}>
          <View style={styles.authIconCircle}>
            <Feather name="user-plus" size={30} color={Colors.primary} />
          </View>
          <Text style={styles.authTitle}>Sign in to Post</Text>
          <Text style={styles.authSubtitle}>
            Register with your mobile number to post listings, services, jobs and connect with
            buyers
          </Text>
          <Pressable style={styles.authButton} onPress={() => router.push('/auth/register')}>
            <LinearGradient
              colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.authButtonGradient}
            >
              <Feather name="smartphone" size={18} color="#fff" />
              <Text style={styles.authButtonText}>Register with Mobile</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  const submissionProgress = Math.max(0, Math.min(100, Math.round(overallProgress)));
  const progressCircleRadius = 82;
  const progressCircleStroke = 14;
  const progressCircleSize = 220;
  const progressCircleCircumference = 2 * Math.PI * progressCircleRadius;
  const progressCircleStrokeOffset = progressCircleCircumference * (1 - submissionProgress / 100);

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: 16,
              paddingBottom: insets.bottom + bottomCtaSafeSpacing + 30,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
        >
          <View style={styles.heroContainer}>
            <LinearGradient
              colors={['#0F172A', '#0E7490', '#14B8A6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroCard, { paddingTop: heroTopPadding }]}
            >
              <View style={styles.heroGlowOrbA} />
              <View style={styles.heroGlowOrbB} />
              <Text style={styles.heroEyebrow}>NearHub Seller Studio</Text>
              <Text style={styles.screenTitle}>Create Listing</Text>
              <Text style={styles.heroSubtitle}>
                Build a premium listing in minutes. Every submission is reviewed by admin before it
                goes live.
              </Text>

              <View style={styles.heroProgressRow}>
                <View style={styles.heroProgressTrack}>
                  <View
                    style={[
                      styles.heroProgressFill,
                      { width: `${Math.max(completionPercentage, 8)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.heroProgressText}>
                  {completedSteps}/{totalSteps} steps
                </Text>
              </View>

              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaPill}>
                  <Feather name="image" size={12} color="#CCFBF1" />
                  <Text style={styles.heroMetaText}>{images.length} photos</Text>
                </View>
                <View style={styles.heroMetaPill}>
                  <Feather name="video" size={12} color="#CCFBF1" />
                  <Text style={styles.heroMetaText}>{videoUri ? 'Video added' : 'No video'}</Text>
                </View>
                <View style={styles.heroMetaPill}>
                  <Feather name="shield" size={12} color="#CCFBF1" />
                  <Text style={styles.heroMetaText}>Admin review</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Step 1: Listing Type */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <Text style={styles.sectionLabel}>What are you posting?</Text>
            </View>
            <View style={styles.typeGrid}>
              <Pressable
                style={[styles.typeButton, listingType === 'sell' && styles.typeButtonActive]}
                onPress={() => setListingType('sell')}
              >
                <Feather
                  name="tag"
                  size={16}
                  color={listingType === 'sell' ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.typeText, listingType === 'sell' && styles.typeTextActive]}>
                  Sell Product
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeButton, listingType === 'buy' && styles.typeButtonActive]}
                onPress={() => setListingType('buy')}
              >
                <Feather
                  name="shopping-cart"
                  size={16}
                  color={listingType === 'buy' ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.typeText, listingType === 'buy' && styles.typeTextActive]}>
                  Looking to Buy
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeButton, listingType === 'service' && styles.typeButtonActive]}
                onPress={() => setListingType('service')}
              >
                <Feather
                  name="tool"
                  size={16}
                  color={listingType === 'service' ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.typeText, listingType === 'service' && styles.typeTextActive]}>
                  Offer Service
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeButton, listingType === 'job' && styles.typeButtonActive]}
                onPress={() => setListingType('job')}
              >
                <Feather
                  name="briefcase"
                  size={16}
                  color={listingType === 'job' ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.typeText, listingType === 'job' && styles.typeTextActive]}>
                  Post Job
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Step 2: Upload Photos */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={styles.sectionLabel}>
                Upload Photos {listingType === 'job' ? '(Optional)' : ''}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageRow}
            >
              <Pressable style={styles.addImageButton} onPress={() => pickImage(false)}>
                <Feather name="image" size={20} color="#fff" />
                <Text style={styles.addImageText}>Gallery</Text>
              </Pressable>
              <Pressable style={styles.addImageButton} onPress={() => pickImage(true)}>
                <Feather name="camera" size={20} color="#fff" />
                <Text style={styles.addImageText}>Camera</Text>
              </Pressable>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageThumb}>
                  <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" />
                  <Pressable style={styles.removeImage} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={18} color={Colors.accent} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            {listingType === 'job' && images.length === 0 && (
              <View
                style={[
                  styles.deduplicationBanner,
                  { marginTop: 10, backgroundColor: '#F0F9FF', borderLeftColor: '#0369A1' },
                ]}
              >
                <Feather name="info" size={16} color="#0369A1" />
                <Text style={[styles.deduplicationText, { color: '#0369A1' }]}>
                  No photos? We&apos;ll use our default job posting image.
                </Text>
              </View>
            )}

            {imageDeduplicationInfo && (
              <View style={[styles.deduplicationBanner, { marginTop: 10 }]}>
                <Feather name="check-circle" size={16} color={Colors.success} />
                <Text style={styles.deduplicationText}>{imageDeduplicationInfo}</Text>
              </View>
            )}

            {isCompressingImages && imageCompressionProgress && (
              <View style={[styles.compressionBanner, { marginTop: 12 }]}>
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={{ marginRight: 10 }}
                />
                <View style={styles.compressionContent}>
                  <Text style={styles.compressionText}>
                    Optimizing image {imageCompressionProgress.current} of{' '}
                    {imageCompressionProgress.total}...
                  </Text>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(imageCompressionProgress.current / imageCompressionProgress.total) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Step 3: Upload Video (Optional) */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <Text style={styles.sectionLabel}>Add Video (Optional)</Text>
            </View>

            <Text style={styles.sectionHint}>
              Upload a short video to showcase your product in the Shorts feed
            </Text>

            {isCompressing ? (
              <View style={styles.videoProcessingCard}>
                <ActivityIndicator
                  size="large"
                  color={Colors.primary}
                  style={{ marginBottom: 2 }}
                />
                <Text style={styles.videoProcessingTitle}>Compressing video...</Text>
                <Text style={styles.videoProcessingPercent}>{compressionProgress}%</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${compressionProgress}%` }]} />
                </View>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageRow}
              >
                <Pressable style={styles.addVideoButton} onPress={() => setShowRecorder(true)}>
                  <Feather name="camera" size={18} color="#fff" />
                  <Text style={styles.addImageText}>Record</Text>
                </Pressable>
                <Pressable style={styles.addVideoButton} onPress={pickVideo}>
                  <Feather name="video" size={18} color="#fff" />
                  <Text style={styles.addImageText}>Select</Text>
                </Pressable>
                {videoUri && (
                  <View style={styles.imageThumb}>
                    {videoThumbnail ? (
                      <Image
                        source={{ uri: videoThumbnail }}
                        style={styles.thumbImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.thumbImage,
                          {
                            backgroundColor: Colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <Feather name="film" size={24} color={Colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.videoPlayOverlay}>
                      <Feather name="play-circle" size={18} color="#FFFFFF" />
                    </View>
                    <Pressable
                      style={styles.removeImage}
                      onPress={() => {
                        setVideoUri(null);
                        setVideoThumbnail(null);
                      }}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.accent} />
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            )}
          </View>

          {/* Step 4: Title */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>4</Text>
              </View>
              <Text style={styles.sectionLabel}>Title</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={
                listingType === 'service'
                  ? 'What services are you willing to provide?'
                  : listingType === 'job'
                    ? 'What type of job you are posting?'
                    : 'What are you selling?'
              }
              placeholderTextColor={Colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
          </View>

          {/* Step 5: Price */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>5</Text>
              </View>
              <Text style={styles.sectionLabel}>
                {listingType === 'job'
                  ? 'Salary'
                  : listingType === 'service'
                    ? 'Service Rate'
                    : 'Price'}
              </Text>
            </View>
            <View style={styles.priceInput}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                style={[styles.input, styles.priceField]}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.unitSelectorInline}>
              <Text style={styles.unitInlineLabel}>Unit:</Text>
              <View style={styles.unitChipsContainer}>
                {(
                  PRICE_UNITS[
                    listingType === 'service'
                      ? 'Services'
                      : listingType === 'job'
                        ? 'Jobs'
                        : category
                  ] || PRICE_UNITS.default
                ).map((unit) => (
                  <Pressable
                    key={unit}
                    style={[styles.unitChip, priceUnit === unit && styles.unitChipSelected]}
                    onPress={() => setPriceUnit(unit)}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        priceUnit === unit && styles.unitChipTextSelected,
                      ]}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Offer Price Section */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.offerPriceLabel}>
                {listingType === 'job' ? 'Incentives' : 'Offer Price (Optional)'}
              </Text>
              <Text style={styles.offerPriceHint}>
                {listingType === 'job'
                  ? 'Specify additional incentives or benefits (optional)'
                  : 'Set a discounted price to attract more buyers'}
              </Text>
              <View style={styles.priceInput}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.input, styles.priceField]}
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  keyboardType="numeric"
                />
              </View>
              {offerPrice && Number(offerPrice) > 0 && Number(price) > 0 && (
                <View
                  style={[
                    styles.offerPriceFeedback,
                    Number(offerPrice) >= Number(price)
                      ? styles.offerPriceFeedbackInvalid
                      : styles.offerPriceFeedbackValid,
                  ]}
                >
                  {Number(offerPrice) >= Number(price) ? (
                    <Text
                      style={[styles.offerPriceFeedbackText, styles.offerPriceFeedbackTextInvalid]}
                    >
                      {listingType === 'job'
                        ? '⚠️ Incentives must be less than or equal to salary'
                        : '⚠️ Offer price must be less than listed price'}
                    </Text>
                  ) : (
                    <Text style={styles.offerPriceFeedbackText}>
                      {listingType === 'job'
                        ? `✓ Salary: ₹${Number(price).toLocaleString('en-IN')} + Incentives: ₹${offerPrice}`
                        : `✓ Save ₹${(Number(price) - Number(offerPrice)).toLocaleString('en-IN')} for buyers`}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>6</Text>
              </View>
              <Text style={styles.sectionLabel}>Category</Text>
            </View>
            <View style={styles.chipRow}>
              {visibleCategories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>7</Text>
              </View>
              <Text style={styles.sectionLabel}>Where do you want to Post?</Text>
            </View>
            {locationCity || (latitude !== null && longitude !== null) ? (
              <View style={styles.selectedLocationCard}>
                <View style={styles.locationInfo}>
                  <Feather name="map-pin" size={16} color={Colors.success} />
                  <View style={styles.locationText}>
                    <Text style={styles.locationName}>{locationCity || 'Current Location'}</Text>
                    <Text style={styles.locationCity}>
                      {[locationDistrict, locationState].filter(Boolean).join(', ') ||
                        (latitude !== null && longitude !== null
                          ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                          : 'Current location')}
                    </Text>
                    {pincode ? (
                      <Text style={styles.locationPincode}>Pincode: {pincode}</Text>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    setPincodeSearchInput('');
                    setLocationSuggestions([]);
                    setPincodeSearchError(null);
                    setCoordinateResolveError(null);
                    setIsResolvingCoordinates(false);
                    setLatitudeInput(latitude !== null ? String(latitude) : '');
                    setLongitudeInput(longitude !== null ? String(longitude) : '');
                    setShowLocationModal(true);
                  }}
                  style={styles.changeLocationButton}
                >
                  <Text style={styles.changeLocationText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.selectLocationButton}
                onPress={() => {
                  setPincodeSearchInput('');
                  setLocationSuggestions([]);
                  setPincodeSearchError(null);
                  setCoordinateResolveError(null);
                  setIsResolvingCoordinates(false);
                  setLatitudeInput(latitude !== null ? String(latitude) : '');
                  setLongitudeInput(longitude !== null ? String(longitude) : '');
                  setShowLocationModal(true);
                }}
              >
                <Feather name="map-pin" size={16} color={Colors.primary} />
                <Text style={styles.selectLocationText}>Select Location</Text>
                <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {showConditionField && (
            <View style={styles.section}>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>8</Text>
                </View>
                <Text style={styles.sectionLabel}>Condition</Text>
              </View>
              <View style={styles.chipRow}>
                {CONDITIONS.map((c) => (
                  <Pressable
                    key={c.value}
                    style={[styles.chip, condition === c.value && styles.chipActive]}
                    onPress={() => setCondition(c.value)}
                  >
                    <Text style={[styles.chipText, condition === c.value && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{descriptionStepNumber}</Text>
              </View>
              <Text style={styles.sectionLabel}>Description</Text>
            </View>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe your item... (up to 1200 characters)"
              showPreview
            />
          </View>

          {/* Subscription Status */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="shield" size={14} color="#0EA5E9" />
              <Text style={styles.sectionLabel}>Subscription Status</Text>
            </View>
            {isLoadingSubscription ? (
              <View style={styles.subscriptionLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.subscriptionLoadingText}>Checking subscription...</Text>
              </View>
            ) : allSubscriptions.length > 0 ? (
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionCardHeader}>
                  <View style={styles.subscriptionStatusIcon}>
                    <Feather name="check" size={13} color="#fff" />
                  </View>
                  <View style={styles.subscriptionHeaderTextWrap}>
                    <Text style={styles.subscriptionCardTitle}>
                      {subscriptionStats.isMultiple
                        ? `Active Subscriptions (${allSubscriptions.length})`
                        : `${allSubscriptions[0]?.tier?.name} Plan Active`}
                    </Text>
                    <Text style={styles.subscriptionCardSubtitle}>
                      {subscriptionStats.isMultiple
                        ? 'Combined listing quota from all plans'
                        : `Expires ${new Date(allSubscriptions[0]?.expiresAt || new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </Text>
                  </View>
                  {subscriptionStats.isMultiple && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowSubscriptionSelector(true);
                      }}
                      style={styles.subscriptionSelectButton}
                    >
                      <Text style={styles.subscriptionSelectButtonText}>Select</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.subscriptionStatsGrid}>
                  <View style={styles.subscriptionStatItem}>
                    <Text style={styles.subscriptionStatValue}>{subscriptionStats.totalUsed}</Text>
                    <Text style={styles.subscriptionStatLabel}>
                      {subscriptionStats.isMultiple ? 'Total Used' : 'Used'}
                    </Text>
                  </View>
                  <View style={styles.subscriptionStatDivider} />
                  <View style={styles.subscriptionStatItem}>
                    <Text
                      style={[styles.subscriptionStatValue, styles.subscriptionStatValueSuccess]}
                    >
                      {subscriptionStats.isUnlimited ? '∞' : subscriptionStats.totalAvailable}
                    </Text>
                    <Text style={styles.subscriptionStatLabel}>
                      {subscriptionStats.isMultiple ? 'Total Left' : 'Available'}
                    </Text>
                  </View>
                  <View style={styles.subscriptionStatDivider} />
                  <View style={styles.subscriptionStatItem}>
                    <Text style={[styles.subscriptionStatValue, styles.subscriptionStatValueDark]}>
                      {subscriptionStats.isUnlimited ? '∞' : subscriptionStats.totalLimit}
                    </Text>
                    <Text style={styles.subscriptionStatLabel}>
                      {subscriptionStats.isMultiple ? 'Combined' : 'Per Plan'}
                    </Text>
                  </View>
                </View>

                {subscriptionStats.isMultiple && (
                  <View style={styles.subscriptionHintBanner}>
                    <Feather name="info" size={12} color="#0369A1" />
                    <Text style={styles.subscriptionHintText}>
                      Showing combined stats for all {allSubscriptions.length} subscriptions. Tap
                      Select to choose one.
                    </Text>
                  </View>
                )}

                {subscriptionStats.isFull && (
                  <View style={styles.subscriptionWarningRow}>
                    <Feather name="alert-triangle" size={12} color="#C2410C" />
                    <Text style={styles.subscriptionWarningText}>
                      {subscriptionStats.isMultiple
                        ? `All ${allSubscriptions.length} subscriptions are full. Upgrade to create more listings.`
                        : "You've reached your listing limit. Upgrade to create more."}
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push('/subscriptions');
                      }}
                      style={styles.subscriptionWarningButton}
                    >
                      <Text style={styles.subscriptionWarningButtonText}>Upgrade</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/subscriptions');
                }}
                style={({ pressed }) => [
                  styles.noSubscriptionCard,
                  pressed && styles.noSubscriptionCardPressed,
                ]}
              >
                <View style={styles.noSubscriptionHeader}>
                  <View style={styles.noSubscriptionIconWrap}>
                    <Feather
                      name={hasStarterListingsAvailable ? 'gift' : 'shopping-bag'}
                      size={14}
                      color="#F57C00"
                    />
                  </View>
                  <View style={styles.noSubscriptionTextWrap}>
                    <Text style={styles.noSubscriptionTitle}>
                      {hasStarterListingsAvailable ? 'Starter Pack Active' : 'Plan Needed'}
                    </Text>
                    <Text style={styles.noSubscriptionSubtitle}>
                      {hasStarterListingsAvailable
                        ? 'You can post now using welcome credits.'
                        : 'Subscribe to unlock recurring listing quota.'}
                    </Text>
                  </View>
                  <View style={styles.noSubscriptionActionPill}>
                    <Text style={styles.noSubscriptionActionPillText}>
                      {hasStarterListingsAvailable ? 'View Plans' : 'Choose Plan'}
                    </Text>
                  </View>
                </View>

                {hasStarterListingsAvailable ? (
                  <View style={styles.noSubscriptionStatsRow}>
                    <View style={styles.noSubscriptionStatItem}>
                      <Text style={styles.noSubscriptionStatValue}>
                        {starterCredits?.listingsRemaining || 0}
                      </Text>
                      <Text style={styles.noSubscriptionStatLabel}>Listings Left</Text>
                    </View>
                    <View style={styles.noSubscriptionStatDivider} />
                    <View style={styles.noSubscriptionStatItem}>
                      <Text style={styles.noSubscriptionStatValue}>
                        {starterCredits?.boostsRemaining || 0}
                      </Text>
                      <Text style={styles.noSubscriptionStatLabel}>Boosts Left</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noSubscriptionFeatureRow}>
                    <View style={styles.noSubscriptionFeaturePill}>
                      <Feather name="star" size={11} color="#0369A1" />
                      <Text style={styles.noSubscriptionFeatureText}>Boost visibility</Text>
                    </View>
                    <View style={styles.noSubscriptionFeaturePill}>
                      <Feather name="video" size={11} color="#0369A1" />
                      <Text style={styles.noSubscriptionFeatureText}>Video listings</Text>
                    </View>
                  </View>
                )}

                <View style={styles.noSubscriptionFooter}>
                  <Text style={styles.noSubscriptionFooterText}>
                    {hasStarterListingsAvailable
                      ? 'Subscribe anytime for higher limits and premium boosts.'
                      : 'Tap to compare plans and get started.'}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>

          {user && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Posting as</Text>
              <View style={styles.userInfoCard}>
                <View style={styles.userAvatar}>
                  <Feather name="user" size={16} color={Colors.primary} />
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userPhone}>+91 {user.phone}</Text>
                </View>
                <Feather name="check-circle" size={16} color={Colors.success} />
              </View>
            </View>
          )}

          <View style={styles.publishPanel}>
            <View style={styles.publishPanelTopRow}>
              <Text style={styles.publishPanelTitle}>Ready to publish?</Text>
              <Text style={styles.publishPanelCount}>
                {completedSteps}/{totalSteps}
              </Text>
            </View>
            <View style={styles.publishWarningRow}>
              <Feather name="alert-triangle" size={13} color="#B45309" />
              <Text style={styles.publishWarningText}>
                Your listing will appear after admin verification.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitPressed,
                isSubmitting && styles.submitDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={['#0EA5E9', '#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={styles.submitText}>Post Listing</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>

        {/* Subscription Picker Modal */}
        {showSubscriptionSelector &&
          (() => {
            // Group subscriptions by tier ID and duration
            type GroupedSubscription = {
              tierId: string;
              tierName: string;
              durationDays: number;
              count: number;
              totalUsed: number;
              totalAvailable: number;
              totalLimit: number;
              subscriptions: SubscriptionData[];
              hasAvailable: boolean;
              shortestExpiryDays: number;
            };

            const groupedSubs: GroupedSubscription[] = [];
            const groupMap = new Map<string, GroupedSubscription>();

            allSubscriptions.forEach((sub) => {
              if (!sub.tier) return;

              const key = `${sub.tier.id}-${sub.tier.durationDays}`;

              if (!groupMap.has(key)) {
                groupMap.set(key, {
                  tierId: sub.tier.id,
                  tierName: sub.tier.name,
                  durationDays: sub.tier.durationDays,
                  count: 0,
                  totalUsed: 0,
                  totalAvailable: 0,
                  totalLimit: sub.tier.maxListings === -1 ? -1 : 0,
                  subscriptions: [],
                  hasAvailable: false,
                  shortestExpiryDays: Infinity,
                });
              }

              const group = groupMap.get(key)!;
              group.count++;
              group.subscriptions.push(sub);
              group.totalUsed += sub.listingsUsed;

              const daysLeft = Math.max(
                0,
                Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              );
              group.shortestExpiryDays = Math.min(group.shortestExpiryDays, daysLeft);

              if (sub.tier.maxListings === -1) {
                group.totalLimit = -1;
                group.totalAvailable = -1;
                group.hasAvailable = true;
              } else {
                const available = sub.tier.maxListings - sub.listingsUsed;
                if (available > 0) group.hasAvailable = true;
                group.totalAvailable += available;
                if (group.totalLimit !== -1) {
                  group.totalLimit += sub.tier.maxListings;
                }
              }
            });

            groupedSubs.push(...groupMap.values());

            console.log('[Create] Picker Modal - Grouped Subscriptions:', {
              totalGroups: groupedSubs.length,
              totalSubscriptions: allSubscriptions.length,
              groups: groupedSubs.map((g) => ({
                tierName: g.tierName,
                count: g.count,
                totalUsed: g.totalUsed,
                totalAvailable: g.totalAvailable,
                totalLimit: g.totalLimit,
                hasAvailable: g.hasAvailable,
                subscriptionIds: g.subscriptions.map((s) => s.id),
              })),
            });

            return (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  justifyContent: 'flex-end',
                  zIndex: 999,
                  elevation: 999,
                }}
              >
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowSubscriptionSelector(false);
                  }}
                />
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                    paddingTop: 12,
                    paddingBottom: insets.bottom + (Platform.OS === 'web' ? 12 : 76),
                    maxHeight: '80%',
                  }}
                >
                  {/* Header */}
                  <View style={{ paddingHorizontal: 14, marginBottom: 8 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
                        Choose Subscription
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setShowSubscriptionSelector(false);
                        }}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 12,
                          backgroundColor: Colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name="x" size={16} color={Colors.text} />
                      </Pressable>
                    </View>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                      Select which subscription to use for this listing
                    </Text>
                  </View>

                  {/* Subscription List */}
                  <ScrollView
                    style={{ paddingHorizontal: 14 }}
                    contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 20 : 90 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {groupedSubs.map((group) => {
                      // Check if selected subscription is in this group
                      const isGroupSelected = group.subscriptions.some(
                        (sub) => selectedSubscription?.id === sub.id
                      );

                      return (
                        <Pressable
                          key={`${group.tierId}-${group.durationDays}`}
                          onPress={() => {
                            if (group.hasAvailable) {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                              // Auto-select the subscription with the most available quota
                              const bestSub = group.subscriptions
                                .filter(
                                  (sub) =>
                                    sub.tier &&
                                    (sub.tier.maxListings === -1 ||
                                      sub.listingsUsed < sub.tier.maxListings)
                                )
                                .sort((a, b) => {
                                  const aAvailable =
                                    a.tier!.maxListings === -1
                                      ? Infinity
                                      : a.tier!.maxListings - a.listingsUsed;
                                  const bAvailable =
                                    b.tier!.maxListings === -1
                                      ? Infinity
                                      : b.tier!.maxListings - b.listingsUsed;
                                  return bAvailable - aAvailable;
                                })[0];

                              if (bestSub) {
                                setSelectedSubscription(bestSub);
                                setActiveSubscription(bestSub);
                                setShowSubscriptionSelector(false);
                              }
                            } else {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                              Alert.alert(
                                'All Subscriptions Full',
                                `All ${group.count} of your ${group.tierName} subscriptions have used their listings.`,
                                [{ text: 'OK' }]
                              );
                            }
                          }}
                          style={{
                            backgroundColor: isGroupSelected ? '#E8F4FD' : '#F8F9FA',
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 8,
                            borderWidth: 1.5,
                            borderColor: isGroupSelected ? Colors.primary : 'transparent',
                            opacity: group.hasAvailable ? 1 : 0.6,
                          }}
                        >
                          {/* Header */}
                          <View
                            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                          >
                            <View
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor: isGroupSelected ? Colors.primary : Colors.border,
                                backgroundColor: isGroupSelected ? Colors.primary : '#fff',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 10,
                              }}
                            >
                              {isGroupSelected && <Feather name="check" size={12} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text
                                  style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}
                                >
                                  {group.tierName}
                                </Text>
                                {group.count > 1 && (
                                  <View
                                    style={{
                                      backgroundColor: Colors.primary,
                                      paddingHorizontal: 8,
                                      paddingVertical: 2,
                                      borderRadius: 8,
                                    }}
                                  >
                                    <Text
                                      style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}
                                    >
                                      ×{group.count}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text
                                style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}
                              >
                                {group.shortestExpiryDays}{' '}
                                {group.shortestExpiryDays === 1 ? 'day' : 'days'} remaining
                                {group.count > 1 && ' (shortest)'}
                              </Text>
                            </View>
                            {!group.hasAvailable && (
                              <View
                                style={{
                                  backgroundColor: '#FFF3E0',
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 6,
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#F57C00' }}>
                                  FULL
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Stats */}
                          <View
                            style={{
                              flexDirection: 'row',
                              backgroundColor: '#fff',
                              borderRadius: 8,
                              padding: 8,
                              gap: 6,
                            }}
                          >
                            <View style={{ flex: 1, alignItems: 'center' }}>
                              <Text
                                style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}
                              >
                                {group.totalUsed}
                              </Text>
                              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>
                                {group.count > 1 ? 'Total Used' : 'Used'}
                              </Text>
                            </View>
                            <View style={{ width: 1, backgroundColor: Colors.border }} />
                            <View style={{ flex: 1, alignItems: 'center' }}>
                              <Text
                                style={{ fontSize: 14, fontWeight: '700', color: Colors.success }}
                              >
                                {group.totalAvailable === -1 ? '\u221e' : group.totalAvailable}
                              </Text>
                              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>
                                {group.count > 1 ? 'Total Left' : 'Available'}
                              </Text>
                            </View>
                            <View style={{ width: 1, backgroundColor: Colors.border }} />
                            <View style={{ flex: 1, alignItems: 'center' }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>
                                {group.totalLimit === -1 ? '\u221e' : group.totalLimit}
                              </Text>
                              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>
                                {group.count > 1 ? 'Combined' : 'Per Plan'}
                              </Text>
                            </View>
                          </View>

                          {/* Grouping Info */}
                          {group.count > 1 && (
                            <View
                              style={{
                                backgroundColor: '#F0F7FF',
                                borderRadius: 8,
                                padding: 6,
                                marginTop: 6,
                              }}
                            >
                              <Text
                                style={{ fontSize: 11, color: Colors.primary, textAlign: 'center' }}
                              >
                                💡 Stats combined for all {group.count} subscriptions
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}

                    {/* Divider */}
                    <View
                      style={{
                        height: 1,
                        backgroundColor: Colors.border,
                        marginVertical: 12,
                      }}
                    />

                    {/* Buy More Button */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowSubscriptionSelector(false);
                        router.push('/subscriptions');
                      }}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: Colors.primary,
                          borderRadius: 12,
                          padding: 14,
                          shadowColor: Colors.primary,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 6,
                        },
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      <Feather name="plus-circle" size={16} color="#fff" />
                      <Text
                        style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 }}
                      >
                        Buy More Subscriptions
                      </Text>
                    </Pressable>
                  </ScrollView>
                </View>
              </View>
            );
          })()}

        <VideoRecorderModal
          visible={showRecorder}
          onClose={() => setShowRecorder(false)}
          onVideoRecorded={handleRecordedVideo}
          maxDuration={30}
        />
      </KeyboardAvoidingView>

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
                <Text style={styles.submitProgressText}>{submissionProgress}%</Text>
                <Text style={styles.submitProgressSubtext}>Posting</Text>
              </View>
            </View>
            <Text style={styles.submitOverlayMessage}>
              {validationMessage ||
                (isUploading ? 'Uploading media...' : 'Creating your listing...')}
            </Text>
          </View>
        </View>
      )}

      {/* Location Selection - Full screen overlay (NOT a Modal, avoids Android keyboard bug) */}
      {showLocationModal && (
        <View style={styles.locationOverlay}>
          <View style={styles.locationFullPage}>
            {/* Header bar */}
            <View style={styles.locationHeader}>
              <Pressable
                style={styles.locationBackButton}
                onPress={() => {
                  setShowLocationModal(false);
                  setPincodeSearchInput('');
                  setLocationSuggestions([]);
                  setPincodeSearchError(null);
                  setCoordinateResolveError(null);
                  setCoordinateResolveSuccess(null);
                  setIsResolvingCoordinates(false);
                }}
              >
                <Feather name="arrow-left" size={20} color={Colors.text} />
              </Pressable>
              <Text style={styles.locationHeaderTitle}>Select Location</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            <ScrollView
              style={styles.locationPageContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 120) }}
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
                      onChangeText={(text) => {
                        markLocationAsUserManaged();
                        setLatitudeInput(text);
                      }}
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
                      onChangeText={(text) => {
                        markLocationAsUserManaged();
                        setLongitudeInput(text);
                      }}
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
                      onChangeText={(text) => {
                        markLocationAsUserManaged();
                        setPincode(text.replace(/[^0-9]/g, '').slice(0, 6));
                      }}
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
                      onChangeText={(text) => {
                        markLocationAsUserManaged();
                        setLocationCity(text);
                      }}
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
        </View>
      )}
    </>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: '#F3F6FB',
  },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2F1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  subscriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  plansScrollView: {
    marginBottom: 8,
  },
  planSelector: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    minWidth: 100,
    alignItems: 'center',
  },
  planSelectorActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  planSelectorName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  planSelectorNameActive: {
    color: Colors.primary,
  },
  planSelectorPrice: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  planSelectorPriceActive: {
    color: Colors.primary,
  },

  /* ===== Inline pricing section (below description) ===== */
  inlinePricingSection: {
    marginBottom: 20,
  },
  pricingCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pricingHeader: {
    marginBottom: 12,
  },
  pricingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  pricingSub: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
  },
  pricingNote: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  locationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  locationFullPage: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: 48,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  locationBackButton: {
    padding: 8,
  },
  locationHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  locationPageContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  locationFallbackLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
  },
  screenTitle: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  heroContainer: {
    // Slight overdraw prevents thin edge seams on some device pixel ratios.
    marginHorizontal: -10,
    marginTop: -16,
    marginBottom: 10,
  },
  heroCard: {
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: 'hidden',
    borderWidth: 0,
  },
  heroGlowOrbA: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(56, 189, 248, 0.28)',
    top: -40,
    right: -20,
  },
  heroGlowOrbB: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 184, 166, 0.24)',
    bottom: -28,
    left: -18,
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#A5F3FC',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#DBEAFE',
    lineHeight: 19,
    marginTop: 8,
  },
  heroProgressRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#CFFAFE',
  },
  heroProgressText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#ECFEFF',
  },
  heroMetaRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroMetaText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#ECFEFF',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E1EE',
  },
  typeButtonActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  typeText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  typeTextActive: {
    color: '#fff',
  },
  mediaToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
    backgroundColor: 'rgba(10, 102, 194, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(10, 102, 194, 0.25)',
    minHeight: 88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mediaButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  mediaButtonContent: {
    alignItems: 'center',
    gap: 4,
  },
  mediaIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(10, 102, 194, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaIconContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  mediaText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  mediaTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
    marginBottom: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: Colors.primary,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  aiToolCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  aiToolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiToolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  aiToolTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  aiSmallButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.primary,
    borderRadius: 5,
  },
  aiSmallButtonDisabled: {
    opacity: 0.6,
  },
  aiSmallButtonText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  keywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  keywordText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  priceTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  suggestedPriceLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  suggestedPrice: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
    flex: 1,
  },
  usePriceButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.primary,
    borderRadius: 5,
  },
  usePriceText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  scoreContainer: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginBottom: 8,
    marginTop: -2,
  },
  addVideoButton: {
    width: 88,
    height: 88,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  addVideoText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  addVideoDuration: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#94A3B8',
  },
  videoSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  videoProcessingCard: {
    backgroundColor: '#F0FDFA',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 8,
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  videoProcessingTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.success,
    textAlign: 'center',
  },
  videoProcessingPercent: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#D5E2F0',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D5E2F0',
    marginBottom: 12,
  },
  currency: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginRight: 6,
  },
  priceField: {
    flex: 1,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  unitSelectorInline: {
    marginTop: 4,
  },
  unitInlineLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  unitChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D5E2F0',
  },
  unitChipSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  unitChipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
    // whiteSpace is web-only; removed for RN compatibility
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  offerPriceLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 4,
  },
  offerPriceHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  offerPriceFeedback: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  offerPriceFeedbackValid: {
    backgroundColor: '#ECFDF5',
    borderLeftColor: Colors.success,
  },
  offerPriceFeedbackInvalid: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: Colors.error,
  },
  offerPriceFeedbackText: {
    color: Colors.success,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  offerPriceFeedbackTextInvalid: {
    color: Colors.error,
  },
  imageRow: {
    gap: 8,
    paddingVertical: 2,
  },
  addImageButton: {
    width: 88,
    height: 88,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  addImageText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  imageThumb: {
    width: 88,
    height: 88,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#DBE7F4',
    backgroundColor: '#E2E8F0',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
  },
  aiVerifiedOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#059669',
  },
  aiVerifiedOverlayText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    opacity: 0.9,
  },
  validationInlineBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    gap: 10,
  },
  validationInlineContent: {
    flex: 1,
  },
  validationText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  aiVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  aiVerifiedText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#10B981',
  },
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  validationErrorText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.error,
  },
  validationReason: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  validationSuggestion: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.warning,
    marginTop: 4,
    fontStyle: 'italic',
  },
  compressionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 102, 194, 0.08)',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  compressionContent: {
    flex: 1,
    gap: 6,
  },
  compressionText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  deduplicationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  deduplicationText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.success,
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D5E2F0',
  },
  chipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
  subscriptionBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7E2EF',
    marginTop: 10,
    marginBottom: 4,
  },
  subscriptionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  subscriptionBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subscriptionBannerTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
    marginBottom: 1,
  },
  subscriptionBannerSubtext: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  subscriptionLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  subscriptionLoadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 6,
  },
  subscriptionCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CFE8FF',
  },
  subscriptionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  subscriptionStatusIcon: {
    backgroundColor: '#0284C7',
    borderRadius: 999,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionHeaderTextWrap: {
    flex: 1,
  },
  subscriptionCardTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  subscriptionCardSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  subscriptionSelectButton: {
    backgroundColor: '#0369A1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  subscriptionSelectButtonText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  subscriptionStatsGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subscriptionStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  subscriptionStatDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  subscriptionStatValue: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#0369A1',
  },
  subscriptionStatValueSuccess: {
    color: '#0F766E',
  },
  subscriptionStatValueDark: {
    color: '#0F172A',
  },
  subscriptionStatLabel: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  subscriptionHintBanner: {
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#E0F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subscriptionHintText: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#0369A1',
  },
  subscriptionWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  subscriptionWarningText: {
    color: '#C2410C',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  subscriptionWarningButton: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  subscriptionWarningButtonText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  noSubscriptionCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderStyle: 'dashed' as const,
  },
  noSubscriptionCardPressed: {
    opacity: 0.85,
  },
  noSubscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  noSubscriptionIconWrap: {
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noSubscriptionTextWrap: {
    flex: 1,
  },
  noSubscriptionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  noSubscriptionSubtitle: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginTop: 1,
  },
  noSubscriptionActionPill: {
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  noSubscriptionActionPillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  noSubscriptionStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 7,
    alignItems: 'center',
  },
  noSubscriptionStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  noSubscriptionStatValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
  },
  noSubscriptionStatLabel: {
    marginTop: 1,
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#92400E',
  },
  noSubscriptionStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#FDE68A',
  },
  noSubscriptionFeatureRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  noSubscriptionFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  noSubscriptionFeatureText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#0F172A',
  },
  noSubscriptionFooter: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  noSubscriptionFooterText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#475569',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: '#2563EB',
  },
  submitGradient: {
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 6,
  },
  submitPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  publishPanel: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE6F2',
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  publishPanelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  publishPanelTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  publishPanelCount: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  publishPanelSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  publishWarningRow: {
    marginTop: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  publishWarningText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#92400E',
    lineHeight: 16,
  },
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  authIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 102, 194, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  authButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  authButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  authButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  userInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#DCE7F3',
    gap: 10,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  userPhone: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginTop: 1,
  },
  durationCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationHeader: {
    flex: 1,
  },
  durationLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  durationPrice: {
    flex: 1,
    alignItems: 'flex-end',
  },
  durationType: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  durationFooter: {
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  stepBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  pricingInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 102, 194, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(10, 102, 194, 0.2)',
  },
  pricingInfoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
    lineHeight: 16,
  },
  adminNote: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  mediaSubtext: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
    marginTop: 2,
  },
  mediaSubtextActive: {
    color: 'rgba(255, 255, 255, 0.95)',
  },
  faqCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  faqTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  faqContent: {
    gap: 10,
  },
  faqItem: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  faqQuestion: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  /* ===== Location Selection Styles ===== */
  selectLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D5E2F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    gap: 8,
  },
  selectLocationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#0369A1',
    textAlign: 'center',
  },
  selectedLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationText: {
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#047857',
  },
  locationPincode: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#334155',
    marginTop: 2,
  },
  locationCity: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#475569',
    marginTop: 2,
  },
  changeLocationButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
  },
  changeLocationText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#065F46',
  },

  /* Location Modal Styles */
  locationModalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  locationManualCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 10,
  },
  mapLinkTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  mapActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minHeight: 42,
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  mapApplyButtonDisabled: {
    opacity: 0.55,
  },
  mapApplyButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  pincodeSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  pincodeSearchIcon: {
    marginRight: 10,
  },
  pincodeSearchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
    minHeight: 44,
    paddingVertical: 0,
  },
  pincodeSearchClear: {
    padding: 4,
  },
  searchPincodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    marginBottom: 20,
    gap: 6,
  },
  searchPincodeButtonPressed: {
    opacity: 0.8,
  },
  searchPincodeButtonDisabled: {
    opacity: 0.5,
  },
  searchPincodeButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.error,
  },
  locationSuggestionsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  locationSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  locationSearchLoadingText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  locationSearchEmptyState: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationSearchEmptyStateText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  locationSuggestionsTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  locationSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 12,
  },
  locationSuggestionTextWrap: {
    flex: 1,
  },
  locationSuggestionName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  locationSuggestionMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  locationSuggestionPincode: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  submitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1100,
    elevation: 1100,
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
  validationBanner: {
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  validationGradient: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    position: 'relative',
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0369A1',
    borderRadius: 2,
  },
  validationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  successIconContainer: {
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  validationTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#0C4A6E',
    flex: 1,
  },
  percentageText: {
    fontSize: 20,
    fontFamily: 'Inter_800ExtraBold',
    color: '#0369A1',
    marginLeft: 12,
  },
  validationMessage: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#075985',
    lineHeight: 18,
  },
});
