import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Alert,
  Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import AuthRequiredState from '@/shared/components/AuthRequiredState';
import AppScreenBanners from '@/shared/components/AppScreenBanners';
import { KeyboardAwareScrollViewCompat } from '@/shared/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/shared/contexts/auth-context';
import { useAppScreenBanners } from '@/shared/hooks/use-app-screen-banners';
import { uploadMediaToCloudflare } from '@/lib/cloudflare-media-upload';
import { getApiUrl } from '@/lib/query-client';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import { isValidEmailAddress } from '@/lib/email-utils';
import { sanitizeAlphabeticName } from '@/lib/name-utils';

type ProfileStats = {
  totalListings: number;
  soldListings: number;
  rating: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractListingSaveCount(listing: any): number {
  const direct =
    toFiniteNumber(listing?.saveCount) ??
    toFiniteNumber(listing?.likeCount) ??
    toFiniteNumber(listing?.likesCount) ??
    toFiniteNumber(listing?.favoritesCount) ??
    toFiniteNumber(listing?.savedCount);

  return Math.max(0, direct ?? 0);
}

function computeSaveBasedRating(totalSaves: number, totalListings: number): number {
  if (totalSaves <= 0 || totalListings <= 0) {
    return 0;
  }

  const averageSavesPerListing = totalSaves / totalListings;
  const score = Math.log2(averageSavesPerListing + 1) * 1.5;
  return Math.min(5, Number(score.toFixed(1)));
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser, isAuthenticated } = useAuth();
  const { banners: profileBanners, isLoading: isProfileBannersLoading } =
    useAppScreenBanners('profile');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState(user?.address || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [gstin, setGstin] = useState(user?.gstin || '');
  const [avatarDraftUri, setAvatarDraftUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    totalListings: 0,
    soldListings: 0,
    rating: null,
  });
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const lastSavedPayloadRef = useRef<string>('');
  const scrollViewRef = useRef<ScrollView>(null);
  const bioSectionYRef = useRef<number | null>(null);
  const isBioFocusedRef = useRef(false);
  const scrollToBioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const sanitizedName = sanitizeAlphabeticName(name).trim();
  const trimmedEmail = email.trim();
  const isEmailValid = !trimmedEmail || isValidEmailAddress(trimmedEmail);
  const currentPayload = {
    name: sanitizedName,
    email: trimmedEmail,
    address: address.trim(),
    bio: bio.trim(),
    gstin: gstin.trim(),
  };
  const serializedPayload = JSON.stringify(currentPayload);
  const hasInitializedProfile = Boolean(user?.id && lastSyncedUserIdRef.current === user.id);
  const hasUnsavedChanges = hasInitializedProfile
    ? serializedPayload !== lastSavedPayloadRef.current || !!avatarDraftUri
    : false;

  const scrollToBio = useCallback((animated = true) => {
    const bioSectionY = bioSectionYRef.current;
    if (bioSectionY === null) return;

    if (scrollToBioTimeoutRef.current) {
      clearTimeout(scrollToBioTimeoutRef.current);
      scrollToBioTimeoutRef.current = null;
    }

    const keyboardAdjustmentOffset = Platform.OS === 'ios' ? 110 : 160;
    scrollToBioTimeoutRef.current = setTimeout(
      () => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, bioSectionY - keyboardAdjustmentOffset),
          animated,
        });
      },
      Platform.OS === 'ios' ? 120 : 80
    );
  }, []);

  const userAuthHeaders = user
    ? buildUserAuthHeaders({
        id: user.id,
        phone: user.phone || '',
        token: user.token,
      })
    : buildUserAuthHeaders(null);

  const syncProfileToServer = async (payload: {
    name: string;
    email?: string;
    bio?: string;
    address?: string;
    gstin?: string;
    avatarUrl?: string;
  }) => {
    if (!user?.id) return;
    const response = await fetch(
      `${getApiUrl()}/api/users/${encodeURIComponent(user.id)}/profile`,
      {
        method: 'PUT',
        headers: userAuthHeaders,
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `Profile sync failed (${response.status})`);
    }
  };

  const loadProfileStats = React.useCallback(async () => {
    if (!user?.id) {
      setProfileStats({ totalListings: 0, soldListings: 0, rating: null });
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const [statsResponse, userListingsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/users/${encodeURIComponent(user.id)}/stats`, {
          headers: userAuthHeaders,
        }),
        fetch(`${apiUrl}/api/subscriptions/user/${encodeURIComponent(user.id)}/listings`, {
          headers: userAuthHeaders,
        }),
      ]);

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch stats (${statsResponse.status})`);
      }

      const statsPayload = await statsResponse.json().catch(() => ({}));
      const stats = statsPayload?.stats || {};
      const totalListings = Math.max(0, Number(stats.totalListings ?? 0));
      const soldListings = Math.max(0, Number(stats.soldListings ?? 0));
      const rawRating = toFiniteNumber(stats.rating ?? stats.averageRating ?? stats.avgRating);

      let listingsForSaveScore: any[] = [];
      if (userListingsResponse.ok) {
        const listingsPayload = await userListingsResponse.json().catch(() => ({}));
        listingsForSaveScore = Array.isArray(listingsPayload?.listings)
          ? listingsPayload.listings
          : Array.isArray(listingsPayload?.activeListings)
            ? listingsPayload.activeListings
            : [];
      }

      const savesFromListings = listingsForSaveScore.reduce(
        (sum, listing) => sum + extractListingSaveCount(listing),
        0
      );
      const statsReportedSaves =
        toFiniteNumber(stats.totalSaves) ??
        toFiniteNumber(stats.totalLikes) ??
        toFiniteNumber(stats.saveCount);
      const effectiveTotalSaves = Math.max(0, statsReportedSaves ?? savesFromListings);
      const listingsUsedForRating = Math.max(
        listingsForSaveScore.length,
        Number.isFinite(totalListings) ? totalListings : 0
      );
      const saveBasedRating = computeSaveBasedRating(effectiveTotalSaves, listingsUsedForRating);
      const resolvedRating =
        effectiveTotalSaves > 0 || listingsUsedForRating > 0 ? saveBasedRating : rawRating;
      const normalizedResolvedRating =
        typeof resolvedRating === 'number' && Number.isFinite(resolvedRating)
          ? resolvedRating
          : null;

      setProfileStats({
        totalListings: Number.isFinite(totalListings) ? totalListings : 0,
        soldListings: Number.isFinite(soldListings) ? soldListings : 0,
        rating: normalizedResolvedRating,
      });
    } catch (error) {
      console.warn('[Profile] Failed to load stats:', error);
      setProfileStats({ totalListings: 0, soldListings: 0, rating: null });
    }
  }, [user?.id, userAuthHeaders]);

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow photo access to update your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      aspect: [1, 1],
    });

    if (result.canceled || result.assets.length === 0) return;

    setAvatarDraftUri(result.assets[0].uri);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    if (!sanitizedName) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }

    if (!isEmailValid) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let uploadedAvatarUrl: string | undefined;
      if (avatarDraftUri) {
        const uploaded = await uploadMediaToCloudflare({
          uri: avatarDraftUri,
          mediaType: 'image',
          userId: user.id,
        });
        uploadedAvatarUrl = uploaded.url;
      }

      const payload = {
        name: sanitizedName,
        email: trimmedEmail,
        bio: bio.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        ...(uploadedAvatarUrl ? { avatarUrl: uploadedAvatarUrl } : {}),
      };

      await syncProfileToServer(payload);
      await updateUser(payload);
      lastSavedPayloadRef.current = serializedPayload;
      setAvatarDraftUri(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Sync profile form when user changes (initial load / account switch)
  useEffect(() => {
    if (!user?.id || lastSyncedUserIdRef.current === user.id) {
      return;
    }

    setName(user.name || '');
    setEmail(user.email || '');
    setAddress(user.address || '');
    setBio(user.bio || '');
    setGstin(user.gstin || '');
    setAvatarDraftUri(null);

    const initialPayload = {
      name: sanitizeAlphabeticName(user.name || '').trim(),
      email: (user.email || '').trim(),
      address: (user.address || '').trim(),
      bio: (user.bio || '').trim(),
      gstin: (user.gstin || '').trim(),
    };
    lastSavedPayloadRef.current = JSON.stringify(initialPayload);
    lastSyncedUserIdRef.current = user.id;
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      loadProfileStats();
    }, [loadProfileStats])
  );

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      if (isBioFocusedRef.current) {
        scrollToBio(true);
      }
    });

    return () => {
      keyboardDidShow.remove();
    };
  }, [scrollToBio]);

  useEffect(() => {
    return () => {
      if (scrollToBioTimeoutRef.current) {
        clearTimeout(scrollToBioTimeoutRef.current);
        scrollToBioTimeoutRef.current = null;
      }
    };
  }, []);

  if (!isAuthenticated || !user) {
    return <AuthRequiredState message="Please sign in to view and edit your profile" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerRight}>
          <View style={styles.saveIndicator}>
            {saving ? (
              <Text style={styles.saveIndicatorText}>Saving...</Text>
            ) : hasUnsavedChanges ? (
              <Text style={styles.saveIndicatorTextWarning}>Unsaved</Text>
            ) : null}
          </View>
        </View>
      </View>

      <KeyboardAwareScrollViewCompat
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <AppScreenBanners banners={profileBanners} isLoading={isProfileBannersLoading} />

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            {avatarDraftUri ? (
              <Image source={{ uri: avatarDraftUri }} style={styles.avatarImage} />
            ) : user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || user?.phone?.charAt(0) || 'U'}
              </Text>
            )}
          </View>
          <Pressable style={styles.changeAvatarButton} onPress={handleChangePhoto}>
            <Feather name="camera" size={16} color={Colors.primary} />
            <Text style={styles.changeAvatarText}>Change Photo</Text>
          </Pressable>
        </View>

        {/* Phone (Read-only) */}
        <View style={styles.section}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Feather name="phone" size={18} color={Colors.textSecondary} />
            <Text style={styles.inputTextDisabled}>{user?.phone || 'Not set'}</Text>
          </View>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Name *</Text>
          <View style={styles.input}>
            <Feather name="user" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inputText}
              value={name}
              onChangeText={(value) => setName(sanitizeAlphabeticName(value))}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textTertiary}
              editable
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.input}>
            <Feather name="mail" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inputText}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              editable
            />
          </View>
          {!isEmailValid ? (
            <Text style={styles.helperTextError}>Enter a valid email address with @.</Text>
          ) : null}
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.label}>Address (For Invoices)</Text>
          <View style={styles.input}>
            <Feather name="map-pin" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inputText}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your business address"
              placeholderTextColor={Colors.textTertiary}
              editable
            />
          </View>
        </View>

        {/* GSTIN */}
        <View style={styles.section}>
          <Text style={styles.label}>GSTIN (For Invoices)</Text>
          <View style={styles.input}>
            <Feather name="hash" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inputText}
              value={gstin}
              onChangeText={setGstin}
              placeholder="15-digit GSTIN (optional)"
              placeholderTextColor={Colors.textTertiary}
              editable
              maxLength={15}
            />
          </View>
        </View>

        {/* Bio */}
        <View
          style={styles.section}
          onLayout={(event) => {
            bioSectionYRef.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>Bio</Text>
          <View style={[styles.input, styles.textAreaInput]}>
            <TextInput
              style={[styles.inputText, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable
              onFocus={() => {
                isBioFocusedRef.current = true;
                scrollToBio(true);
              }}
              onBlur={() => {
                isBioFocusedRef.current = false;
              }}
              onContentSizeChange={() => {
                if (isBioFocusedRef.current) {
                  scrollToBio(false);
                }
              }}
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            (saving || !hasUnsavedChanges || !isEmailValid) && styles.saveButtonDisabled,
          ]}
          onPress={handleSaveProfile}
          disabled={saving || !hasUnsavedChanges || !isEmailValid}
        >
          <LinearGradient
            colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveGradient}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="save" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profileStats.totalListings}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profileStats.soldListings}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {profileStats.rating !== null ? profileStats.rating.toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>
    </KeyboardAvoidingView>
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
  backButton: {
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveIndicator: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  saveIndicatorText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  saveIndicatorTextWarning: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.warning,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  changeAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  changeAvatarText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputDisabled: {
    backgroundColor: Colors.background,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  inputTextDisabled: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  helperTextError: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.error,
  },
  textAreaInput: {
    alignItems: 'flex-start',
  },
  textArea: {
    minHeight: 80,
  },
  saveButton: {
    marginTop: 4,
    marginBottom: 20,
  },
  saveButtonPressed: {
    opacity: 0.95,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveGradient: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});
