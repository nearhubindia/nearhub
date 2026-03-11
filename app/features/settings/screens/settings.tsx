import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';

interface SettingItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  value?: string;
  type: 'toggle' | 'navigation' | 'action';
  onPress?: () => void;
  toggle?: boolean;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [autoLocalize, setAutoLocalize] = useState(
    user?.preferences?.autoLocalizeListings || false
  );

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/register');
        },
      },
    ]);
  };

  const accountSettings: SettingItem[] = [
    {
      icon: 'user',
      label: 'Edit Profile',
      subtitle: 'Manage personal details',
      type: 'navigation',
      onPress: () => router.push('/profile'),
    },
    {
      icon: 'lock',
      label: 'Privacy & Security',
      subtitle: 'Password and account safety',
      type: 'navigation',
      onPress: () => router.push('/settings/privacy-security'),
    },
    {
      icon: 'bell',
      label: 'Push Notifications',
      subtitle: 'Alerts for messages and activity',
      type: 'toggle',
      toggle: notifications,
      onToggle: setNotifications,
    },
    {
      icon: 'mail',
      label: 'Email Notifications',
      subtitle: 'Updates to your inbox',
      type: 'toggle',
      toggle: emailNotifications,
      onToggle: setEmailNotifications,
    },
  ];

  const appSettings: SettingItem[] = [
    {
      icon: 'map-pin',
      label: 'Auto-localize Listings',
      subtitle: 'Show nearby content automatically',
      type: 'toggle',
      toggle: autoLocalize,
      onToggle: setAutoLocalize,
    },
    {
      icon: 'globe',
      label: 'Language',
      subtitle: 'Choose your preferred language',
      value: 'English',
      type: 'navigation',
      onPress: () => router.push('/settings/language'),
    },
    {
      icon: 'moon',
      label: 'Dark Mode',
      subtitle: 'Appearance preferences',
      type: 'navigation',
      onPress: () => router.push('/settings/dark-mode'),
    },
  ];

  const supportSettings: SettingItem[] = [
    {
      icon: 'help-circle',
      label: 'Help & Support',
      subtitle: 'Contact NearHub support',
      type: 'navigation',
      onPress: () => router.push('/settings/help-support'),
    },
    {
      icon: 'file-text',
      label: 'Terms & Conditions',
      subtitle: 'Read usage terms',
      type: 'navigation',
      onPress: () => router.push('/settings/terms'),
    },
    {
      icon: 'shield',
      label: 'Privacy Policy',
      subtitle: 'How your data is handled',
      type: 'navigation',
      onPress: () => router.push('/settings/privacy-policy'),
    },
    {
      icon: 'info',
      label: 'About',
      subtitle: 'App version and details',
      value: 'v1.0.0',
      type: 'navigation',
      onPress: () => router.push('/settings/about'),
    },
  ];

  const dangerSettings: SettingItem[] = [
    {
      icon: 'trash-2',
      label: 'Delete Account',
      subtitle: 'Permanently erase your account',
      type: 'navigation',
      danger: true,
      onPress: () => router.push('/settings/delete-account'),
    },
    {
      icon: 'log-out',
      label: 'Logout',
      subtitle: 'Sign out from this device',
      type: 'action',
      danger: true,
      onPress: handleLogout,
    },
  ];

  const renderSettingItem = (item: SettingItem, index: number, items: SettingItem[]) => (
    <Pressable
      key={item.label}
      style={[styles.settingItem, index === items.length - 1 && styles.settingItemLast]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        item.onPress?.();
      }}
      disabled={item.type === 'toggle'}
      android_ripple={{ color: '#E9F0FB' }}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, item.danger && styles.iconContainerDanger]}>
          <Feather name={item.icon} size={17} color={item.danger ? Colors.accent : '#0F2748'} />
        </View>
        <View style={styles.settingCopy}>
          <Text style={[styles.settingLabel, item.danger && styles.settingLabelDanger]}>{item.label}</Text>
        </View>
      </View>
      <View style={styles.settingRight}>
        {item.type === 'toggle' ? (
          <Switch
            value={item.toggle}
            onValueChange={item.onToggle}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        ) : item.value ? (
          <>
            <Text style={styles.settingValue}>{item.value}</Text>
            <Feather name="chevron-right" size={18} color="#8192AB" />
          </>
        ) : (
          <Feather name="chevron-right" size={18} color="#8192AB" />
        )}
      </View>
    </Pressable>
  );

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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsGroup}>{accountSettings.map(renderSettingItem)}</View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          <View style={styles.settingsGroup}>{appSettings.map(renderSettingItem)}</View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingsGroup}>{supportSettings.map(renderSettingItem)}</View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={styles.settingsGroup}>{dangerSettings.map(renderSettingItem)}</View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF3FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: '#EFF3FA',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 21,
    fontFamily: 'Inter_700Bold',
    color: '#1A2C49',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#627A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 9,
    paddingHorizontal: 6,
  },
  settingsGroup: {
    backgroundColor: '#F8FAFE',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DEE7F5',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0E2445',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    paddingRight: 62,
    borderBottomWidth: 1,
    borderBottomColor: '#E6ECF7',
    position: 'relative',
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#DFEAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerDanger: {
    backgroundColor: '#FFECEF',
    borderColor: '#FFD2D8',
  },
  settingCopy: {
    flex: 1,
    marginLeft: 11,
    minWidth: 0,
  },
  settingLabel: {
    fontSize: 15.2,
    fontFamily: 'Inter_600SemiBold',
    color: '#1F2E4A',
  },
  settingLabelDanger: {
    color: Colors.accent,
  },
  settingRight: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  settingValue: {
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
    color: '#7A8CA8',
    marginRight: 5,
  },
});
