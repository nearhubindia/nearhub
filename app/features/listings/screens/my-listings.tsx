import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import AppScreenBanners from '@/shared/components/AppScreenBanners';
import { useAuth } from '@/shared/contexts/auth-context';
import { useListings } from '@/shared/contexts/listings-context';
import { useAppScreenBanners } from '@/shared/hooks/use-app-screen-banners';
import { getTimeAgo, formatCondition } from '@/lib/utils';
import { getApiUrl } from '@/lib/query-client';

type TabType = 'active' | 'sold' | 'expired';

interface UpgradePlan {
  duration: number;
  price: number;
  label: string;
  subtitle: string;
}

const UPGRADE_PLANS: UpgradePlan[] = [
  { duration: 45, price: 49, label: '45 Days', subtitle: 'Short boost for quick visibility' },
  { duration: 90, price: 99, label: '90 Days', subtitle: 'Balanced reach and value' },
  { duration: 180, price: 149, label: '180 Days', subtitle: 'Best value for long visibility' },
];

export default function MyListingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { listings, deleteListing, updateListing } = useListings();
  const {
    banners: listingsBanners,
    isLoading: isListingsBannersLoading,
    refreshBanners,
  } = useAppScreenBanners('listings');
  const [selectedTab, setSelectedTab] = useState<TabType>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);
  const [markingActiveId, setMarkingActiveId] = useState<string | null>(null);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedUpgradeItem, setSelectedUpgradeItem] = useState<any | null>(null);
  const [upgradingDuration, setUpgradingDuration] = useState<number | null>(null);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackModalTitle, setFeedbackModalTitle] = useState('Success');
  const [feedbackModalMessage, setFeedbackModalMessage] = useState('');
  const [feedbackModalType, setFeedbackModalType] = useState<'success' | 'error'>('success');

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  // Filter user's listings
  const myListings = listings.filter((listing) => listing.sellerPhone === user?.phone);

  const activeListings = myListings.filter((l) => l.status === 'active');
  const soldListings = myListings.filter((l) => l.status === 'sold');
  const expiredListings = myListings.filter((l) => {
    // Check if listing has expired based on duration
    if (!l.expiresAt) return false;
    return new Date(l.expiresAt) < new Date();
  });

  const currentListings =
    selectedTab === 'active'
      ? activeListings
      : selectedTab === 'sold'
        ? soldListings
        : expiredListings;

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBanners();
    // Refresh listings
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleTabPress = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTab(tab);
  };

  const showSuccessModal = (message: string) => {
    setFeedbackModalTitle('Success');
    setFeedbackModalType('success');
    setFeedbackModalMessage(message);
    setFeedbackModalVisible(true);
  };

  const showErrorModal = (message: string) => {
    setFeedbackModalTitle('Error');
    setFeedbackModalType('error');
    setFeedbackModalMessage(message);
    setFeedbackModalVisible(true);
  };

  const handleDelete = async (listingId: string, listingTitle: string) => {
    Alert.alert(
      'Delete Listing',
      `Are you sure you want to delete "${listingTitle}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(listingId);
            try {
              await deleteListing(listingId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSuccessModal('Listing deleted successfully');
            } catch (error) {
              console.error('Error deleting listing:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showErrorModal('Failed to delete listing. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkAsSold = async (listingId: string, listingTitle: string) => {
    Alert.alert(
      'Mark as Sold',
      `Mark "${listingTitle}" as sold?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Mark as Sold',
          onPress: async () => {
            setMarkingSoldId(listingId);
            try {
              await updateListing(listingId, { status: 'sold' });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSuccessModal('Listing marked as sold');
            } catch (error) {
              console.error('Error marking as sold:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showErrorModal('Failed to mark listing as sold. Please try again.');
            } finally {
              setMarkingSoldId(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkAsActive = async (listingId: string, listingTitle: string) => {
    Alert.alert(
      'Mark as Active',
      `Move "${listingTitle}" back to active listings?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Mark as Active',
          onPress: async () => {
            setMarkingActiveId(listingId);
            try {
              await updateListing(listingId, { status: 'active' });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSuccessModal('Listing moved back to Active');
            } catch (error) {
              console.error('Error marking as active:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showErrorModal('Failed to move listing to active. Please try again.');
            } finally {
              setMarkingActiveId(null);
            }
          },
        },
      ]
    );
  };

  const handleViewSubscription = (item: any) => {
    const isPaid = item.isPaid;
    const duration = item.durationDays || item.duration || 30;
    const expiresAt = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : 'N/A';
    
    const message = isPaid
      ? `Subscription: Premium\nDuration: ${duration} days\nExpires: ${expiresAt}`
      : `Subscription: Coupon\nDuration: ${duration} days\nExpires: ${expiresAt}`;

    Alert.alert('Listing Details', message, [
      {
        text: 'View Plans',
        onPress: () => handleUpgrade(item),
      },
      {
        text: 'Close',
        style: 'cancel',
      },
    ]);
  };

  const handleUpgrade = (item: any) => {
    setSelectedUpgradeItem(item);
    setUpgradeModalVisible(true);
  };

  const handleUpgradeButton = (item: any, e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedUpgradeItem(item);
    setUpgradeModalVisible(true);
  };

  const closeUpgradeModal = () => {
    setUpgradeModalVisible(false);
    setSelectedUpgradeItem(null);
    setUpgradingDuration(null);
  };

  const getCurrentPlanDuration = (item: any): number => {
    const paidDuration = Number(item?.duration || item?.durationDays || 0);
    if (item?.isPaid && paidDuration > 0) return paidDuration;
    return 15;
  };

  const getAvailableUpgradePlans = (item: any): UpgradePlan[] => {
    const currentDuration = getCurrentPlanDuration(item);
    return UPGRADE_PLANS.filter((plan) => plan.duration !== currentDuration);
  };

  const processUpgrade = async (listingId: string, duration: number, price: number) => {
    try {
      setUpgradingDuration(duration);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/subscriptions/upgrade-listing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId,
          duration,
          price,
        }),
      });

      if (response.ok) {
        await response.json();
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        closeUpgradeModal();
        showSuccessModal(`Listing upgraded to ${duration} days plan!`);
        onRefresh();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upgrade failed');
      }
    } catch (error) {
      console.error('Error upgrading listing:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showErrorModal('Failed to upgrade listing. Please try again.');
    } finally {
      setUpgradingDuration(null);
    }
  };

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
        <Text style={styles.headerTitle}>My Listings</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/listings/analytics');
            }}
            style={styles.analyticsButton}
            hitSlop={8}
          >
            <Feather name="bar-chart-2" size={20} color={Colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/create');
            }}
            style={styles.addButton}
            hitSlop={8}
          >
            <Feather name="plus" size={24} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, selectedTab === 'active' && styles.tabActive]}
          onPress={() => handleTabPress('active')}
        >
          <Text style={[styles.tabText, selectedTab === 'active' && styles.tabTextActive]}>
            Active ({activeListings.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === 'sold' && styles.tabActive]}
          onPress={() => handleTabPress('sold')}
        >
          <Text style={[styles.tabText, selectedTab === 'sold' && styles.tabTextActive]}>
            Sold ({soldListings.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === 'expired' && styles.tabActive]}
          onPress={() => handleTabPress('expired')}
        >
          <Text style={[styles.tabText, selectedTab === 'expired' && styles.tabTextActive]}>
            Expired ({expiredListings.length})
          </Text>
        </Pressable>
      </View>

      {/* Listings */}
      <FlatList
        key="single-column"
        data={currentListings}
        extraData={selectedTab}
        renderItem={({ item }) => (
          <View style={styles.listingItem}>
            <View style={styles.cardContainer}>
              <Pressable
                style={styles.cardTapArea}
                onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
              >
                <View style={styles.imageContainer}>
                  <Image
                    source={item.images?.[0] ? { uri: item.images[0] } : undefined}
                    style={styles.listingImage}
                    contentFit="cover"
                    transition={200}
                  />

                  <View
                    style={[
                      styles.statusBadge,
                      item.isPaid ? styles.premiumStatusBadge : styles.activeStatusBadge,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>{item.isPaid ? 'PREMIUM' : 'ACTIVE'}</Text>
                  </View>

                  <View style={styles.conditionBadge}>
                    <Text style={styles.conditionBadgeText}>{formatCondition(item.condition)}</Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.priceText}>
                    ₹{Number(item.price || 0).toLocaleString('en-IN')}
                    {item.priceUnit ? <Text style={styles.priceUnitText}> / {item.priceUnit}</Text> : null}
                  </Text>
                  <Text style={styles.titleText} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <Feather name="map-pin" size={13} color={Colors.textTertiary} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {item.location?.city || 'Location unavailable'}
                    </Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.metaText}>{getTimeAgo(item.createdAt)}</Text>
                  </View>
                </View>

                {/* Analytics Stats Row */}
                <View style={styles.analyticsRow}>
                  <View style={styles.analyticsItem}>
                    <Feather name="eye" size={18} color="#6b7280" />
                    <Text style={styles.analyticsValue}>{item.viewCount || 0}</Text>
                    <Text style={styles.analyticsLabel}>Views</Text>
                  </View>
                  <View style={styles.analyticsDivider} />
                  <View style={styles.analyticsItem}>
                    <Feather name="heart" size={18} color="#6b7280" />
                    <Text style={styles.analyticsValue}>3</Text>
                    <Text style={styles.analyticsLabel}>Likes</Text>
                  </View>
                  <View style={styles.analyticsDivider} />
                  <View style={styles.analyticsItem}>
                    <Feather name="message-circle" size={18} color="#6b7280" />
                    <Text style={styles.analyticsValue}>2</Text>
                    <Text style={styles.analyticsLabel}>Chats</Text>
                  </View>
                </View>
              </Pressable>

              {/* Action Buttons Grid - Only for Active Tab */}
              {selectedTab === 'active' && (
                <View style={styles.actionButtonsGrid}>
                  <Pressable
                    style={[styles.actionButton, styles.editButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: '/listings/edit', params: { id: item.id } });
                    }}
                  >
                    <Feather name="edit-2" size={18} color="#374151" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                  
                  <Pressable
                    style={[styles.actionButton, styles.boostButton]}
                    onPress={(e) => handleUpgradeButton(item, e)}
                  >
                    <Feather name="trending-up" size={18} color="#fff" />
                    <Text style={styles.boostButtonText}>Upgrade</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.actionButton, styles.soldButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleMarkAsSold(item.id, item.title);
                    }}
                    disabled={markingSoldId === item.id}
                  >
                    {markingSoldId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="check-circle" size={18} color="#fff" />
                        <Text style={styles.soldButtonText}>Mark Sold</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleDelete(item.id, item.title);
                    }}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="trash-2" size={18} color="#fff" />
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {item.status === 'sold' && (
                <View style={styles.actionButtonsGrid}>
                  <Pressable
                    style={[styles.actionButton, styles.actionButtonFull, styles.restoreButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleMarkAsActive(item.id, item.title);
                    }}
                    disabled={markingActiveId === item.id}
                  >
                    {markingActiveId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="rotate-ccw" size={18} color="#fff" />
                        <Text style={styles.restoreButtonText}>Mark Active</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <AppScreenBanners banners={listingsBanners} isLoading={isListingsBannersLoading} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              {selectedTab === 'active'
                ? 'No active listings'
                : selectedTab === 'sold'
                  ? 'No sold items yet'
                  : 'No expired listings'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedTab === 'active'
                ? 'Create your first listing to get started'
                : selectedTab === 'sold'
                  ? "Items you've sold will appear here"
                  : 'Listings that have expired will show here'}
            </Text>
            {selectedTab === 'active' && (
              <Pressable style={styles.createButton} onPress={() => router.push('/(tabs)/create')}>
                <Feather name="plus" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Listing</Text>
              </Pressable>
            )}
          </View>
        }
      />

      <Modal
        visible={upgradeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeUpgradeModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeUpgradeModal} />

          <View style={styles.upgradeModalSheet}>
            <View style={styles.upgradeModalHeader}>
              <View>
                <Text style={styles.upgradeModalTitle}>Upgrade Listing</Text>
                <Text style={styles.upgradeModalSubtitle} numberOfLines={1}>
                  {selectedUpgradeItem?.title || 'Select a plan'}
                </Text>
              </View>
              <Pressable style={styles.upgradeModalCloseButton} onPress={closeUpgradeModal}>
                <Feather name="x" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.currentPlanInfo}>
              <Text style={styles.currentPlanLabel}>Current Plan</Text>
              <Text style={styles.currentPlanValue}>
                {getCurrentPlanDuration(selectedUpgradeItem)} days
              </Text>
            </View>

            <View style={styles.plansContainer}>
              {getAvailableUpgradePlans(selectedUpgradeItem).length === 0 ? (
                <View style={styles.noPlansContainer}>
                  <Text style={styles.noPlansText}>No higher plans available for this listing.</Text>
                </View>
              ) : (
                getAvailableUpgradePlans(selectedUpgradeItem).map((plan) => (
                  <View key={plan.duration} style={styles.planCard}>
                    <View style={styles.planTopRow}>
                      <View>
                        <Text style={styles.planLabel}>{plan.label}</Text>
                        <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                      </View>
                      <Text style={styles.planPrice}>₹{plan.price}</Text>
                    </View>

                    <Pressable
                      style={styles.selectPlanButton}
                      onPress={() => processUpgrade(selectedUpgradeItem.id, plan.duration, plan.price)}
                      disabled={upgradingDuration !== null}
                    >
                      {upgradingDuration === plan.duration ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.selectPlanButtonText}>Choose {plan.label}</Text>
                      )}
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <View style={styles.feedbackModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setFeedbackModalVisible(false)}
          />
          <View style={styles.feedbackModalCard}>
            <View
              style={[
                styles.feedbackIconWrap,
                feedbackModalType === 'success' ? styles.feedbackIconSuccess : styles.feedbackIconError,
              ]}
            >
              <Feather name={feedbackModalType === 'success' ? 'check' : 'x'} size={20} color="#fff" />
            </View>
            <Text style={styles.feedbackModalTitle}>{feedbackModalTitle}</Text>
            <Text style={styles.feedbackModalMessage}>{feedbackModalMessage}</Text>
            <Pressable
              style={styles.feedbackModalButton}
              onPress={() => setFeedbackModalVisible(false)}
            >
              <Text style={styles.feedbackModalButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyticsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  listingItem: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  cardContainer: {
    borderRadius: 18,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardTapArea: {
    backgroundColor: Colors.surface,
  },
  imageContainer: {
    height: 210,
    position: 'relative',
    backgroundColor: Colors.borderLight,
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  activeStatusBadge: {
    backgroundColor: '#10b981',
  },
  premiumStatusBadge: {
    backgroundColor: '#f59e0b',
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  conditionBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  conditionBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  detailsSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
  },
  priceText: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  priceUnitText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  titleText: {
    marginTop: 4,
    fontSize: 17,
    color: Colors.text,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  metaDot: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: Colors.borderLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  analyticsItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  analyticsValue: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  analyticsLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  analyticsDivider: {
    width: 1,
    height: 34,
    backgroundColor: Colors.border,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  actionButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 11,
  },
  actionButtonFull: {
    width: '100%',
  },
  editButton: {
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  boostButton: {
    backgroundColor: Colors.success,
  },
  boostButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  soldButton: {
    backgroundColor: Colors.primary,
  },
  soldButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  deleteButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  restoreButton: {
    backgroundColor: Colors.primaryDark,
  },
  restoreButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  listContent: {
    paddingTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  createButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  upgradeModalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  upgradeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  upgradeModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  upgradeModalSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    maxWidth: 260,
  },
  upgradeModalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.borderLight,
  },
  currentPlanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  currentPlanLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  currentPlanValue: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  plansContainer: {
    gap: 10,
  },
  noPlansContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  noPlansText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  planCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.surface,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  planLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  planSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  planPrice: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  selectPlanButton: {
    backgroundColor: Colors.primary,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectPlanButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  feedbackModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  feedbackModalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  feedbackIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  feedbackIconSuccess: {
    backgroundColor: Colors.success,
  },
  feedbackIconError: {
    backgroundColor: Colors.error,
  },
  feedbackModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  feedbackModalMessage: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  feedbackModalButton: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  feedbackModalButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
