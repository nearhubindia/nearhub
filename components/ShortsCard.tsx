import React from 'react';
import { StyleSheet, Text, View, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

const { width, height } = Dimensions.get('window');

interface ShortsCardProps {
  title: string;
  price: number;
  image: string;
  sellerName: string;
  location: string;
  category: string;
  condition: string;
  isSaved: boolean;
  onSave: () => void;
  onContact: () => void;
  onDetails: () => void;
}

export default function ShortsCard({
  title,
  price,
  image,
  sellerName,
  location,
  category,
  condition,
  isSaved,
  onSave,
  onContact,
  onDetails,
}: ShortsCardProps) {
  return (
    <View style={styles.container}>
      <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={300} />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        locations={[0.3, 0.6, 1]}
        style={styles.gradient}
      />

      <View style={styles.sideActions}>
        <Pressable style={styles.actionButton} onPress={onSave}>
          <Ionicons
            name={isSaved ? 'heart' : 'heart-outline'}
            size={28}
            color={isSaved ? Colors.accent : '#fff'}
          />
          <Text style={styles.actionLabel}>Save</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onContact}>
          <Feather name="message-circle" size={26} color="#fff" />
          <Text style={styles.actionLabel}>Contact</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onDetails}>
          <Feather name="maximize-2" size={24} color="#fff" />
          <Text style={styles.actionLabel}>Details</Text>
        </Pressable>
      </View>

      <View style={styles.bottomContent}>
        <View style={styles.badges}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{category}</Text>
          </View>
          <View style={styles.conditionBadge}>
            <Text style={styles.conditionText}>{condition}</Text>
          </View>
        </View>

        <Text style={styles.price}>₹{price.toLocaleString('en-IN')}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.sellerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{sellerName.charAt(0)}</Text>
          </View>
          <Text style={styles.sellerName}>{sellerName}</Text>
          <Feather name="map-pin" size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.location}>{location}</Text>
        </View>

        <Pressable style={styles.viewButton} onPress={onDetails}>
          <Text style={styles.viewButtonText}>View Listing</Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    position: 'relative',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    bottom: 200,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 70,
    padding: 16,
    paddingBottom: 100,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  conditionBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conditionText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  price: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 22,
    marginBottom: 12,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  sellerName: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginRight: 8,
  },
  location: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
