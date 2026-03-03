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
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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
    icon: 'message-circle',
    label: 'Messages',
    route: '/messages',
  },
  {
    icon: 'settings',
    label: 'Settings',
    route: '/settings',
  },
];

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
      '/messages': '/chat',
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
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
              <Feather name="x" size={responsiveModerateScale(20)} color={Colors.text} />
            </Pressable>
          </View>

          {/* Profile Section */}
          {isAuthenticated && user ? (
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0).toUpperCase() || user.phone?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name || 'User'}</Text>
                <Text style={styles.profilePhone}>{user.phone}</Text>
              </View>
            </View>
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
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            {MENU_ITEMS.map((item, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => handleMenuItemPress(item.route)}
              >
                <View style={styles.menuItemContent}>
                  <View
                    style={[
                      styles.iconContainer,
                      item.color && { backgroundColor: item.color + '15' },
                    ]}
                  >
                    <Feather
                      name={item.icon}
                      size={responsiveModerateScale(18)}
                      color={item.color || Colors.text}
                    />
                  </View>
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={responsiveModerateScale(17)}
                  color={Colors.textTertiary}
                />
              </Pressable>
            ))}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Logout */}
            {isAuthenticated && (
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={handleLogout}
              >
                <View style={styles.menuItemContent}>
                  <View style={[styles.iconContainer, { backgroundColor: Colors.accent + '15' }]}>
                    <Feather
                      name="log-out"
                      size={responsiveModerateScale(18)}
                      color={Colors.accent}
                    />
                  </View>
                  <Text style={[styles.menuItemLabel, { color: Colors.accent }]}>Logout</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
  },
  menuContainer: {
    width: '82%',
    maxWidth: responsiveWidth(90),
    height: '100%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -3, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '-4px 0 14px rgba(0,0,0,0.18)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: responsiveModerateScale(16),
    paddingBottom: responsiveModerateScale(10),
  },
  closeButton: {
    width: responsiveModerateScale(36),
    height: responsiveModerateScale(36),
    borderRadius: responsiveModerateScale(18),
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveModerateScale(16),
    paddingVertical: responsiveModerateScale(16),
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  avatar: {
    width: responsiveModerateScale(48),
    height: responsiveModerateScale(48),
    borderRadius: responsiveModerateScale(24),
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: responsiveFont(20),
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
    color: Colors.text,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: responsiveFont(13),
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveModerateScale(12),
    paddingHorizontal: responsiveModerateScale(16),
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: responsiveModerateScale(8),
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  loginText: {
    fontSize: responsiveFont(14),
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  menuScroll: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: responsiveModerateScale(12),
    paddingHorizontal: responsiveModerateScale(16),
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemPressed: {
    backgroundColor: Colors.surface,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveModerateScale(10),
  },
  iconContainer: {
    width: responsiveModerateScale(34),
    height: responsiveModerateScale(34),
    borderRadius: responsiveModerateScale(10),
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    fontSize: responsiveFont(14),
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
    marginHorizontal: 20,
  },
});
