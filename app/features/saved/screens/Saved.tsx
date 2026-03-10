import React, { useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Platform, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { formatCondition } from '@/lib/utils';
import ListingCard from '@/shared/components/ListingCard';
import { createResponsiveStyles } from '@/lib/responsive';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { savedIds, toggleSaved, getSavedListings } = useListings();
  const { user, isAuthenticated, logout } = useAuth();
  const savedListings = getSavedListings();

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleSave = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSaved(id);
    },
    [toggleSaved]
  );

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const genderLabel =
    user?.gender === 'male' ? 'Male' : user?.gender === 'female' ? 'Female' : 'Other';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 8 }]}>
        <View style={styles.headerRow}>
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
          <Text style={styles.title}>Saved</Text>
          {isAuthenticated && (
            <Pressable style={styles.profileButton} onPress={handleLogout}>
              <Feather name="log-out" size={18} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {isAuthenticated && user ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileDetail}>
                +91 {user.phone} {genderLabel}
              </Text>
              <Text style={styles.profileDetail}>{user.email}</Text>
            </View>
          </View>
        ) : (
          <Pressable style={styles.signInCard} onPress={() => router.push('/auth/register')}>
            <View style={styles.signInIconCircle}>
              <Feather name="user-plus" size={20} color={Colors.primary} />
            </View>
            <View style={styles.signInInfo}>
              <Text style={styles.signInTitle}>Sign in to NearHub</Text>
              <Text style={styles.signInSubtitle}>Save items and manage your account</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
          </Pressable>
        )}

        <Text style={styles.count}>{savedListings.length} saved items</Text>
      </View>

      <FlatList
        data={savedListings}
        renderItem={({ item, index }) => (
          <View style={index % 2 === 0 ? styles.leftCol : styles.rightCol}>
            <ListingCard
              id={item.id}
              title={item.title}
              description={item.description}
              price={item.price}
              offerPrice={item.offerPrice}
              priceUnit={item.priceUnit}
              image={item.images[0]}
              location={item.location.city}
              condition={formatCondition(item.condition)}
              isSponsored={Boolean((item as any).sponsored)}
              isSaved={savedIds.has(item.id)}
              onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
              onSave={() => handleSave(item.id)}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="heart" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No saved listings</Text>
            <Text style={styles.emptySubtitle}>
              Tap the heart icon on listings you like to save them here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    flex: 1,
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  profileDetail: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  signInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  signInIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 102, 194, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInInfo: {
    flex: 1,
  },
  signInTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  signInSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  count: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftCol: {
    marginRight: 6,
  },
  rightCol: {
    marginLeft: 6,
  },
  listContent: {
    paddingTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
