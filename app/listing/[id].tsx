import React, { useMemo } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/lib/listings-context';
import { getTimeAgo, formatCondition } from '@/lib/utils';

const { width } = Dimensions.get('window');

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getListingById, savedIds, toggleSaved } = useListings();

  const listing = useMemo(() => getListingById(id), [id]);
  const isSaved = savedIds.has(id);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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

  const handleContact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'web') {
      Alert.alert('Contact Seller', `Call ${listing.sellerName} at ${listing.sellerPhone}`);
    } else {
      Alert.alert('Contact Seller', `Would you like to call ${listing.sellerName}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => Linking.openURL(`tel:${listing.sellerPhone}`) },
      ]);
    }
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSaved(id);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100 }}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: listing.images[0] }}
            style={styles.mainImage}
            contentFit="cover"
            transition={300}
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
            <Text style={styles.price}>₹{listing.price.toLocaleString('en-IN')}</Text>
            <View style={[styles.typeBadge, listing.listingType === 'buy' ? styles.buyBadge : styles.sellBadge]}>
              <Text style={styles.typeText}>{listing.listingType === 'buy' ? 'Wanted' : 'For Sale'}</Text>
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

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{listing.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Seller</Text>
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>{listing.sellerName.charAt(0)}</Text>
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{listing.sellerName}</Text>
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

      <View style={[styles.bottomBar, { paddingBottom: (insets.bottom || (Platform.OS === 'web' ? 34 : 0)) + 8 }]}>
        <Pressable style={styles.messageButton} onPress={handleContact}>
          <Feather name="message-circle" size={20} color={Colors.primary} />
          <Text style={styles.messageText}>Message</Text>
        </Pressable>
        <Pressable style={styles.callButton} onPress={handleContact}>
          <Feather name="phone" size={20} color="#fff" />
          <Text style={styles.callText}>Call Seller</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  imageContainer: {
    width,
    height: width * 0.85,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: Colors.success,
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
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  price: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  sellerInfo: {
    flex: 1,
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
