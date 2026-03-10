import React from 'react';
import { StyleSheet, Text, View, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { responsiveFont, responsiveModerateScale } from '@/lib/responsive';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface ListingCardProps {
  id: string;
  title: string;
  description?: string;
  price: number;
  offerPrice?: number;
  priceUnit?: string;
  image?: string;
  location: string;
  condition: string;
  isBoosted?: boolean;
  isSponsored?: boolean;
  isSaved: boolean;
  onPress: () => void;
  onSave: () => void;
}

export default function ListingCard({
  title,
  description,
  price,
  offerPrice,
  priceUnit,
  image,
  location,
  condition,
  isBoosted = false,
  isSponsored = false,
  isSaved,
  onPress,
  onSave,
}: ListingCardProps) {
  const hasUnreachablePlaceholder =
    typeof image === 'string' && image.includes('via.placeholder.com');
  const imageSource =
    !image || hasUnreachablePlaceholder ? require('../../assets/images/icon.png') : { uri: image };
  const hasValidOfferPrice = typeof offerPrice === 'number' && offerPrice > 0 && offerPrice < price;
  const displayPrice = hasValidOfferPrice ? offerPrice : price;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.imageContainer}>
        <Image source={imageSource} style={styles.image} contentFit="cover" transition={200} />
        <Pressable style={styles.saveButton} onPress={onSave} hitSlop={8}>
          <Ionicons
            name={isSaved ? 'heart' : 'heart-outline'}
            size={responsiveModerateScale(18)}
            color={isSaved ? Colors.accent : '#fff'}
          />
        </Pressable>
        <View style={styles.conditionBadge}>
          <Text style={styles.conditionText}>{condition}</Text>
        </View>
        {isBoosted && (
          <View style={styles.boostBadge}>
            <Text style={styles.boostText}>Boost</Text>
          </View>
        )}
        {isSponsored && (
          <View style={styles.sponsoredBadge}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{displayPrice.toLocaleString('en-IN')}</Text>
          {priceUnit && <Text style={styles.priceUnit}> / {priceUnit}</Text>}
          {hasValidOfferPrice && (
            <Text style={styles.originalPrice}>₹{price.toLocaleString('en-IN')}</Text>
          )}
        </View>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        <Text style={styles.description} numberOfLines={1} ellipsizeMode="tail">
          {description || title}
        </Text>
        <View style={styles.meta}>
          <Feather name="map-pin" size={responsiveModerateScale(11)} color={Colors.textTertiary} />
          <Text style={styles.metaText}>{location}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: responsiveModerateScale(3),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  saveButton: {
    position: 'absolute',
    top: responsiveModerateScale(8),
    right: responsiveModerateScale(8),
    width: responsiveModerateScale(28),
    height: responsiveModerateScale(28),
    borderRadius: responsiveModerateScale(14),
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionBadge: {
    position: 'absolute',
    bottom: responsiveModerateScale(8),
    left: responsiveModerateScale(8),
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: responsiveModerateScale(7),
    paddingVertical: responsiveModerateScale(2),
    borderRadius: responsiveModerateScale(8),
  },
  conditionText: {
    color: '#fff',
    fontSize: responsiveFont(10),
    fontFamily: 'Inter_500Medium',
  },
  boostBadge: {
    position: 'absolute',
    top: responsiveModerateScale(8),
    left: responsiveModerateScale(8),
    backgroundColor: Colors.primary,
    paddingHorizontal: responsiveModerateScale(7),
    paddingVertical: responsiveModerateScale(2),
    borderRadius: responsiveModerateScale(8),
  },
  boostText: {
    color: '#fff',
    fontSize: responsiveFont(10),
    fontFamily: 'Inter_700Bold',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: responsiveModerateScale(8),
    left: responsiveModerateScale(58),
    backgroundColor: '#F59E0B',
    paddingHorizontal: responsiveModerateScale(7),
    paddingVertical: responsiveModerateScale(2),
    borderRadius: responsiveModerateScale(8),
  },
  sponsoredText: {
    color: '#fff',
    fontSize: responsiveFont(10),
    fontFamily: 'Inter_700Bold',
  },
  info: {
    padding: responsiveModerateScale(8),
  },
  price: {
    fontSize: responsiveFont(15),
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: responsiveModerateScale(5),
  },
  priceUnit: {
    fontSize: responsiveFont(12),
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  originalPrice: {
    fontSize: responsiveFont(11),
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },

  title: {
    fontSize: responsiveFont(12),
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginTop: responsiveModerateScale(2),
    lineHeight: responsiveModerateScale(16),
  },
  description: {
    fontSize: responsiveFont(11),
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: responsiveModerateScale(2),
    lineHeight: responsiveModerateScale(15),
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveModerateScale(4),
    gap: responsiveModerateScale(3),
  },
  metaText: {
    fontSize: responsiveFont(10),
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
});
