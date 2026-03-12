import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

import Colors from '@/constants/colors';
import { getApiUrl } from '@/lib/query-client';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import { useAuth } from '@/shared/contexts/auth-context';

type PublicProfile = {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  location?: string | null;
  isVerified?: boolean;
};

type UserListing = {
  id: string;
  title: string;
  price: number;
  location?: string;
  images?: string[];
};

export default function UserProfileScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string | string[]; userName?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId || '';
  const fallbackName = Array.isArray(params.userName) ? params.userName[0] : params.userName || 'User';
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [listings, setListings] = useState<UserListing[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const headers = buildUserAuthHeaders(
        { id: user?.id, phone: user?.phone, name: user?.name },
        { includeName: true }
      );

      const [profileRes, listingsRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/users/${encodeURIComponent(userId)}/profile`, {
          method: 'GET',
          headers,
        }),
        fetch(`${getApiUrl()}/api/users/${encodeURIComponent(userId)}/listings`, {
          method: 'GET',
          headers,
        }),
      ]);

      const profilePayload = await profileRes.json().catch(() => null);
      const listingsPayload = await listingsRes.json().catch(() => null);

      const profileData = profilePayload?.user;
      const resolvedName = String(profileData?.name || '').trim() || fallbackName;
      const resolvedPhone = String(profileData?.phone || userId || '').trim();
      setProfile({
        id: userId,
        name: resolvedName,
        phone: resolvedPhone,
        avatarUrl: profileData?.avatarUrl || '',
        location: profileData?.location || '',
        isVerified: Boolean(profileData?.isVerified),
      });

      const rawListings = Array.isArray(listingsPayload?.listings) ? listingsPayload.listings : [];
      const mappedListings = rawListings.map((item: any) => ({
        id: String(item.id || ''),
        title: String(item.title || 'Listing'),
        price: Number(item.price || 0),
        location: String(item.location || ''),
        images: Array.isArray(item.images) ? item.images : [],
      }));
      setListings(mappedListings.filter((item: UserListing) => item.id));
    } catch (error) {
      console.error('Failed to load public user profile:', error);
      setProfile({
        id: userId,
        name: fallbackName,
        phone: String(userId || '').trim(),
        avatarUrl: '',
        location: '',
        isVerified: false,
      });
      setListings([]);
    } finally {
      setIsLoading(false);
    }
  }, [fallbackName, user?.id, user?.name, user?.phone, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const headerInitial = useMemo(
    () => (profile?.name || fallbackName || 'U').trim().charAt(0).toUpperCase(),
    [fallbackName, profile?.name]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 8 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>User Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>{headerInitial}</Text>
              )}
            </View>
            <View style={styles.profileTextWrap}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText}>{profile?.name || fallbackName}</Text>
                {profile?.isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Feather name="check-circle" size={12} color="#fff" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.metaText}>{profile?.phone || '-'}</Text>
              <Text style={styles.metaText}>{profile?.location || 'Location not available'}</Text>
            </View>
            <View style={styles.listingsCountChip}>
              <Text style={styles.listingsCountValue}>{listings.length}</Text>
              <Text style={styles.listingsCountLabel}>Listings</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="inbox" size={28} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No listings to show</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.listingCard}
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          >
            {item.images && item.images[0] ? (
              <Image source={{ uri: item.images[0] }} style={styles.listingImage} contentFit="cover" />
            ) : (
              <View style={[styles.listingImage, styles.listingImageFallback]}>
                <Feather name="image" size={16} color={Colors.textTertiary} />
              </View>
            )}
            <View style={styles.listingBody}>
              <Text style={styles.listingTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.listingMeta} numberOfLines={1}>
                {item.location || 'Unknown location'}
              </Text>
            </View>
            <Text style={styles.listingPrice}>₹{Number(item.price || 0).toLocaleString('en-IN')}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  content: {
    padding: 14,
    paddingBottom: 24,
    gap: 10,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  profileTextWrap: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0F766E',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  listingsCountChip: {
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  listingsCountValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  listingsCountLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  listingImage: {
    width: 46,
    height: 46,
    borderRadius: 9,
  },
  listingImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.borderLight,
  },
  listingBody: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  listingMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listingPrice: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});
