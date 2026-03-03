import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  Text,
  Platform,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { NotificationBell } from '@/shared/components/NotificationBell';
import { Logo } from '@/shared/components/Logo';
import BrandWordmark from '@/shared/components/BrandWordmark';

interface AppHeaderProps {
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  title?: string;
  showNav?: boolean;
}

const CATEGORIES = [
  { label: 'All', icon: 'grid' },
  { label: 'Electronics', icon: 'smartphone' },
  { label: 'Vehicles', icon: 'truck' },
  { label: 'Real Estate', icon: 'home' },
  { label: 'Jobs', icon: 'briefcase' },
  { label: 'Services', icon: 'tool' },
  { label: 'Furniture', icon: 'layers' },
  { label: 'Clothing', icon: 'shopping-bag' },
  { label: 'Home & Garden', icon: 'sun' },
  { label: 'Sports', icon: 'activity' },
  { label: 'Education', icon: 'book' },
  { label: 'Pets', icon: 'heart' },
  { label: 'Other', icon: 'more-horizontal' },
];

export function AppHeader({
  selectedCategory = 'All',
  onCategoryChange,
  title = 'NearHub',
  showNav = true,
}: AppHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const slideAnim = new Animated.Value(1);

  useEffect(() => {
    if (showMenu) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showMenu]);

  const menuItems = [
    {
      label: 'Profile',
      icon: 'user',
      onPress: () => {
        router.push('/profile');
        setShowMenu(false);
      },
    },
    {
      label: 'My Listings',
      icon: 'package',
      onPress: () => {
        router.push('/my-listings');
        setShowMenu(false);
      },
    },
    {
      label: 'Saved',
      icon: 'heart',
      onPress: () => {
        router.push('/saved');
        setShowMenu(false);
      },
    },
    {
      label: 'Messages',
      icon: 'message-circle',
      onPress: () => {
        router.push('/chat/');
        setShowMenu(false);
      },
    },
    {
      label: 'Invoices',
      icon: 'file-text',
      onPress: () => {
        router.push('/invoices');
        setShowMenu(false);
      },
    },
    {
      label: 'Settings',
      icon: 'settings',
      onPress: () => {
        router.push('/settings');
        setShowMenu(false);
      },
    },
    {
      label: 'Help & Support',
      icon: 'help-circle',
      onPress: () => {
        alert('Help & Support');
        setShowMenu(false);
      },
    },
    {
      label: 'About',
      icon: 'info',
      onPress: () => {
        alert('About NearHub');
        setShowMenu(false);
      },
    },
  ];

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: isDark ? '#1f2937' : '#fff',
          paddingTop: insets.top,
          borderBottomColor: isDark ? '#374151' : '#e5e7eb',
        },
      ]}
    >
      {/* Logo and Title Row */}
      <View style={styles.titleRow}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.7}
          style={styles.logoContainer}
        >
          {title === 'NearHub' ? (
            <Logo size="md" showText={true} />
          ) : (
            <Text style={[styles.appTitle, { color: isDark ? '#f3f4f6' : '#1f2937' }]}>
              {title}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <NotificationBell />
          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            activeOpacity={0.7}
            style={styles.menuButton}
          >
            <Feather name="menu" size={24} color={isDark ? '#f3f4f6' : '#1f2937'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Navigation */}
      {showNav && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.navScroll}
          contentContainerStyle={styles.navContent}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.label}
              style={[
                styles.categoryTab,
                selectedCategory === category.label && [
                  styles.categoryTabActive,
                  { backgroundColor: Colors.light.tint },
                ],
              ]}
              onPress={() => onCategoryChange?.(category.label)}
              activeOpacity={0.7}
            >
              <Feather
                name={category.icon as any}
                size={14}
                color={
                  selectedCategory === category.label ? '#fff' : isDark ? '#9ca3af' : '#6b7280'
                }
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  selectedCategory === category.label && styles.categoryLabelActive,
                  {
                    color:
                      selectedCategory === category.label ? '#fff' : isDark ? '#9ca3af' : '#6b7280',
                  },
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Side Drawer Menu - Slides from Right */}
      <Modal
        visible={showMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowMenu(false)}
      >
        <View style={styles.drawerOverlay}>
          {/* Backdrop */}
          <Pressable style={styles.backdropPress} onPress={() => setShowMenu(false)} />

          {/* Drawer Container */}
          <Animated.View
            style={[
              styles.drawerContainer,
              {
                backgroundColor: isDark ? '#1f2937' : '#fff',
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 300],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Close Button */}
            <View style={[styles.drawerHeader, { paddingTop: insets.top }]}>
              <Text style={[styles.drawerTitle, { color: isDark ? '#f3f4f6' : '#1f2937' }]}>
                Menu
              </Text>
              <Pressable onPress={() => setShowMenu(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color={isDark ? '#f3f4f6' : '#1f2937'} />
              </Pressable>
            </View>

            {/* Menu Items */}
            <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={false}>
              {menuItems.map((item, index) => (
                <Pressable key={item.label} style={styles.drawerItem} onPress={item.onPress}>
                  <Feather
                    name={item.icon as any}
                    size={20}
                    color={Colors.light.tint}
                    style={{ marginRight: 16 }}
                  />
                  <Text style={[styles.drawerItemText, { color: isDark ? '#f3f4f6' : '#1f2937' }]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    borderBottomWidth: 1,
    backgroundColor: '#fff',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'web' ? 70 : 50,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  backdropPress: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContainer: {
    width: '70%',
    maxWidth: 300,
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
  },
  drawerContent: {
    flex: 1,
    paddingVertical: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  menuContainer: {
    marginHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  navScroll: {
    maxHeight: 50,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  navContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    minWidth: 80,
    justifyContent: 'center',
  },
  categoryTabActive: {
    backgroundColor: Colors.light.tint,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  categoryLabelActive: {
    color: '#fff',
  },
});
