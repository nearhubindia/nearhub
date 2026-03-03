import React from 'react';
import { StyleSheet, Text, View, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface ListingCardProps {
  id: string;
  title: string;
  description?: string;
  price: number;
  priceUnit?: string;
  image?: string;
  location: string;
  condition: string;
  isSaved: boolean;
  onPress: () => void;
  onSave: () => void;
}

export default function ListingCard({
  title,
  description,
  price,
  priceUnit,
  image,
  location,
  condition,
  isSaved,
  onPress,
  onSave,
}: ListingCardProps) {
  const hasUnreachablePlaceholder =
    typeof image === 'string' && image.includes('via.placeholder.com');
  const imageSource =
    !image || hasUnreachablePlaceholder ? require('../../assets/images/icon.png') : { uri: image };

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
            size={20}
            color={isSaved ? Colors.accent : '#fff'}
          />
        </Pressable>
        <View style={styles.conditionBadge}>
          <Text style={styles.conditionText}>{condition}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.price}>
          ₹{price.toLocaleString('en-IN')}
          {priceUnit && <Text style={styles.priceUnit}> / {priceUnit}</Text>}
        </Text>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        <Text style={styles.description} numberOfLines={1} ellipsizeMode="tail">
          {description || title}
        </Text>
        <View style={styles.meta}>
          <Feather name="map-pin" size={11} color={Colors.textTertiary} />
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
    marginBottom: 3,
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
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  conditionText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  info: {
    padding: 10,
  },
  price: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  priceUnit: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },

  title: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginTop: 2,
    lineHeight: 17,
  },
  description: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
});
