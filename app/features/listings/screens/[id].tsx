import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { getTimeAgo, formatCondition } from '@/lib/utils';
import { getBackendURL } from '@/lib/config';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import MediaCarousel from '@/shared/components/MediaCarousel';
import { createResponsiveStyles } from '@/lib/responsive';

const { width } = Dimensions.get('window');

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getListingById, savedIds, toggleSaved } = useListings();
  const { isAuthenticated, user } = useAuth();
  const [isFocused, setIsFocused] = useState(true);
  const [resolvedContactPhone, setResolvedContactPhone] = useState('');

  // Pause videos when screen loses focus
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  const listing = getListingById(id);
  const isSaved = savedIds.has(id);
  const normalizedUserId = (user?.id || '').replace(/[\s+-]/g, '');
  const listingPhoneRaw = (
    resolvedContactPhone ||
    listing?.contactPhone ||
    listing?.sellerPhone ||
    ''
  ).trim();
  const normalizedSellerPhone = listingPhoneRaw.replace(/\D/g, '').slice(-10);
  const listingPhone = normalizedSellerPhone;
  const normalizedListingUserId = (listing?.userId || '').replace(/[\s+-]/g, '');
  const listingUserIdLower = String(listing?.userId || '')
    .trim()
    .toLowerCase();
  const isAdminListing =
    listingUserIdLower === 'admin' ||
    listingUserIdLower.startsWith('admin-') ||
    listingUserIdLower.startsWith('admin_') ||
    normalizedListingUserId.toLowerCase().startsWith('admin');
  const isOwner = !!normalizedUserId && normalizedUserId === normalizedListingUserId;
  const canShowCall =
    (!isAdminListing || (isAdminListing && normalizedSellerPhone.length > 0)) && !isOwner;
  const canShowMessage = !isAdminListing && !isOwner;
  const listingStatus = String((listing as any)?.status || '').toLowerCase();
  const isExpired =
    listingStatus === 'expired' ||
    (!!listing?.expiresAt && new Date(listing.expiresAt).getTime() < Date.now());

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  // Debug: Log listing data
  useEffect(() => {
    if (listing) {
      console.log('[ListingDetail] Listing loaded:', {
        id: listing.id,
        title: listing.title,
        hasImages: listing.images?.length || 0,
        hasVideos: listing.videos?.length || 0,
        videos: listing.videos,
      });
    }
  }, [listing?.id]);

  useEffect(() => {
    setResolvedContactPhone('');
  }, [id]);

  // Track view when screen loads
  useEffect(() => {
    if (!id) return;

    const trackView = async () => {
      try {
        const apiUrl = getBackendURL();
        await fetch(`${apiUrl}/api/listings/${id}/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        // Silently track - don't show errors to user
      } catch (error) {
        console.error('[ListingDetail] Failed to track view:', error);
      }
    };

    trackView();
  }, [id]);

  if (!listing) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top || webTopInset }]}>
        <Feather name="alert-circle" size={48} color={Colors.textTertiary} />
        <Text style={styles.notFoundText}>Listing not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const requireAuth = (action: () => void) => {
    if (!isAuthenticated) {
      Alert.alert('Sign in Required', 'You need to register to contact sellers.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Register', onPress: () => router.push('/auth/register') },
      ]);
      return;
    }
    action();
  };

  const handleMessage = () => {
    requireAuth(() => {
      if (isOwner) {
        Alert.alert('Not Allowed', 'You cannot message your own listing.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push({
        pathname: '/chat/[listingId]',
        params: {
          listingId: listing.id,
          otherUserId: listing.userId || '',
          sellerName: listing.sellerName,
          listingTitle: listing.title,
          listingImage: listing.images[0],
        },
      });
    });
  };

  const handleCall = () => {
    requireAuth(() => {
      if (isOwner) {
        Alert.alert('Not Allowed', 'You cannot call your own listing.');
        return;
      }
      void (async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        let phone = '';

        try {
          const apiUrl = getBackendURL();
          const response = await fetch(`${apiUrl}/api/listings/${listing.id}/contact`, {
            method: 'GET',
            headers: buildUserAuthHeaders({
              id: user?.id || '',
              phone: user?.phone || '',
            }),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok || !data?.success) {
            throw new Error(data?.error || 'Seller phone number is not available.');
          }
          const fetchedPhone = String(data.contactPhone || data.sellerPhone || '')
            .replace(/\D/g, '')
            .slice(-10);
          if (!fetchedPhone) {
            throw new Error('Seller phone number is not available.');
          }
          setResolvedContactPhone(fetchedPhone);
          phone = fetchedPhone;
        } catch (error: any) {
          Alert.alert('Contact Seller', error?.message || 'Seller phone number is not available.');
          return;
        }

        if (Platform.OS === 'web') {
          Alert.alert('Contact Seller', `Call ${listing.sellerName} at ${phone}`);
        } else {
          Alert.alert('Contact Seller', `Would you like to call ${listing.sellerName}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call', onPress: () => Linking.openURL(`tel:${phone}`) },
          ]);
        }
      })();
    });
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSaved(id);
  };
  const hasValidOfferPrice =
    typeof listing.offerPrice === 'number' &&
    listing.offerPrice > 0 &&
    listing.offerPrice < listing.price;
  const displayPrice = hasValidOfferPrice ? (listing.offerPrice as number) : listing.price;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100,
        }}
      >
        <View style={styles.imageContainer}>
          <MediaCarousel
            images={listing.images}
            videos={listing.videos}
            height={width * 1.3}
            isFocused={isFocused}
          />

          <Pressable
            style={[styles.headerButton, styles.backIcon, { top: (insets.top || webTopInset) + 8 }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>

          <Pressable
            style={[styles.headerButton, styles.saveIcon, { top: (insets.top || webTopInset) + 8 }]}
            onPress={handleSave}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaved ? Colors.accent : '#fff'}
            />
          </Pressable>

          {listing.aiValidated && (
            <View style={styles.aiBadge}>
              <Feather name="shield" size={14} color="#fff" />
              <Text style={styles.aiBadgeText}>AI Verified</Text>
            </View>
          )}
        </View>

        <View style={styles.details}>
          <View style={styles.priceRow}>
            <View style={styles.priceWrap}>
              <Text style={styles.price}>₹{displayPrice.toLocaleString('en-IN')}</Text>
              {listing.priceUnit && <Text style={styles.priceUnit}> / {listing.priceUnit}</Text>}
              {hasValidOfferPrice && (
                <Text style={styles.originalPrice}>₹{listing.price.toLocaleString('en-IN')}</Text>
              )}
            </View>
            <View style={styles.rightBadges}>
              {isExpired && (
                <View style={styles.expiredBadge}>
                  <Text style={styles.expiredBadgeText}>Expired</Text>
                </View>
              )}
              <View
                style={[
                  styles.typeBadge,
                  listing.listingType === 'buy' ? styles.buyBadge : styles.sellBadge,
                ]}
              >
                <Text style={styles.typeText}>
                  {listing.listingType === 'buy' ? 'Wanted' : 'For Sale'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.title}>{listing.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={Colors.textTertiary} />
              <Text style={styles.metaText}>{getTimeAgo(listing.createdAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={14} color={Colors.textTertiary} />
              <Text style={styles.metaText}>{listing.location.city}</Text>
            </View>
            <View style={styles.condBadge}>
              <Text style={styles.condText}>{formatCondition(listing.condition)}</Text>
            </View>
          </View>

          {isExpired && isOwner && (
            <View style={styles.expiredCtaCard}>
              <Text style={styles.expiredCtaTitle}>This listing has expired</Text>
              <Text style={styles.expiredCtaSubtitle}>
                Renew it to make it visible to buyers again.
              </Text>
              <Pressable
                style={styles.renewNowButton}
                onPress={() =>
                  router.push({
                    pathname: '/my-listings',
                    params: { tab: 'expired', renewId: listing.id },
                  })
                }
              >
                <Feather name="refresh-cw" size={16} color="#fff" />
                <Text style={styles.renewNowButtonText}>Renew now</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{listing.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Seller</Text>
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              {listing.sellerAvatar ? (
                <Image source={{ uri: listing.sellerAvatar }} style={styles.sellerAvatarImage} />
              ) : (
                <Text style={styles.sellerAvatarText}>{listing.sellerName.charAt(0)}</Text>
              )}
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{listing.sellerName}</Text>
                {listing.sellerVerified && (
                  <View style={styles.sellerVerifiedBadge}>
                    <Feather name="check-circle" size={12} color="#fff" />
                    <Text style={styles.sellerVerifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sellerLocation}>{listing.location.city}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryText}>{listing.category}</Text>
          </View>
        </View>
      </ScrollView>

      {(canShowCall || canShowMessage) && (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: (insets.bottom || (Platform.OS === 'web' ? 34 : 0)) + 8 },
          ]}
        >
          {canShowMessage && (
            <Pressable style={styles.messageButton} onPress={handleMessage}>
              <Feather name="message-circle" size={20} color={Colors.primary} />
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          )}
          {canShowCall && (
            <Pressable
              style={[styles.callButton, !canShowMessage && { flex: 1 }]}
              onPress={handleCall}
            >
              <Feather name="phone" size={20} color="#fff" />
              <Text style={styles.callText}>Call Seller</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
  mainImage: {
    width,
    height: width * 0.6,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  headerButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    left: 16,
  },
  saveIcon: {
    right: 16,
  },
  aiBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  details: {
    padding: 16,
    marginTop: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
  },
  priceUnit: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  originalPrice: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  expiredBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  expiredBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  sellBadge: {
    backgroundColor: '#ECFDF5',
  },
  buyBadge: {
    backgroundColor: '#EFF6FF',
  },
  typeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    lineHeight: 28,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  condBadge: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  condText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  expiredCtaCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    gap: 8,
  },
  expiredCtaTitle: {
    fontSize: 14,
    color: '#991b1b',
    fontFamily: 'Inter_700Bold',
  },
  expiredCtaSubtitle: {
    fontSize: 13,
    color: '#7f1d1d',
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  renewNowButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  renewNowButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sellerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  sellerAvatarText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sellerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  sellerLocation: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sellerVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F766E',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sellerVerifiedText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  categoryText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    gap: 6,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    gap: 6,
  },
  callText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  notFound: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
