import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { useMessages } from '@/shared/contexts/messages-context';
import { responsiveFont, responsiveModerateScale, responsiveWidth } from '@/lib/responsive';

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle: string;
  route: string;
  color?: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: 'user',
    label: 'My Profile',
    subtitle: 'View & Edit',
    route: '/profile',
    color: '#0E5FC7',
  },
  {
    icon: 'package',
    label: 'My Listings',
    subtitle: 'Manage items',
    route: '/my-listings',
    color: '#2667FF',
  },
  {
    icon: 'heart',
    label: 'Favourites',
    subtitle: 'Saved items',
    route: '/saved',
    color: '#E11D48',
  },
  {
    icon: 'message-circle',
    label: 'Messages',
    subtitle: 'Chats & replies',
    route: '/messages',
    color: '#0EA5E9',
  },
  {
    icon: 'credit-card',
    label: 'Subscriptions',
    subtitle: 'Plans & billing',
    route: '/subscriptions',
    color: '#7C3AED',
  },
  {
    icon: 'file-text',
    label: 'Invoices',
    subtitle: 'Payments & Bills',
    route: '/invoices',
    color: '#0F766E',
  },
  {
    icon: 'shopping-bag',
    label: 'Purchased Deals',
    subtitle: 'Bookings & vouchers',
    route: '/bookings',
    color: '#0759E6',
  },
  {
    icon: 'inbox',
    label: 'Deal Bookings',
    subtitle: 'Seller purchases',
    route: '/deal-bookings',
    color: '#0B6DD8',
  },
  {
    icon: 'settings',
    label: 'Settings',
    subtitle: 'Preferences',
    route: '/settings',
    color: '#334155',
  },
];
const MENU_ACCENT = '#0B6DD8';

export default function ProfileMenuModal({ visible, onClose }: ProfileMenuModalProps) {
  const insets = useSafeAreaInsets();
  const { user, logout, isAuthenticated } = useAuth();
  const { unreadChatsCount } = useMessages();
  const pathname = usePathname();
  const authRedirect = pathname && pathname !== '/auth/register' ? pathname : '';
  const slideAnim = useRef(new Animated.Value(360)).current;
  const unreadChatsLabel = unreadChatsCount > 99 ? '99+' : String(unreadChatsCount);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
      return;
    }

    slideAnim.setValue(360);
  }, [visible, slideAnim]);

  const handleMenuItemPress = (route: string) => {
    onClose();

    // Map to existing routes
    const routeMap: { [key: string]: string } = {
      '/saved': '/(tabs)/saved',
      '/messages': '/(tabs)/messages',
      '/invoices': '/(tabs)/invoices',
      // Other routes will be handled as-is when implemented
    };

    const actualRoute = routeMap[route] || route;

    setTimeout(() => {
      try {
        router.push(actualRoute as any);
      } catch (error) {
        console.log(`Route ${actualRoute} not yet implemented`);
        // Optionally show a toast or alert
      }
    }, 300);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace({
      pathname: '/auth/register',
      params: authRedirect ? { redirect: authRedirect } : undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="none" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.menuContainer,
            {
              paddingTop: insets.top + 16,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View pointerEvents="none" style={styles.chromeOrbPrimary} />
          <View pointerEvents="none" style={styles.chromeOrbSecondary} />
          <View style={styles.topHandle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Account</Text>
              <Text style={styles.headerSubtitle}>Manage your NearHub profile</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <Feather name="x" size={responsiveModerateScale(20)} color="#0B2545" />
            </Pressable>
          </View>

          {/* Profile Section */}
          {isAuthenticated && user ? (
            <LinearGradient
              colors={['#0B6DD8', '#2A8CF2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileSection}
            >
              <View style={styles.avatar}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {user.name?.charAt(0).toUpperCase() || user.phone?.charAt(0) || 'U'}
                  </Text>
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name || 'User'}</Text>
                <Text style={styles.profilePhone}>{user.phone}</Text>
                <View style={styles.profileMetaRow}>
                  <View style={styles.memberPill}>
                    <Text style={styles.profileMeta}>NearHub member</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          ) : (
            <Pressable
              style={styles.loginPrompt}
              onPress={() => {
                onClose();
                router.push({
                  pathname: '/auth/register',
                  params: authRedirect ? { redirect: authRedirect } : undefined,
                });
              }}
            >
              <Feather name="log-in" size={responsiveModerateScale(18)} color={Colors.primary} />
              <Text style={styles.loginText}>Sign In / Register</Text>
            </Pressable>
          )}

          {/* Menu Items */}
          <ScrollView
            style={styles.menuScroll}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={Platform.OS === 'android'}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            <View style={styles.menuGroup}>
              <View style={styles.menuGroupHeader}>
                <Text style={styles.menuGroupTitle}>Quick Access</Text>
                <View style={styles.swapButton}>
                  <Feather
                    name="repeat"
                    size={responsiveModerateScale(16)}
                    color={Colors.primary}
                  />
                </View>
              </View>

              <View style={styles.menuGrid}>
                {MENU_ITEMS.map((item) => (
                  <Pressable
                    key={item.route}
                    style={styles.menuCard}
                    android_ripple={{ color: '#E6EEFC' }}
                    onPress={() => handleMenuItemPress(item.route)}
                  >
                    <View
                      style={[
                        styles.menuCardIcon,
                        item.color && { backgroundColor: item.color + '20' },
                      ]}
                    >
                      <Feather
                        name={item.icon}
                        size={responsiveModerateScale(16)}
                        color={item.color || '#12223A'}
                      />
                    </View>
                    <View style={styles.menuCardBody}>
                      <View style={styles.menuCardTitleRow}>
                        <Text style={styles.menuCardTitle}>{item.label}</Text>
                        {item.route === '/messages' && unreadChatsCount > 0 ? (
                          <View style={styles.menuUnreadBadge}>
                            <Text style={styles.menuUnreadBadgeText}>{unreadChatsLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.menuCardSubtitle}>
                        {item.route === '/messages' && unreadChatsCount > 0
                          ? `${unreadChatsLabel} unread chats`
                          : item.subtitle}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Logout */}
            {isAuthenticated && (
              <Pressable
                style={styles.logoutPill}
                android_ripple={{ color: '#F4E5E8' }}
                onPress={handleLogout}
              >
                <View style={styles.logoutLeft}>
                  <View style={styles.logoutIcon}>
                    <Feather
                      name="log-out"
                      size={responsiveModerateScale(19)}
                      color={Colors.accent}
                    />
                  </View>
                  <Text style={styles.logoutLabel}>Logout</Text>
                </View>
              </Pressable>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 17, 32, 0.52)',
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
  },
  menuContainer: {
    width: '84%',
    maxWidth: responsiveWidth(92),
    height: '100%',
    maxHeight: '100%',
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#EFF3FA',
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    ...Platform.select({
      ios: {
        shadowColor: '#0A1C33',
        shadowOffset: { width: -6, height: 0 },
        shadowOpacity: 0.24,
        shadowRadius: 22,
      },
      android: {
        elevation: 22,
      },
      web: {
        boxShadow: '-6px 0 24px rgba(8,22,45,0.26)',
      },
    }),
  },
  chromeOrbPrimary: {
    position: 'absolute',
    top: -44,
    right: -34,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(11,109,216,0.10)',
  },
  chromeOrbSecondary: {
    position: 'absolute',
    top: 110,
    left: -52,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(42,140,242,0.08)',
  },
  topHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CFDAEB',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveModerateScale(18),
    paddingBottom: responsiveModerateScale(14),
  },
  headerTitle: {
    fontSize: responsiveFont(16),
    fontFamily: 'Inter_700Bold',
    color: MENU_ACCENT,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: responsiveFont(11),
    fontFamily: 'Inter_500Medium',
    color: '#7084A3',
  },
  closeButton: {
    width: responsiveModerateScale(44),
    height: responsiveModerateScale(44),
    borderRadius: responsiveModerateScale(22),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7F6',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0C2B4A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveModerateScale(16),
    paddingVertical: responsiveModerateScale(18),
    marginHorizontal: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#0A4F9B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  avatar: {
    width: responsiveModerateScale(54),
    height: responsiveModerateScale(54),
    borderRadius: responsiveModerateScale(27),
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: responsiveFont(24),
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: responsiveFont(16),
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: responsiveFont(14),
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.92)',
  },
  memberPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  profileMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileMeta: {
    fontSize: responsiveFont(11),
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  unreadPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(14, 165, 233, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unreadPillText: {
    fontSize: responsiveFont(11),
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveModerateScale(12),
    paddingHorizontal: responsiveModerateScale(16),
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    gap: responsiveModerateScale(8),
    borderWidth: 1,
    borderColor: '#CFE2FF',
  },
  loginText: {
    fontSize: responsiveFont(14),
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  menuScroll: {
    flex: 1,
    minHeight: 0,
  },
  menuGroup: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  menuGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  menuGroupTitle: {
    marginTop: 2,
    marginLeft: 4,
    fontSize: responsiveFont(17),
    fontFamily: 'Inter_700Bold',
    color: '#273553',
    letterSpacing: 0.2,
  },
  swapButton: {
    width: responsiveModerateScale(36),
    height: responsiveModerateScale(36),
    borderRadius: responsiveModerateScale(11),
    backgroundColor: '#EDF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DEE9FF',
  },
  menuGrid: {
    gap: 10,
  },
  menuCard: {
    minHeight: responsiveModerateScale(76),
    borderRadius: 18,
    backgroundColor: '#F2F6FD',
    borderWidth: 1,
    borderColor: '#E5ECFA',
    paddingHorizontal: responsiveModerateScale(10),
    paddingVertical: responsiveModerateScale(10),
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F2546',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  menuCardIcon: {
    width: responsiveModerateScale(38),
    height: responsiveModerateScale(38),
    borderRadius: responsiveModerateScale(12),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E9F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveModerateScale(10),
  },
  menuCardBody: {
    flex: 1,
    minWidth: 0,
  },
  menuCardTitle: {
    fontSize: responsiveFont(13.6),
    lineHeight: responsiveModerateScale(18),
    fontFamily: 'Inter_600SemiBold',
    color: '#2A3553',
  },
  menuCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  menuCardSubtitle: {
    marginTop: 2,
    fontSize: responsiveFont(11),
    lineHeight: responsiveModerateScale(15),
    fontFamily: 'Inter_500Medium',
    color: '#7484A2',
  },
  menuUnreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B6DD8',
  },
  menuUnreadBadgeText: {
    fontSize: responsiveFont(10),
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#DDE6F3',
    marginVertical: 12,
    marginHorizontal: 16,
  },
  logoutPill: {
    marginHorizontal: 16,
    minHeight: responsiveModerateScale(54),
    borderRadius: 18,
    backgroundColor: '#F6F9FD',
    borderWidth: 1,
    borderColor: '#E5ECF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveModerateScale(13),
    marginBottom: 8,
  },
  logoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutIcon: {
    width: responsiveModerateScale(34),
    height: responsiveModerateScale(34),
    borderRadius: responsiveModerateScale(11),
    backgroundColor: '#FFECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutLabel: {
    marginLeft: responsiveModerateScale(10),
    fontSize: responsiveFont(15),
    color: Colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
});
