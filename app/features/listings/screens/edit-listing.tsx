import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { Category, CATEGORIES, CONDITIONS, PriceUnit, PRICE_UNITS } from '@/lib/types';
import UploadProgressBar from '@/shared/components/UploadProgressBar';
import { uploadVideoInChunks, type UploadProgress } from '@/lib/chunked-video-upload';
import { VideoRecorderModal } from '@/shared/components/VideoRecorderModal';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { getApiUrl } from '@/lib/query-client';

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
  const [condition, setCondition] = useState<'new' | 'like_new' | 'good' | 'fair' | 'poor'>(
    listing?.condition || 'good'
  );
  const [locationCity, setLocationCity] = useState(listing?.location?.city || '');
  const [latitude, setLatitude] = useState<number>(listing?.location?.latitude || 0);
  const [longitude, setLongitude] = useState<number>(listing?.location?.longitude || 0);
  const [pincode, setPincode] = useState(listing?.pincode || '');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pincodeSearchInput, setPincodeSearchInput] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [pincodeSearchError, setPincodeSearchError] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [images, setImages] = useState<string[]>(listing?.images || []);
  const [videos, setVideos] = useState<string[]>(listing?.videos || []);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<UploadProgress | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const [showPriceUnitPicker, setShowPriceUnitPicker] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const visibleCategories =
    listingType === 'job'
      ? JOB_CATEGORIES
      : listingType === 'service'
        ? SERVICE_CATEGORIES
        : CATEGORIES;

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

    if (
      uri.startsWith('data:image/') ||
      uri.startsWith('http://') ||
      uri.startsWith('https://') ||
      uri.startsWith('/uploads/') ||
      uri.startsWith('/images/')
    ) {
      return uri;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${getMimeTypeFromUri(uri)};base64,${base64}`;
  };

  useEffect(() => {
    if (listingType === 'job' && !JOB_CATEGORIES.includes(category)) {
      setCategory('Jobs');
    }
    if (listingType === 'service' && !SERVICE_CATEGORIES.includes(category)) {
      setCategory('Services');
    }
  }, [listingType, category]);

  const applyLocationSuggestion = (suggestion: LocationSuggestion) => {
    const cityName = suggestion.locationName?.trim() || suggestion.city?.trim() || 'Unknown';
    setPincode(suggestion.pincode || '');
    setLocationCity(cityName);
    setLatitude(suggestion.latitude || 0);
    setLongitude(suggestion.longitude || 0);
    setPincodeSearchInput('');
    setLocationSuggestions([]);
    setPincodeSearchError(null);
    setShowLocationModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

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
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery access is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      const uploadResult = await uploadVideoInChunks(videoUri, fileName, (progress) => {
        setVideoUploadProgress(progress);
      });

      setVideos([uploadResult.videoUrl]);
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
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
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
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
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

    try {
      const portableImages = (
        await Promise.all(
          images.map(async (uri) => {
            try {
              return await toPortableImageUri(uri);
            } catch (error) {
              console.error('Error converting image before submit:', error);
              return null;
            }
          })
        )
      ).filter(Boolean) as string[];

      if (portableImages.length === 0) {
        Alert.alert('Error', 'Images could not be processed. Please re-add images and try again.');
        setIsSubmitting(false);
        return;
      }

      await updateListing(id, {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        offerPrice: offerPrice ? Number(offerPrice) : undefined,
        priceUnit,
        listingType,
        category,
        condition,
        location: {
          city: locationCity.trim(),
          latitude,
          longitude,
        },
        pincode: pincode.trim() || undefined,
        images: portableImages,
        videos,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Listing updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error updating listing:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                <Text
                  style={[styles.typeText, listingType === 'service' && styles.typeTextActive]}
                >
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
                    <Image source={{ uri: videoThumbnail }} style={styles.videoThumbImage} contentFit="cover" />
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
                {visibleCategories.map((cat) => (
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

          {/* Condition */}
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
                    {cond.value === condition && <Feather name="check" size={20} color="#FFFFFF" />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

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
            <Pressable style={styles.locationCard} onPress={() => setShowLocationModal(true)}>
              <View style={styles.locationCardMain}>
                <Feather name="map-pin" size={16} color={Colors.primary} />
                <View style={styles.locationCardTextWrap}>
                  <Text style={styles.locationTitleText}>
                    {locationCity || 'Choose location'}
                  </Text>
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
              }}
            >
              <Feather name="arrow-left" size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.locationModalTitle}>Select Location</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.locationSearchWrap}>
            <Feather name="search" size={16} color={Colors.textSecondary} />
            <TextInput
              style={styles.locationSearchInput}
              placeholder="Search location or enter 6-digit pincode"
              placeholderTextColor={Colors.textTertiary}
              value={pincodeSearchInput}
              onChangeText={setPincodeSearchInput}
            />
            {pincodeSearchInput.trim().length > 0 && (
              <Pressable onPress={() => setPincodeSearchInput('')}>
                <Feather name="x" size={16} color={Colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {pincodeSearchError ? (
            <Text style={styles.locationErrorText}>{pincodeSearchError}</Text>
          ) : null}

          <ScrollView style={styles.locationResultsList} showsVerticalScrollIndicator={false}>
            {isSearchingLocation ? (
              <View style={styles.locationStateWrap}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.locationStateText}>Searching locations...</Text>
              </View>
            ) : locationSuggestions.length > 0 ? (
              locationSuggestions.map((item) => (
                <Pressable
                  key={`${item.pincode}-${item.locationName}-${item.city}`}
                  style={styles.locationResultItem}
                  onPress={() => applyLocationSuggestion(item)}
                >
                  <Feather name="map-pin" size={16} color={Colors.primary} />
                  <View style={styles.locationResultTextWrap}>
                    <Text style={styles.locationResultTitle}>{item.locationName || item.city}</Text>
                    <Text style={styles.locationResultMeta}>
                      {item.city}
                      {item.state ? `, ${item.state}` : ''} {item.pincode ? `- ${item.pincode}` : ''}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.locationStateWrap}>
                <Feather name="map-pin" size={18} color={Colors.textSecondary} />
                <Text style={styles.locationStateText}>
                  {pincodeSearchInput.trim()
                    ? 'No locations found. Try a different city or pincode.'
                    : 'Type a location name or pincode to search.'}
                </Text>
              </View>
            )}
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
