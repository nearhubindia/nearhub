import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import AppScreenBanners from '@/shared/components/AppScreenBanners';
import { useAuth } from '@/shared/contexts/auth-context';
import { useAppScreenBanners } from '@/shared/hooks/use-app-screen-banners';
import { uploadMediaToCloudflare } from '@/lib/cloudflare-media-upload';
import { getApiUrl } from '@/lib/query-client';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

type ProfileStats = {
  totalListings: number;
  soldListings: number;
  rating: number | null;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const { banners: profileBanners, isLoading: isProfileBannersLoading } =
    useAppScreenBanners('profile');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState(user?.address || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [gstin, setGstin] = useState(user?.gstin || '');
  const [saving, setSaving] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    totalListings: 0,
    soldListings: 0,
    rating: null,
  });
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const lastSavedPayloadRef = useRef<string>('');

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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
        headers: buildUserAuthHeaders({ id: user.id }),
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
      const response = await fetch(
        `${getApiUrl()}/api/users/${encodeURIComponent(user.id)}/stats`,
        {
          headers: buildUserAuthHeaders({ id: user.id }),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch stats (${response.status})`);
      }

      const data = await response.json().catch(() => ({}));
      const stats = data?.stats || {};
      const totalListings = Number(stats.totalListings ?? 0);
      const soldListings = Number(stats.soldListings ?? 0);
      const rawRating = Number(stats.rating ?? stats.averageRating ?? stats.avgRating);

      setProfileStats({
        totalListings: Number.isFinite(totalListings) ? totalListings : 0,
        soldListings: Number.isFinite(soldListings) ? soldListings : 0,
        rating: Number.isFinite(rawRating) ? rawRating : null,
      });
    } catch (error) {
      console.warn('[Profile] Failed to load stats:', error);
      setProfileStats({ totalListings: 0, soldListings: 0, rating: null });
    }
  }, [user?.id]);

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

    try {
      setSaving(true);
      const uploaded = await uploadMediaToCloudflare({
        uri: result.assets[0].uri,
        mediaType: 'image',
        userId: user?.id,
      });
      await syncProfileToServer({
        name: (name || user?.name || 'User').trim(),
        email: (email || user?.email || '').trim(),
        bio: (bio || user?.bio || '').trim(),
        address: (address || user?.address || '').trim(),
        gstin: (gstin || user?.gstin || '').trim(),
        avatarUrl: uploaded.url,
      });
      await updateUser({ avatarUrl: uploaded.url });
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile photo');
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

    const initialPayload = {
      name: (user.name || '').trim(),
      email: (user.email || '').trim(),
      address: (user.address || '').trim(),
      bio: (user.bio || '').trim(),
      gstin: (user.gstin || '').trim(),
    };
    lastSavedPayloadRef.current = JSON.stringify(initialPayload);
    lastSyncedUserIdRef.current = user.id;
  }, [user]);

  // Auto-save profile changes with debounce
  useEffect(() => {
    if (!user?.id || lastSyncedUserIdRef.current !== user.id) {
      return;
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      bio: bio.trim(),
      gstin: gstin.trim(),
    };

    if (!payload.name) {
      return;
    }

    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === lastSavedPayloadRef.current) {
      return;
    }

    const saveTimer = setTimeout(async () => {
      setSaving(true);
      try {
        await syncProfileToServer(payload);
        await updateUser(payload);
        lastSavedPayloadRef.current = serializedPayload;
      } catch (error) {
        Alert.alert('Error', 'Failed to auto-save profile');
      } finally {
        setSaving(false);
      }
    }, 700);

    return () => clearTimeout(saveTimer);
  }, [user?.id, name, email, address, bio, gstin, updateUser]);

  useFocusEffect(
    React.useCallback(() => {
      loadProfileStats();
    }, [loadProfileStats])
  );

  return (
    <View style={styles.container}>
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
        <View style={styles.saveIndicator}>
          {saving ? <Text style={styles.saveIndicatorText}>Saving...</Text> : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenBanners banners={profileBanners} isLoading={isProfileBannersLoading} />

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            {user?.avatarUrl ? (
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
              onChangeText={setName}
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
              autoCapitalize="none"
              editable
            />
          </View>
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
        <View style={styles.section}>
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
            />
          </View>
        </View>

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
      </ScrollView>
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
  saveIndicator: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  saveIndicatorText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
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
  textAreaInput: {
    alignItems: 'flex-start',
  },
  textArea: {
    minHeight: 80,
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
