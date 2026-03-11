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
  I18nManager,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { responsiveFont, responsiveModerateScale, responsiveWidth } from '@/lib/responsive';

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  route: string;
  color?: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: 'user',
    label: 'My Profile',
    route: '/profile',
  },
  {
    icon: 'package',
    label: 'My Listings',
    route: '/my-listings',
  },
  {
    icon: 'heart',
    label: 'Favourites',
    route: '/saved',
  },
  {
    icon: 'credit-card',
    label: 'Subscriptions',
    route: '/subscriptions',
  },
  {
    icon: 'file-text',
    label: 'Invoices',
    route: '/invoices',
  },
  {
    icon: 'settings',
    label: 'Settings',
    route: '/settings',
  },
];
const MENU_ACCENT = '#0B6DD8';

export default function ProfileMenuModal({ visible, onClose }: ProfileMenuModalProps) {
  const insets = useSafeAreaInsets();
  const { user, logout, isAuthenticated } = useAuth();
  const slideAnim = useRef(new Animated.Value(360)).current;

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
    router.replace('/auth/register');
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
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0).toUpperCase() || user.phone?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name || 'User'}</Text>
                <Text style={styles.profilePhone}>{user.phone}</Text>
                <View style={styles.memberPill}>
                  <Text style={styles.profileMeta}>NearHub member</Text>
                </View>
              </View>
            </LinearGradient>
          ) : (
            <Pressable
              style={styles.loginPrompt}
              onPress={() => {
                onClose();
                router.push('/auth/register');
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
              <Text style={styles.menuGroupTitle}>Quick Access</Text>
              {MENU_ITEMS.map((item, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  onPress={() => handleMenuItemPress(item.route)}
                >
                  <View style={styles.menuItemMain}>
                    <View
                      style={[
                        styles.iconContainer,
                        item.color && { backgroundColor: item.color + '15' },
                      ]}
                    >
                      <Feather
                        name={item.icon}
                        size={responsiveModerateScale(17)}
                        color={item.color || '#0B2545'}
                      />
                    </View>
                    <Text style={styles.menuItemLabel} numberOfLines={1} ellipsizeMode="tail">
                      {item.label}
                    </Text>
                  </View>
                  <View pointerEvents="none" style={styles.chevronWrap}>
                    <Feather
                      name="chevron-right"
                      size={responsiveModerateScale(15)}
                      color="#7A8CA6"
                      style={[
                        styles.trailingChevron,
                        I18nManager.isRTL ? styles.trailingChevronRtl : null,
                      ]}
                    />
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Logout */}
            {isAuthenticated && (
              <Pressable
                style={({ pressed }) => [
                  styles.menuItem,
                  styles.logoutItem,
                  pressed && styles.logoutItemPressed,
                ]}
                onPress={handleLogout}
              >
                <View style={styles.menuItemMain}>
                  <View style={[styles.iconContainer, { backgroundColor: Colors.accent + '15' }]}>
                    <Feather
                      name="log-out"
                      size={responsiveModerateScale(18)}
                      color={Colors.accent}
                    />
                  </View>
                  <Text
                    style={[styles.menuItemLabel, styles.logoutLabel]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Logout
                  </Text>
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
        elevation: 3,
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
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
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
  profileMeta: {
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
  },
  menuGroup: {
    marginHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4ECF8',
    paddingVertical: 14,
    paddingHorizontal: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#102949',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  menuGroupTitle: {
    marginTop: 2,
    marginBottom: 12,
    marginHorizontal: 12,
    fontSize: responsiveFont(12),
    fontFamily: 'Inter_700Bold',
    color: '#7287A6',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  menuItem: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    flexWrap: 'nowrap',
    minHeight: responsiveModerateScale(60),
    paddingVertical: responsiveModerateScale(8),
    paddingHorizontal: responsiveModerateScale(10),
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#F8FAFE',
    borderWidth: 1,
    borderColor: '#EEF3FB',
  },
  menuItemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    paddingRight: responsiveModerateScale(42),
  },
  menuItemPressed: {
    backgroundColor: '#EDF3FD',
  },
  iconContainer: {
    width: responsiveModerateScale(36),
    height: responsiveModerateScale(36),
    borderRadius: responsiveModerateScale(11),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4ECF8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: responsiveFont(14.5),
    lineHeight: responsiveFont(20),
    fontFamily: 'Inter_600SemiBold',
    color: '#12223A',
    marginLeft: responsiveModerateScale(11),
  },
  chevronWrap: {
    position: 'absolute',
    right: responsiveModerateScale(10),
    top: '50%',
    marginTop: responsiveModerateScale(-14),
    width: responsiveModerateScale(28),
    height: responsiveModerateScale(28),
    borderRadius: responsiveModerateScale(14),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4ECF8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trailingChevron: {
    marginLeft: 1.5,
  },
  trailingChevronRtl: {
    transform: [{ scaleX: -1 }],
  },
  divider: {
    height: 1,
    backgroundColor: '#DDE6F3',
    marginVertical: 14,
    marginHorizontal: 16,
  },
  logoutItem: {
    marginHorizontal: 16,
    backgroundColor: '#FFF4F6',
    borderWidth: 1,
    borderColor: '#FFDCE2',
    marginBottom: 4,
  },
  logoutItemPressed: {
    backgroundColor: '#FFE9ED',
  },
  logoutLabel: {
    color: Colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
});
