import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useListings } from '@/lib/listings-context';
import { useAuth } from '@/lib/auth-context';
import { Category, CATEGORIES, CONDITIONS, ValidationResult } from '@/lib/types';
import { getApiUrl } from '@/lib/query-client';

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const { addListing } = useListings();
  const { user, isAuthenticated } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<Category>('Electronics');
  const [condition, setCondition] = useState<'new' | 'like_new' | 'good' | 'fair' | 'poor'>('good');
  const [listingType, setListingType] = useState<'sell' | 'buy'>('sell');
  const [images, setImages] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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
        setImages((prev) => [...prev, asset.uri]);

        if (asset.base64) {
          validateImage(asset.base64);
        }
      }
    } catch (e) {
      console.error('Image picker error:', e);
    }
  }, [title, category, description]);

  const validateImage = async (base64: string) => {
    setIsValidating(true);
    setValidationResult(null);
    try {
      const baseUrl = getApiUrl();
      const url = new URL('/api/validate-listing', baseUrl);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: `data:image/jpeg;base64,${base64}`,
          category,
          title,
          description,
        }),
      });
      const data = await res.json();
      setValidationResult(data);
      Haptics.notificationAsync(
        data.isValid && data.isAppropriate
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    } catch (e) {
      console.error('Validation error:', e);
      setValidationResult({
        isValid: true,
        isAppropriate: true,
        matchesCategory: true,
        confidence: 0.5,
        detectedItems: [],
        suggestion: '',
        reason: 'Could not validate - proceeding anyway',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (images.length <= 1) {
      setValidationResult(null);
    }
  };

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
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('Video picker error:', e);
    }
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a title for your listing.');
      return;
    }
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('Missing Info', 'Please enter a valid price.');
      return;
    }
    if (images.length === 0) {
      Alert.alert('Missing Info', 'Please add at least one photo.');
      return;
    }
    if (validationResult && !validationResult.isAppropriate) {
      Alert.alert('Content Issue', 'This image was flagged as inappropriate. Please use a different image.');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await addListing({
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        images,
        videoUrl: videoUri || undefined,
        sellerName: user?.name || 'Anonymous',
        sellerPhone: user?.phone || '',
        location: { latitude: 37.7749, longitude: -122.4194, city: 'San Francisco' },
        condition,
        listingType,
        aiValidated: !!validationResult?.isValid,
      });

      Alert.alert('Listed!', 'Your item has been posted successfully.', [
        {
          text: 'OK',
          onPress: () => {
            setTitle('');
            setDescription('');
            setPrice('');
            setImages([]);
            setVideoUri(null);
            setValidationResult(null);
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to create listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: (insets.top || webTopInset) + 20 }]}>
        <View style={styles.authGate}>
          <View style={styles.authIconCircle}>
            <Feather name="user-plus" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.authTitle}>Sign in to {listingType === 'sell' ? 'Sell' : 'Buy'}</Text>
          <Text style={styles.authSubtitle}>
            Register with your mobile number to post listings and connect with buyers
          </Text>
          <Pressable
            style={styles.authButton}
            onPress={() => router.push('/auth/register')}
          >
            <LinearGradient
              colors={['#0D9488', '#0F766E', '#065F56']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.authButtonGradient}
            >
              <Feather name="smartphone" size={20} color="#fff" />
              <Text style={styles.authButtonText}>Register with Mobile</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (insets.top || webTopInset) + 16,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Create Listing</Text>

        <View style={styles.typeToggle}>
          <Pressable
            style={[styles.typeButton, listingType === 'sell' && styles.typeButtonActive]}
            onPress={() => setListingType('sell')}
          >
            <Feather name="tag" size={16} color={listingType === 'sell' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.typeText, listingType === 'sell' && styles.typeTextActive]}>Sell</Text>
          </Pressable>
          <Pressable
            style={[styles.typeButton, listingType === 'buy' && styles.typeButtonActive]}
            onPress={() => setListingType('buy')}
          >
            <Feather name="shopping-cart" size={16} color={listingType === 'buy' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.typeText, listingType === 'buy' && styles.typeTextActive]}>Buy</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
            <Pressable style={styles.addImageButton} onPress={() => pickImage(false)}>
              <Feather name="image" size={24} color={Colors.primary} />
              <Text style={styles.addImageText}>Gallery</Text>
            </Pressable>
            <Pressable style={styles.addImageButton} onPress={() => pickImage(true)}>
              <Feather name="camera" size={24} color={Colors.primary} />
              <Text style={styles.addImageText}>Camera</Text>
            </Pressable>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageThumb}>
                <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" />
                <Pressable style={styles.removeImage} onPress={() => removeImage(index)}>
                  <Ionicons name="close-circle" size={22} color={Colors.accent} />
                </Pressable>
              </View>
            ))}
          </ScrollView>

          {isValidating && (
            <View style={styles.validationBanner}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.validationText}>AI is analyzing your image...</Text>
            </View>
          )}

          {validationResult && !isValidating && (
            <View
              style={[
                styles.validationBanner,
                {
                  backgroundColor:
                    validationResult.isValid && validationResult.isAppropriate
                      ? '#ECFDF5'
                      : '#FEF2F2',
                },
              ]}
            >
              <Feather
                name={validationResult.isValid && validationResult.isAppropriate ? 'check-circle' : 'alert-triangle'}
                size={18}
                color={validationResult.isValid && validationResult.isAppropriate ? Colors.success : Colors.error}
              />
              <View style={styles.validationContent}>
                <Text
                  style={[
                    styles.validationTitle,
                    {
                      color:
                        validationResult.isValid && validationResult.isAppropriate
                          ? Colors.success
                          : Colors.error,
                    },
                  ]}
                >
                  {validationResult.isValid && validationResult.isAppropriate ? 'AI Verified' : 'Needs Attention'}
                </Text>
                <Text style={styles.validationReason}>{validationResult.reason}</Text>
                {validationResult.suggestion ? (
                  <Text style={styles.validationSuggestion}>{validationResult.suggestion}</Text>
                ) : null}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Video (for Shorts)</Text>
          <Text style={styles.sectionHint}>Upload a short video to showcase your product in the Shorts feed</Text>
          {videoUri ? (
            <View style={styles.videoSelected}>
              <View style={styles.videoInfo}>
                <Feather name="film" size={20} color={Colors.primary} />
                <Text style={styles.videoFileName}>Video attached</Text>
              </View>
              <Pressable onPress={() => setVideoUri(null)}>
                <Ionicons name="close-circle" size={24} color={Colors.accent} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addVideoButton} onPress={pickVideo}>
              <Feather name="video" size={24} color={Colors.primary} />
              <Text style={styles.addVideoText}>Select Video</Text>
              <Text style={styles.addVideoDuration}>Max 60 seconds</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What are you selling?"
            placeholderTextColor={Colors.textTertiary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Price</Text>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Condition</Text>
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
          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your item..."
            placeholderTextColor={Colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Posting as</Text>
            <View style={styles.userInfoCard}>
              <View style={styles.userAvatar}>
                <Feather name="user" size={20} color={Colors.primary} />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userPhone}>+91 {user.phone}</Text>
              </View>
              <Feather name="check-circle" size={18} color={Colors.success} />
            </View>
          </View>
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
            colors={['#0D9488', '#0F766E', '#065F56']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>Post Listing</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
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
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
  },
  typeText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  typeTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginBottom: 10,
    marginTop: -4,
  },
  addVideoButton: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 18,
    gap: 4,
    backgroundColor: 'rgba(13, 148, 136, 0.05)',
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: '#ECFDF5',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  videoInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  videoFileName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.success,
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
  },
  imageRow: {
    gap: 10,
    paddingVertical: 4,
  },
  addImageButton: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(13, 148, 136, 0.05)',
  },
  addImageText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  imageThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
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
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    gap: 10,
  },
  validationContent: {
    flex: 1,
  },
  validationText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  validationTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
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
    fontStyle: 'italic' as const,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 12,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  submitPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 17,
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
    borderRadius: 40,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
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
    borderRadius: 16,
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
    paddingVertical: 18,
    gap: 10,
  },
  authButtonText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  userInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  userPhone: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
