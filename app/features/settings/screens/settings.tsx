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
      type: 'navigation',
      onPress: () => router.push('/profile'),
    },
    {
      icon: 'lock',
      label: 'Privacy & Security',
      type: 'navigation',
      onPress: () => Alert.alert('Coming Soon', 'Privacy settings will be available soon'),
    },
    {
      icon: 'bell',
      label: 'Push Notifications',
      type: 'toggle',
      toggle: notifications,
      onToggle: setNotifications,
    },
    {
      icon: 'mail',
      label: 'Email Notifications',
      type: 'toggle',
      toggle: emailNotifications,
      onToggle: setEmailNotifications,
    },
  ];

  const appSettings: SettingItem[] = [
    {
      icon: 'map-pin',
      label: 'Auto-localize Listings',
      type: 'toggle',
      toggle: autoLocalize,
      onToggle: setAutoLocalize,
    },
    {
      icon: 'globe',
      label: 'Language',
      value: 'English',
      type: 'navigation',
      onPress: () => Alert.alert('Coming Soon', 'Language selection coming soon'),
    },
    {
      icon: 'moon',
      label: 'Dark Mode',
      type: 'navigation',
      onPress: () => Alert.alert('Coming Soon', 'Dark mode coming soon'),
    },
  ];

  const supportSettings: SettingItem[] = [
    {
      icon: 'help-circle',
      label: 'Help & Support',
      type: 'navigation',
      onPress: () => Alert.alert('Help', 'Contact us at support@nearhub.com'),
    },
    {
      icon: 'file-text',
      label: 'Terms & Conditions',
      type: 'navigation',
      onPress: () => Alert.alert('Coming Soon', 'Terms & conditions coming soon'),
    },
    {
      icon: 'shield',
      label: 'Privacy Policy',
      type: 'navigation',
      onPress: () => Alert.alert('Coming Soon', 'Privacy policy coming soon'),
    },
    {
      icon: 'info',
      label: 'About',
      value: 'v1.0.0',
      type: 'navigation',
      onPress: () => Alert.alert('NearHub', 'Version 1.0.0\n\nYour local marketplace'),
    },
  ];

  const dangerSettings: SettingItem[] = [
    {
      icon: 'trash-2',
      label: 'Delete Account',
      type: 'action',
      danger: true,
      onPress: () => {
        Alert.alert(
          'Delete Account',
          'This action cannot be undone. All your data will be permanently deleted.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => Alert.alert('Coming Soon', 'Account deletion will be available soon'),
            },
          ]
        );
      },
    },
    {
      icon: 'log-out',
      label: 'Logout',
      type: 'action',
      danger: true,
      onPress: handleLogout,
    },
  ];

  const renderSettingItem = (item: SettingItem) => (
    <Pressable
      key={item.label}
      style={({ pressed }) => [styles.settingItem, pressed && styles.settingItemPressed]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        item.onPress?.();
      }}
      disabled={item.type === 'toggle'}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, item.danger && styles.iconContainerDanger]}>
          <Feather name={item.icon} size={18} color={item.danger ? Colors.accent : Colors.text} />
        </View>
        <Text style={[styles.settingLabel, item.danger && styles.settingLabelDanger]}>
          {item.label}
        </Text>
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
            <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
          </>
        ) : (
          <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  settingsGroup: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingItemPressed: {
    backgroundColor: Colors.background,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerDanger: {
    backgroundColor: Colors.accent + '15',
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  settingLabelDanger: {
    color: Colors.accent,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
});
