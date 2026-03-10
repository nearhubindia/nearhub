import React, { useState, useCallback, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import UploadProgressBar from '@/shared/components/UploadProgressBar';
import {
  useAuth,
  isProfileComplete,
  getMissingProfileFields,
} from '@/shared/contexts/auth-context';
import {
  Category,
  CATEGORIES,
  CONDITIONS,
  ValidationResult,
  PriceUnit,
  PRICE_UNITS,
  Listing,
} from '@/lib/types';
import { getApiUrl } from '@/lib/query-client';
import { compressVideoWithProgress, formatBytes } from '@/lib/video-compressor';
import {
  analyzeVideoForS3,
  recommendCompressionForS3,
  compressVideoForS3,
} from '@/lib/video-compressor-s3';
import { uploadVideoInChunks, type UploadProgress } from '@/lib/chunked-video-upload';
import { VideoRecorderModal } from '@/shared/components/VideoRecorderModal';
import {
  compressImagesWithProgress,
  getImageSummary,
  formatBytes as formatImageBytes,
  QUALITY_PRESETS,
} from '@/lib/image-compressor';
import * as ImageStorage from '@/lib/image-storage';
import * as ImageHasher from '@/lib/image-hasher';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { createResponsiveStyles } from '@/lib/responsive';

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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
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

  // Active subscription state
  const [allSubscriptions, setAllSubscriptions] = useState<SubscriptionData[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionData | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionData | null>(null); // For backward compatibility
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [showSubscriptionSelector, setShowSubscriptionSelector] = useState(false);
  const previousSubscriptionCount = useRef(0);
  const selectedSubscriptionRef = useRef<SubscriptionData | null>(null);
  const isFetchingSubscriptionRef = useRef(false);
  const lastSubscriptionFetchAtRef = useRef(0);
  const SUBSCRIPTION_FETCH_THROTTLE_MS = 2000;
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [suggestedPrice, setSuggestedPrice] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
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
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pincodeSearchInput, setPincodeSearchInput] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [pincodeSearchError, setPincodeSearchError] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const pincodeInputRef = useRef<TextInput>(null);

  const visibleCategories =
    listingType === 'job'
      ? JOB_CATEGORIES
      : listingType === 'service'
        ? SERVICE_CATEGORIES
        : CATEGORIES;

  useEffect(() => {
    if (listingType === 'job' && !JOB_CATEGORIES.includes(category)) {
      setCategory('Jobs');
    }
    if (listingType === 'service' && !SERVICE_CATEGORIES.includes(category)) {
      setCategory('Services');
    }
  }, [listingType, category]);

  const applyLocationSuggestion = useCallback((suggestion: LocationSuggestion) => {
    const cityName = suggestion.locationName?.trim() || suggestion.city?.trim() || 'Unknown';

    setPincode(suggestion.pincode || '');
    setLocationCity(cityName);
    setLocationDistrict(suggestion.district || '');
    setLocationState(suggestion.state || '');
    setLatitude(suggestion.latitude);
    setLongitude(suggestion.longitude);
    setPincodeSearchInput('');
    setLocationSuggestions([]);
    setPincodeSearchError(null);
    setShowLocationModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

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

  // Get location details from coordinates via reverse geocoding
  const getLocationDetailsFromCoordinates = useCallback(async (lat: number, lon: number) => {
    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(
        `${apiUrl}/api/location/reverse-geocode?latitude=${lat}&longitude=${lon}`
      );

      if (response.ok) {
        const responseData = await response.json();
        const locationData = responseData.data;

        if (locationData) {
          setPincode(locationData.pincode || '');
          setLocationCity(
            locationData.locationName || locationData.city || locationData.state || 'Unknown'
          );
          setLocationDistrict(locationData.district || '');
          setLocationState(locationData.state || '');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        console.log('Reverse geocode not available, location set to coordinates only');
      }
    } catch (error) {
      console.error('Error getting location details:', error);
      // Silently fail - coordinates are already set
    }
  }, []);

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

        const { latitude: lat, longitude: lon } = location.coords;

        // Set coordinates
        setLatitude(lat);
        setLongitude(lon);
        setLocationCity((prev) => prev || 'Current Location');

        // Try to get location details (pincode, city) from reverse geocoding
        await getLocationDetailsFromCoordinates(lat, lon);

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
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id,
            'x-user-phone': user.phone || '',
          },
          cache: 'no-store',
        });

        const data = await response.json();
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

  const generateDescriptionWithAI = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title first to generate a description.');
      return;
    }

    setIsGeneratingDescription(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/ai/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category: category,
          price: price || 'Not specified',
          condition: condition,
        }),
      });

      const data = await response.json();
      if (data.text) {
        setDescription(data.text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('AI description generation error:', error);
      Alert.alert('Error', 'Failed to generate description. Make sure Ollama is running.');
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [title, category, condition, price]);

  const generateTitleWithAI = useCallback(async () => {
    if (!description.trim()) {
      Alert.alert('Description Required', 'Please enter a description first to generate a title.');
      return;
    }

    setIsGeneratingTitle(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/ai/generate-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          category: category,
        }),
      });

      const data = await response.json();
      if (data.text) {
        setTitle(data.text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('AI title generation error:', error);
      Alert.alert('Error', 'Failed to generate title. Make sure Ollama is running.');
    } finally {
      setIsGeneratingTitle(false);
    }
  }, [description, category]);

  const suggestCategoryWithAI = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title first to get a category suggestion.');
      return;
    }

    setIsSuggestingCategory(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/ai/suggest-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();
      if (data.text) {
        setCategory(data.text as Category);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('AI category suggestion error:', error);
      Alert.alert('Error', 'Failed to suggest category. Make sure Ollama is running.');
    } finally {
      setIsSuggestingCategory(false);
    }
  }, [title, description]);

  const extractKeywordsWithAI = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title first to extract keywords.');
      return;
    }

    setIsExtractingKeywords(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/ai/extract-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();
      if (data.keywords && Array.isArray(data.keywords)) {
        setKeywords(data.keywords);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('AI keyword extraction error:', error);
      Alert.alert('Error', 'Failed to extract keywords. Make sure Ollama is running.');
    } finally {
      setIsExtractingKeywords(false);
    }
  }, [title, description]);

  const suggestPriceWithAI = useCallback(async () => {
    if (!title.trim() || !category) {
      Alert.alert('Info Required', 'Please enter a title and select a category first.');
      return;
    }

    setIsSuggestingPrice(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Simulate AI pricing based on category and condition
      // In production, this could call a backend ML model
      const basePrices: { [key: string]: number } = {
        Electronics: 25000,
        Vehicles: 500000,
        'Real Estate': 5000000,
        Services: 0,
        Jobs: 0,
        Furniture: 15000,
        Clothing: 2000,
        'Home & Garden': 10000,
        Sports: 5000,
        Education: 0,
        Pets: 20000,
        Other: 10000,
      };

      const base = basePrices[category] || 10000;
      const conditionMultiplier =
        {
          new: 1.0,
          like_new: 0.85,
          good: 0.7,
          fair: 0.5,
          poor: 0.3,
        }[condition] || 0.7;

      const suggested = Math.round(base * conditionMultiplier);
      setSuggestedPrice(suggested.toLocaleString('en-IN'));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('AI pricing suggestion error:', error);
      Alert.alert('Error', 'Failed to suggest price.');
    } finally {
      setIsSuggestingPrice(false);
    }
  }, [category, condition, title]);

  const calculateQualityScore = useCallback(async () => {
    let score = 0;
    let messages: string[] = [];

    // Title quality (max 20 points)
    if (title.length > 30 && title.length < 80) {
      score += 20;
    } else if (title.length > 10) {
      score += 10;
      messages.push('Title could be more descriptive');
    } else {
      messages.push('Title is too short');
    }

    // Description quality (max 25 points)
    if (description.length > 100) {
      score += 25;
    } else if (description.length > 50) {
      score += 15;
      messages.push('Add more details to description');
    } else {
      messages.push('Description is too short');
    }

    // Image/Video (max 20 points)
    if (mediaType === 'video' && videoUri) {
      score += 20;
    } else if (images.length >= 3) {
      score += 20;
    } else if (images.length >= 1) {
      score += 10;
      messages.push('Add more images');
    } else {
      messages.push('Add image or video');
    }

    // Price (max 15 points)
    if (price && !isNaN(Number(price))) {
      score += 15;
    } else {
      messages.push('Enter a valid price');
    }

    // Category (max 10 points)
    if (category && category !== 'Other') {
      score += 10;
    } else {
      messages.push('Select specific category');
    }

    // Condition (max 10 points)
    if (condition !== 'fair' && condition !== 'poor') {
      score += 10;
    }

    setQualityScore(Math.min(100, score));

    if (messages.length > 0) {
      Alert.alert(
        'Listing Quality',
        `Score: ${Math.min(100, score)}/100\n\n${messages.join('\n')}`
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Perfect Listing!', `Quality Score: ${Math.min(100, score)}/100`, [
        { text: 'Great!' },
      ]);
    }
  }, [title, description, images, videoUri, mediaType, price, category, condition]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const bottomCtaSafeSpacing = Platform.OS === 'web' ? 34 : 86;

  const convertBlobUrlToBase64 = async (uri: string): Promise<string> => {
    try {
      console.log('[Create] Converting blob URL to base64:', uri);
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log('[Create] Blob converted to base64, length:', base64.length);
          resolve(base64);
        };
        reader.onerror = (error) => {
          console.error('[Create] FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('[Create] Error converting blob to base64:', error);
      // Return a placeholder or throw error instead of falling back to blob
      throw new Error('Failed to convert blob URL to base64');
    }
  };

  const getMimeTypeFromUri = (uri: string): string => {
    const lower = uri.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
    return 'image/jpeg';
  };

  const toPortableImageUri = async (uri: string): Promise<string> => {
    if (!uri) return uri;

    // Already portable
    if (
      uri.startsWith('data:image/') ||
      uri.startsWith('http://') ||
      uri.startsWith('https://') ||
      uri.startsWith('/uploads/') ||
      uri.startsWith('/images/')
    ) {
      return uri;
    }

    if (uri.startsWith('blob:')) {
      return await convertBlobUrlToBase64(uri);
    }

    // Convert device-local URIs (file://, content://, ph://, assets-library://) to data URI
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:${getMimeTypeFromUri(uri)};base64,${base64}`;
    } catch (readError) {
      console.warn('[Create] FileSystem read failed, trying fetch fallback:', readError);
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (fallbackError) {
        console.error('[Create] Failed to make image portable:', fallbackError);
        throw new Error('Unable to process selected image for upload');
      }
    }
  };

  const pickImage = useCallback(
    async (useCamera: boolean) => {
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
            Alert.alert('Processing Image', 'Optimizing image for faster upload...');

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

              // Show compression summary with dedup info
              const summary = getImageSummary(compressedResults[0]);
              const dedupMsg = duplicateHash ? '\n✓ Duplicate detected - storage optimized!' : '';
              Alert.alert('Image Optimized', summary + dedupMsg, [{ text: 'OK' }]);

              // Validate the image using base64
              if (asset.base64) {
                validateImage(asset.base64);
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

            Alert.alert('Processing Info', 'Using original image.', [{ text: 'OK' }]);
            setImages((prev) => [...prev, finalImageData]);
            if (asset.base64) {
              validateImage(asset.base64);
            }
          } finally {
            setIsCompressingImages(false);
            setImageCompressionProgress(null);
          }
        }
      } catch (e) {
        console.error('Image picker error:', e);
        setIsCompressingImages(false);
      }
    },
    [title, category, description]
  );

  const validateImage = async (base64: string) => {
    // Require title + category before calling remote validation on web
    if (!title.trim() || !category) {
      // Skip validation if required metadata isn't present yet
      return;
    }

    // Run validation in background (non-blocking) with timeout
    setIsValidating(true);
    setValidationResult(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const baseUrl = await getApiUrl();
      const url = new URL('/api/validate-listing', baseUrl);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title,
          description,
          isVideo: false,
        }),
        signal: controller.signal,
      });

      const data = await res.json();

      // Also check with local AI moderation if available
      if (title.trim()) {
        try {
          const modRes = await fetch(`${baseUrl}/api/ai/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
            }),
            signal: controller.signal,
          });
          const modData = await modRes.json();

          // Combine results
          if (modData.flagged) {
            data.isAppropriate = false;
            data.suggestion = `AI flagged: ${modData.reason}`;
          }
        } catch (e) {
          console.log('Local AI moderation not available, using Phi2 validation');
        }
      }

      // Always mark as valid for user's own listings (validation is advisory only)
      const validationResult = {
        ...data,
        isValid: true, // Allow all uploads - validation is informational
        isAppropriate: data.isAppropriate !== false, // Only flag if explicitly set
      };

      setValidationResult(validationResult);
      Haptics.notificationAsync(
        validationResult.isAppropriate
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    } catch (e) {
      console.error('Validation error:', e);
      // Always allow upload - validation is non-blocking
      setValidationResult({
        isValid: true,
        isAppropriate: true,
        matchesCategory: true,
        confidence: 0.5,
        detectedItems: [],
        suggestion: '',
        reason: 'Validation completed',
      });
    } finally {
      clearTimeout(timeout);
      setIsValidating(false);
    }
  };

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

    if (images.length <= 1) {
      setValidationResult(null);
    }
  };

  const validateVideoFrame = async (videoUri: string) => {
    setIsValidating(true);
    setValidationResult(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      let base64Data: string | undefined;
      let videoDurationMs: number | undefined;

      if (Platform.OS !== 'web') {
        try {
          console.log('[Create] Generating video thumbnail from:', videoUri);
          const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: 1000,
            quality: 0.7,
          });
          console.log('[Create] Thumbnail generated:', thumbUri);

          videoDurationMs = undefined; // duration field removed in expo-video-thumbnails SDK 54+

          const thumbBase64 = await FileSystem.readAsStringAsync(thumbUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log('[Create] Thumbnail converted to base64, length:', thumbBase64.length);
          base64Data = thumbBase64;
        } catch (thumbnailError) {
          console.error('[Create] Thumbnail generation failed:', thumbnailError);
          // Continue without thumbnail validation
          base64Data = undefined;
        }
      }

      if (!base64Data) {
        console.log('[Create] Skipping video validation (no thumbnail available)');
        setValidationResult({
          isValid: true,
          isAppropriate: true,
          matchesCategory: true,
          confidence: 0.5,
          detectedItems: [],
          suggestion: '',
          reason: 'Video frame validation not available',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      console.log('[Create] Validating video with API...');
      const baseUrl = await getApiUrl();
      const url = new URL('/api/validate-listing', baseUrl);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: `data:image/jpeg;base64,${base64Data}`,
          category,
          title,
          description,
          isVideo: true,
          videoDuration: videoDurationMs,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      console.log('[Create] Video validation result:', data);

      // Also check with local AI moderation if available
      if (title.trim()) {
        try {
          const modRes = await fetch(`${baseUrl}/api/ai/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
            }),
            signal: controller.signal,
          });
          const modData = await modRes.json();

          // Combine results
          if (modData.flagged) {
            data.isAppropriate = false;
            data.suggestion = `AI flagged video: ${modData.reason}`;
          }
        } catch (e) {
          console.log('[Create] Local AI moderation not available, using Phi2 validation');
        }
      }

      // Always mark as valid for user's own videos (validation is advisory only)
      const validationResult = {
        ...data,
        isValid: true, // Allow all uploads - validation is informational
        isAppropriate: data.isAppropriate !== false, // Only flag if explicitly set
      };

      setValidationResult(validationResult);
      Haptics.notificationAsync(
        validationResult.isAppropriate
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    } catch (e) {
      console.error('[Create] Video validation error:', e);
      // Always allow upload - validation is non-blocking
      setValidationResult({
        isValid: true,
        isAppropriate: true,
        matchesCategory: true,
        confidence: 0.5,
        detectedItems: [],
        suggestion: '',
        reason: 'Validation completed',
      });
    } finally {
      clearTimeout(timeout);
      setIsValidating(false);
    }
  };

  const handleRecordedVideo = useCallback(async (recordedUri: string) => {
    try {
      console.log('[Create] Received recorded video URI:', recordedUri);

      // Compress the recorded video
      setIsCompressing(true);
      setCompressionProgress(0);

      Alert.alert(
        'Compressing Video',
        'Processing your recorded video for optimal quality and faster upload...'
      );

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

      Alert.alert(
        'Video Ready',
        `Original: ${formatBytes(compressedResult.originalSize)}\nCompressed: ${formatBytes(compressedResult.compressedSize)}\nSaved: ${formatBytes(compressedResult.originalSize - compressedResult.compressedSize)}`,
        [{ text: 'OK' }]
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      validateVideoFrame(compressedResult.uri);
    } catch (compressionError) {
      console.error('[Create] Video compression error:', compressionError);
      Alert.alert('Compression Info', 'Using original video quality.', [{ text: 'OK' }]);
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

      validateVideoFrame(recordedUri);
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
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
          Alert.alert(
            'Compressing Video',
            'Processing your video for optimal quality and faster upload...'
          );

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

          // Show compression summary
          Alert.alert(
            'Video Ready',
            `Original: ${formatBytes(compressedResult.originalSize)}\nCompressed: ${formatBytes(compressedResult.compressedSize)}\nSaved: ${formatBytes(compressedResult.originalSize - compressedResult.compressedSize)}`,
            [{ text: 'OK' }]
          );

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          validateVideoFrame(compressedResult.uri);
        } catch (compressionError) {
          console.error('Video compression error:', compressionError);
          // Fall back to original video if compression fails
          Alert.alert('Compression Info', 'Using original video quality.', [{ text: 'OK' }]);
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

          validateVideoFrame(uri);
        } finally {
          setIsCompressing(false);
          setCompressionProgress(0);
        }
      }
    } catch (e) {
      console.error('Video picker error:', e);
      setIsCompressing(false);
    }
  }, [title, category, description]);

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
      'isValidating:',
      isValidating,
      'validationResult:',
      validationResult,
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
    if (validationResult && validationResult.isAppropriate === false) {
      Alert.alert(
        'Content Issue',
        'This image was flagged as inappropriate. Please use a different image.'
      );
      return;
    }

    setIsSubmitting(true);
    setIsUploading(false);
    setUploadProgress(null);
    setOverallProgress(10); // Starting
    setValidationMessage('🛡️ AI is verifying your content for quality and safety...');
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

      // Ensure images are portable across devices (avoid file:// or content:// in DB)
      listingImages = await Promise.all(listingImages.map((uri) => toPortableImageUri(uri)));

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
        const uploadResult = await uploadVideoInChunks(
          videoUri,
          fileName,
          (progress) => {
            console.log(
              `Upload progress: ${progress.progress}% (${progress.chunksUploaded}/${progress.totalChunks})`
            );
            setUploadProgress(progress);
            // Map video upload progress to 20-70% of overall progress
            setOverallProgress(20 + Math.floor(progress.progress * 0.5));
          },
          (error) => {
            console.error('Upload error:', error);
            setValidationMessage('⚠️ Video upload failed. Please try again.');
          }
        );

        finalVideoUrl = uploadResult.videoUrl;
        console.log(
          '[Create] Video upload result:',
          JSON.stringify({ success: !!uploadResult, videoUrl: uploadResult.videoUrl }, null, 2)
        );
        console.log('[Create] finalVideoUrl set to:', finalVideoUrl);
        setIsUploading(false);
        setOverallProgress(70);
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
          userId: user?.id || user?.phone || '',
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
          aiValidated: !!validationResult?.isValid,
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

      Alert.alert(
        'Submitted!',
        'Your listing was submitted successfully and is pending admin approval.',
        [
        {
          text: 'OK',
          onPress: () => {
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
            setValidationResult(null);
            // Navigate to home page
            router.replace('/(tabs)');
          },
        },
      ]
      );
    } catch (e) {
      const error = e as any;
      console.error('[Create] Listing creation error:', error);

      // Check if it's an AI validation error
      if (error?.code === 'INAPPROPRIATE_CONTENT') {
        const violations = error.details?.violations?.join(', ') || 'inappropriate content';
        Alert.alert(
          '🛡️ Content Safety Check Failed',
          `Your image contains ${violations}. Our AI detected content that violates our community guidelines.\n\nPlease use different images that comply with our policies.`,
          [{ text: 'Got It' }]
        );
      } else if (error?.code === 'INAPPROPRIATE_VIDEO_CONTENT') {
        const violations = error.details?.violations?.join(', ') || 'inappropriate content';
        Alert.alert(
          '🛡️ Video Safety Check Failed',
          `Your video contains ${violations}. Please upload a different video that complies with our community guidelines.`,
          [{ text: 'Got It' }]
        );
      } else if (
        error?.code === 'VIDEO_MODERATION_UNAVAILABLE' ||
        error?.code === 'VIDEO_SOURCE_UNSUPPORTED'
      ) {
        Alert.alert(
          'Video Moderation Unavailable',
          'We could not verify this video right now. Please try uploading again in a few minutes.',
          [{ text: 'OK' }]
        );
      } else if (error?.code === 'PRODUCT_IMAGE_MISMATCH') {
        Alert.alert(
          '🔍 Product Verification Failed',
          error.message ||
            "Your image doesn't match the product you're selling. Please upload correct product images.",
          [{ text: 'Update Images' }]
        );
      } else if (
        error?.code === 'DAILY_LISTING_LIMIT_REACHED' ||
        error?.code === 'RATE_LIMIT_EXCEEDED' ||
        error?.message?.includes('HTTP 429')
      ) {
        showDailyLimitAlert(error);
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

    // Check for active subscription
    if (!selectedSubscription || !selectedSubscription.tier) {
      Alert.alert(
        'Subscription Required',
        'You need an active subscription to create listings. Subscribe to a plan to get started.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: () => router.push('/subscriptions'),
          },
        ]
      );
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
          <Text style={styles.screenTitle}>Create Listing</Text>

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
                  {validationResult &&
                    validationResult.isValid &&
                    validationResult.isAppropriate && (
                      <View style={styles.aiVerifiedOverlay}>
                        <Text style={styles.aiVerifiedOverlayText}>✓ AI Verified</Text>
                      </View>
                    )}
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

            {isValidating && (
              <View style={styles.validationInlineBanner}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.validationText}>AI is analyzing your image...</Text>
              </View>
            )}

            {validationResult && !isValidating && !validationResult.isValid && (
              <View
                style={[
                  styles.validationInlineBanner,
                  { backgroundColor: '#FEF2F2', marginTop: 10 },
                ]}
              >
                <View style={styles.validationInlineContent}>
                  <View style={styles.validationError}>
                    <Feather name="alert-triangle" size={16} color={Colors.error} />
                    <Text style={styles.validationErrorText}>Please upload a valid image</Text>
                  </View>
                  <Text style={styles.validationReason}>{validationResult.reason}</Text>
                  {validationResult.suggestion ? (
                    <Text style={styles.validationSuggestion}>{validationResult.suggestion}</Text>
                  ) : null}
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
              <View
                style={[styles.videoSelected, { justifyContent: 'center', alignItems: 'center' }]}
              >
                <ActivityIndicator
                  size="large"
                  color={Colors.primary}
                  style={{ marginBottom: 12 }}
                />
                <Text style={styles.videoFileName}>Compressing video...</Text>
                <Text style={styles.addVideoDuration}>{compressionProgress}%</Text>
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
                <Pressable
                  style={[styles.addVideoButton, { width: 80, height: 80 }]}
                  onPress={() => setShowRecorder(true)}
                >
                  <Feather name="camera" size={18} color="#fff" />
                  <Text style={styles.addImageText}>Record</Text>
                </Pressable>
                <Pressable
                  style={[styles.addVideoButton, { width: 80, height: 80 }]}
                  onPress={pickVideo}
                >
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
                        setValidationResult(null);
                      }}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.accent} />
                    </Pressable>
                    {validationResult &&
                      validationResult.isValid &&
                      validationResult.isAppropriate && (
                        <View style={styles.aiVerifiedOverlay}>
                          <Text style={styles.aiVerifiedOverlayText}>✓ AI Verified</Text>
                        </View>
                      )}
                  </View>
                )}
              </ScrollView>
            )}

            {isValidating && (
              <View style={[styles.validationInlineBanner, { marginTop: 12 }]}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.validationText}>AI is analyzing your video...</Text>
              </View>
            )}

            {validationResult && !isValidating && !validationResult.isValid && (
              <View
                style={[
                  styles.validationInlineBanner,
                  { marginTop: 12, backgroundColor: '#FEF2F2' },
                ]}
              >
                <View style={styles.validationInlineContent}>
                  <View style={styles.validationError}>
                    <Feather name="alert-triangle" size={16} color={Colors.error} />
                    <Text style={styles.validationErrorText}>Please upload a valid video</Text>
                  </View>
                  <Text style={styles.validationReason}>{validationResult.reason}</Text>
                  {validationResult.suggestion ? (
                    <Text style={styles.validationSuggestion}>{validationResult.suggestion}</Text>
                  ) : null}
                </View>
              </View>
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
              placeholder="What are you selling?"
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

            {/* AI Price Suggestion */}
            {category && (
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  style={[styles.aiButton, isSuggestingPrice && styles.aiButtonDisabled]}
                  onPress={suggestPriceWithAI}
                  disabled={isSuggestingPrice}
                >
                  {isSuggestingPrice ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="zap" size={14} color="#fff" />
                      <Text style={styles.aiButtonText}>Suggest Price</Text>
                    </>
                  )}
                </Pressable>
                {suggestedPrice && (
                  <Pressable
                    onPress={() => {
                      setPrice(suggestedPrice.replace(/,/g, ''));
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#EFF6FF',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>
                      ₹{suggestedPrice}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Use</Text>
                  </Pressable>
                )}
              </View>
            )}

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
                  style={{
                    marginTop: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: Number(offerPrice) >= Number(price) ? '#FEF2F2' : '#ECFDF5',
                    borderRadius: 8,
                    borderLeftWidth: 3,
                    borderLeftColor:
                      Number(offerPrice) >= Number(price) ? Colors.error : Colors.success,
                  }}
                >
                  {Number(offerPrice) >= Number(price) ? (
                    <Text style={{ color: Colors.error, fontSize: 12, fontWeight: '600' }}>
                      {listingType === 'job'
                        ? '⚠️ Incentives must be less than or equal to salary'
                        : '⚠️ Offer price must be less than listed price'}
                    </Text>
                  ) : (
                    <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>
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
                  setShowLocationModal(true);
                }}
              >
                <Feather name="map-pin" size={16} color={Colors.primary} />
                <Text style={styles.selectLocationText}>Select Location</Text>
                <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>

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

          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>9</Text>
                </View>
                <Text style={styles.sectionLabel}>Description</Text>
              </View>
              <Pressable
                style={[styles.aiButton, isGeneratingDescription && styles.aiButtonDisabled]}
                onPress={generateDescriptionWithAI}
                disabled={isGeneratingDescription}
              >
                {isGeneratingDescription ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="zap" size={14} color="#fff" />
                    <Text style={styles.aiButtonText}>Generate</Text>
                  </>
                )}
              </Pressable>
            </View>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              onAIGenerate={generateDescriptionWithAI}
              isGenerating={isGeneratingDescription}
              placeholder="Describe your item... (up to 800 characters)"
            />
          </View>

          {/* Subscription Status */}
          <View style={styles.section}>
            {isLoadingSubscription ? (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                  Checking subscription...
                </Text>
              </View>
            ) : allSubscriptions.length > 0 ? (
              /* Active subscription banner */
              <View
                style={{
                  backgroundColor: '#E8F4FD',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: Colors.primary + '30',
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}
                >
                  <View
                    style={{
                      backgroundColor: Colors.primary,
                      borderRadius: 12,
                      width: 22,
                      height: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="check" size={13} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>
                        {allSubscriptions.length > 1
                          ? `Active Subscriptions (${allSubscriptions.length})`
                          : `${allSubscriptions[0]?.tier?.name} Plan Active`}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 1 }}>
                      {allSubscriptions.length > 1
                        ? 'Combined listing quota from all plans'
                        : `Expires ${new Date(allSubscriptions[0]?.expiresAt || new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </Text>
                  </View>
                  {allSubscriptions.length > 1 && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowSubscriptionSelector(true);
                      }}
                      style={{
                        backgroundColor: Colors.primary,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Select</Text>
                    </Pressable>
                  )}
                </View>

                {/* Stats - Show consolidated across ALL subscriptions */}
                {(() => {
                  // Always show ALL subscriptions consolidated
                  const isMultiple = allSubscriptions.length > 1;

                  // Calculate consolidated stats across ALL subscriptions
                  let totalUsed = 0;
                  let totalAvailable = 0;
                  let totalLimit = 0;
                  let isUnlimited = false;

                  allSubscriptions.forEach((sub) => {
                    if (sub.tier) {
                      totalUsed += sub.listingsUsed;
                      if (sub.tier.maxListings === -1) {
                        isUnlimited = true;
                      } else {
                        totalLimit += sub.tier.maxListings;
                        totalAvailable += sub.tier.maxListings - sub.listingsUsed;
                      }
                    }
                  });

                  return (
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: '#fff',
                        borderRadius: 8,
                        padding: 8,
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.primary }}>
                          {totalUsed}
                        </Text>
                        <Text style={{ fontSize: 10, color: Colors.textSecondary }}>
                          {isMultiple ? 'Total Used' : 'Used'}
                        </Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: Colors.border }} />
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.success }}>
                          {isUnlimited ? '∞' : totalAvailable}
                        </Text>
                        <Text style={{ fontSize: 10, color: Colors.textSecondary }}>
                          {isMultiple ? 'Total Left' : 'Available'}
                        </Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: Colors.border }} />
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
                          {isUnlimited ? '∞' : totalLimit}
                        </Text>
                        <Text style={{ fontSize: 10, color: Colors.textSecondary }}>
                          {isMultiple ? 'Combined' : 'Per Plan'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Info note when user has multiple subscriptions */}
                {allSubscriptions.length > 1 && (
                  <View
                    style={{
                      backgroundColor: '#F0F7FF',
                      borderRadius: 6,
                      padding: 8,
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontSize: 10, color: Colors.primary, textAlign: 'center' }}>
                      💡 Showing combined stats for all {allSubscriptions.length} subscriptions. Tap
                      "Select" to choose one.
                    </Text>
                  </View>
                )}

                {/* Full subscription warning */}
                {(() => {
                  // Check if ALL subscriptions combined have available quota
                  let totalAvailable = 0;
                  let hasUnlimited = false;

                  allSubscriptions.forEach((sub) => {
                    if (sub.tier) {
                      if (sub.tier.maxListings === -1) {
                        hasUnlimited = true;
                      } else {
                        totalAvailable += sub.tier.maxListings - sub.listingsUsed;
                      }
                    }
                  });

                  const isFull = !hasUnlimited && totalAvailable <= 0;

                  return isFull ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 8,
                        gap: 6,
                        backgroundColor: '#FFF3E0',
                        borderRadius: 6,
                        padding: 8,
                      }}
                    >
                      <Feather name="alert-triangle" size={12} color="#F57C00" />
                      <Text style={{ color: '#F57C00', fontSize: 11, flex: 1 }}>
                        {allSubscriptions.length > 1
                          ? `All ${allSubscriptions.length} subscriptions are full. Upgrade to create more listings.`
                          : "You've reached your listing limit. Upgrade to create more."}
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push('/subscriptions');
                        }}
                        style={{
                          backgroundColor: '#F57C00',
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 5,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                          Upgrade
                        </Text>
                      </Pressable>
                    </View>
                  ) : null;
                })()}
              </View>
            ) : (
              /* No subscription prompt */
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/subscriptions');
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: '#FFF8E1',
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1.5,
                    borderColor: '#FFD54F',
                    borderStyle: 'dashed' as const,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
                >
                  <View
                    style={{
                      backgroundColor: '#FFD54F',
                      borderRadius: 12,
                      width: 26,
                      height: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="shopping-bag" size={14} color="#F57C00" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>
                      Subscription Required
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 1 }}>
                      Subscribe to a plan to start creating listings
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#F57C00" />
                </View>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    padding: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Feather name="star" size={12} color={Colors.primary} />
                  <Text style={{ fontSize: 12, color: Colors.text, flex: 1 }}>
                    Plans start at affordable prices with features like featured listings, video
                    uploads & more
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

          {/* Subscription Plans Banner - only show if no subscription */}
          {allSubscriptions.length === 0 && !isLoadingSubscription && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/subscriptions' as any);
              }}
              style={({ pressed }) => [styles.subscriptionBanner, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.subscriptionBannerContent}>
                <View style={styles.subscriptionBannerLeft}>
                  <Feather name="star" size={16} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subscriptionBannerTitle}>Get a Subscription</Text>
                    <Text style={styles.subscriptionBannerSubtext}>
                      Subscribe to create listings & unlock premium features
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.primary} />
              </View>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitPressed,
              (isSubmitting || isValidating) && styles.submitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || isValidating}
          >
            <LinearGradient
              colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
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

          {/* AI Validation & Upload Progress Banner */}
          {(isValidating || isSubmitting || validationMessage) && (
            <View style={styles.validationBanner}>
              <LinearGradient
                colors={
                  overallProgress === 100
                    ? ['#DCFCE7', '#BBF7D0', '#86EFAC']
                    : ['#E0F2FE', '#BAE6FD', '#7DD3FC']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.validationGradient}
              >
                {/* Progress Bar Background */}
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${overallProgress}%` }]} />
                </View>

                <View style={styles.validationContent}>
                  {overallProgress < 100 ? (
                    <ActivityIndicator size="small" color="#0369A1" style={{ marginRight: 12 }} />
                  ) : (
                    <View style={styles.successIconContainer}>
                      <Feather name="check-circle" size={20} color="#16A34A" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.validationTitle}>
                        {overallProgress === 100
                          ? '✅ Listing Posted Successfully!'
                          : isValidating
                            ? '🤖 AI Validation in Progress'
                            : isUploading
                              ? '⬆️ Uploading Content'
                              : '✨ Creating Your Listing'}
                      </Text>
                      <Text style={styles.percentageText}>{overallProgress}%</Text>
                    </View>
                    <Text style={styles.validationMessage}>
                      {validationMessage ||
                        (isValidating
                          ? 'Checking content quality and safety...'
                          : isSubmitting
                            ? 'Almost ready to publish!'
                            : 'Please wait...')}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}
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
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <Text style={styles.locationDescription}>Enter City or Pincode</Text>

              {/* Pincode Search Input */}
              <View style={styles.pincodeSearchContainer}>
                <Feather
                  name="map-pin"
                  size={18}
                  color={Colors.primary}
                  style={styles.pincodeSearchIcon}
                />
                <TextInput
                  ref={pincodeInputRef}
                  style={styles.pincodeSearchInput}
                  placeholder="Enter City or Pincode"
                  placeholderTextColor={Colors.textTertiary}
                  value={pincodeSearchInput}
                  onChangeText={setPincodeSearchInput}
                  autoFocus={true}
                />
                {pincodeSearchInput.trim().length > 0 && (
                  <Pressable
                    onPress={() => {
                      setPincodeSearchInput('');
                      setLocationSuggestions([]);
                      setPincodeSearchError(null);
                    }}
                    style={styles.pincodeSearchClear}
                  >
                    <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              {/* Error Message */}
              {pincodeSearchError && (
                <View style={styles.errorBanner}>
                  <Feather name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.errorText}>{pincodeSearchError}</Text>
                </View>
              )}

              <View style={styles.locationSuggestionsCard}>
                {isSearchingLocation ? (
                  <View style={styles.locationSearchLoading}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.locationSearchLoadingText}>Searching locations...</Text>
                  </View>
                ) : null}

                {locationSuggestions.length > 0 ? (
                  locationSuggestions.map((item) => (
                    <Pressable
                      key={`${item.pincode}-${item.locationName}-${item.city}`}
                      style={styles.locationSuggestionItem}
                      onPress={() => applyLocationSuggestion(item)}
                    >
                      <View style={styles.locationSuggestionTextWrap}>
                        <Text style={styles.locationSuggestionName}>
                          {item.locationName || item.city}
                        </Text>
                        <Text style={styles.locationSuggestionMeta}>
                          {item.district ? `${item.district}, ${item.state}` : item.state}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.locationSearchEmptyState}>
                    <Text style={styles.locationSearchEmptyStateText}>
                      {pincodeSearchInput.trim().length === 0
                        ? 'Type location or pincode to search'
                        : /^\d+$/.test(pincodeSearchInput.trim()) &&
                            pincodeSearchInput.trim().length < 6
                          ? 'Enter full 6-digit pincode'
                          : !/^\d+$/.test(pincodeSearchInput.trim()) &&
                              pincodeSearchInput.trim().length < 2
                            ? 'Type at least 2 letters to search city'
                            : 'No matching locations found'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Coverage Info */}
              <View style={styles.coverageInfoBox}>
                <View style={styles.coverageIconContainer}>
                  <Feather name="map-pin" size={16} color={Colors.success} />
                </View>
                <View style={styles.coverageTextContainer}>
                  <Text style={styles.coverageTitle}>Listing Coverage</Text>
                  <Text style={styles.coverageText}>
                    Your listing will be shown to buyers within 100 km from your selected location.
                  </Text>
                </View>
              </View>

              {/* Info */}
              <View style={styles.locationInfoBox}>
                <Feather name="info" size={16} color={Colors.primary} />
                <Text style={styles.locationInfoText}>
                  Provide your location (or pincode) to help buyers find your listing nearby.
                </Text>
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
    backgroundColor: Colors.background,
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
  locationDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  content: {
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 20,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  typeButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 6,
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
    color: Colors.textTertiary,
    marginBottom: 10,
    marginTop: -4,
  },
  addVideoButton: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
  },
  addVideoText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  addVideoDuration: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  videoSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  videoFileName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.success,
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
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
  imageRow: {
    gap: 8,
    paddingVertical: 4,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
  },
  addImageText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#fff',
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
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
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginTop: 10,
    marginBottom: 4,
  },
  subscriptionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  subscriptionBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subscriptionBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 1,
  },
  subscriptionBannerSubtext: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  submitButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 10,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
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
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
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
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 102, 194, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  userPhone: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
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
    gap: 8,
    marginBottom: 8,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 8,
  },
  selectLocationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
    textAlign: 'center',
  },
  selectedLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1.2,
    borderColor: Colors.success,
    borderRadius: 10,
    paddingVertical: 10,
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
    fontFamily: 'Inter_600SemiBold',
    color: Colors.success,
  },
  locationPincode: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  locationCity: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  changeLocationButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  changeLocationText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },

  /* Location Modal Styles */
  locationModalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
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
  coverageInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1.5,
    borderColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 12,
    gap: 12,
  },
  coverageIconContainer: {
    paddingTop: 2,
  },
  coverageTextContainer: {
    flex: 1,
  },
  coverageTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.success,
    marginBottom: 2,
  },
  coverageText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  locationInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(10, 102, 194, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(10, 102, 194, 0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
    gap: 10,
  },
  locationInfoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 16,
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
