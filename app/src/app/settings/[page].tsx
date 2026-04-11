import React, { useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getApiUrl } from '@/lib/query-client';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import { useAuth } from '@/shared/contexts/auth-context';

type PageKey =
  | 'privacy-security'
  | 'help-support'
  | 'terms'
  | 'privacy-policy'
  | 'about'
  | 'delete-account'
  | 'language'
  | 'dark-mode';

interface DetailConfig {
  title: string;
  subtitle: string;
  points: string[];
}

const PAGE_CONFIG: Record<PageKey, DetailConfig> = {
  'privacy-security': {
    title: 'Privacy & Security',
    subtitle: 'Control account safety and privacy preferences.',
    points: [
      'Phone-based sign-in with OTP verification',
      'Session logout support across devices',
      'Account protection and reporting tools',
    ],
  },
  'help-support': {
    title: 'Help & Support',
    subtitle: 'Get support for listings, account, and payments.',
    points: [
      'Email: support@nearhub.com',
      'Support hours: Mon - Sat, 9:00 AM to 7:00 PM',
      'Response target: within 24 hours',
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    subtitle: 'Rules for using NearHub platform and services.',
    points: [
      'Users must provide accurate profile and listing information.',
      'Prohibited content and fraudulent activity are not allowed.',
      'NearHub may moderate or remove violating listings.',
    ],
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    subtitle: 'How we collect, use, and protect your data.',
    points: [
      'We collect profile, listing, and transaction-related data.',
      'Location access is used to personalize nearby results.',
      'You can request account data removal via support.',
    ],
  },
  about: {
    title: 'About NearHub',
    subtitle: 'Local marketplace for buying and selling nearby.',
    points: [
      'Version 1.0.0',
      'Built with React Native and Expo',
      'Focused on trusted local discovery',
    ],
  },
  'delete-account': {
    title: 'Delete Account',
    subtitle: 'Delete your account and permanently remove your data.',
    points: [
      'This action cannot be undone.',
      'Your listings and profile history will be removed.',
      'Subscriptions and invoices may remain for compliance.',
    ],
  },
  language: {
    title: 'Language',
    subtitle: 'Select your preferred app language.',
    points: [
      'English is currently the default language.',
      'More language packs will be added in upcoming releases.',
    ],
  },
  'dark-mode': {
    title: 'Dark Mode',
    subtitle: 'Choose your app appearance mode.',
    points: ['System mode support is planned.', 'Dark theme rollout is in progress.'],
  },
};

const LANGUAGE_OPTIONS = ['English'];
const THEME_OPTIONS = ['System Default'];
const SUPPORT_QUERY_URL = 'https://nearhub.in/contact';

export default function SettingDetailScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const { user, logout } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedTheme, setSelectedTheme] = useState('System Default');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const key = (page || '') as PageKey;
  const config = useMemo(() => PAGE_CONFIG[key], [key]);

  if (!config) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color="#1F2E4A" />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.rightPad} />
        </View>
        <View style={styles.fallbackWrap}>
          <Text style={styles.fallbackTitle}>Page not found</Text>
          <Text style={styles.fallbackSubtitle}>This settings page is unavailable.</Text>
        </View>
      </View>
    );
  }

  const handleHelpAction = async () => {
    const emailUrl = 'mailto:support@nearhub.com';
    const canOpenEmail = await Linking.canOpenURL(emailUrl);
    if (canOpenEmail) {
      await Linking.openURL(emailUrl);
      return;
    }
    Alert.alert('Support', 'Email client is not available on this device.');
  };

  const handleSupportQueryLink = async () => {
    const canOpenUrl = await Linking.canOpenURL(SUPPORT_QUERY_URL);
    if (canOpenUrl) {
      await Linking.openURL(SUPPORT_QUERY_URL);
      return;
    }
    Alert.alert('Support', 'Unable to open support webpage right now.');
  };

  const confirmDeleteAccount = () => {
    if (!user?.id) {
      Alert.alert('Delete Account', 'Please login again and try deleting your account.');
      return;
    }
    if (isDeletingAccount) return;

    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              const response = await fetch(`${getApiUrl()}/api/users/profile`, {
                method: 'DELETE',
                headers: buildUserAuthHeaders({ id: user.id, phone: user.phone }),
              });

              const payload = await response.json().catch(() => null);
              if (!response.ok) {
                const message =
                  payload?.error ||
                  payload?.message ||
                  `Failed to delete account (${response.status})`;
                throw new Error(message);
              }

              await logout();
              Alert.alert('Account Deleted', 'Your account has been deleted successfully.', [
                {
                  text: 'OK',
                  onPress: () => router.replace('/auth/register'),
                },
              ]);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete account';
              Alert.alert('Delete Failed', message);
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    confirmDeleteAccount();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          android_ripple={{ color: '#E9F0FB' }}
        >
          <Feather name="arrow-left" size={22} color="#1F2E4A" />
        </Pressable>
        <Text style={styles.headerTitle}>{config.title}</Text>
        <View style={styles.rightPad} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{config.title}</Text>
          <Text style={styles.heroSubtitle}>{config.subtitle}</Text>
        </View>

        <View style={styles.group}>
          {config.points.map((point) => (
            <View key={point} style={styles.pointRow}>
              <Feather name="check-circle" size={16} color="#0B6DD8" style={styles.pointIcon} />
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>

        {key === 'help-support' ? (
          <Pressable
            style={styles.group}
            onPress={handleSupportQueryLink}
            android_ripple={{ color: '#E9F0FB' }}
          >
            <View style={styles.pointRow}>
              <Feather name="external-link" size={16} color="#0B6DD8" style={styles.pointIcon} />
              <Text style={[styles.pointText, styles.supportLinkText]}>
                For Any Queries: {SUPPORT_QUERY_URL}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {key === 'help-support' ? (
          <Pressable
            style={styles.ctaButton}
            onPress={handleHelpAction}
            android_ripple={{ color: '#0A66CA' }}
          >
            <Feather name="mail" size={17} color="#FFFFFF" />
            <Text style={styles.ctaTextWithIcon}>Email Support</Text>
          </Pressable>
        ) : null}

        {key === 'language' ? (
          <View style={styles.group}>
            {LANGUAGE_OPTIONS.map((option) => {
              const active = selectedLanguage === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => setSelectedLanguage(option)}
                  android_ripple={{ color: '#E9F0FB' }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option}
                  </Text>
                  <Feather
                    name={active ? 'check-circle' : 'circle'}
                    size={18}
                    color={active ? '#0B6DD8' : '#A0AFC6'}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {key === 'dark-mode' ? (
          <View style={styles.group}>
            {THEME_OPTIONS.map((option) => {
              const active = selectedTheme === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => setSelectedTheme(option)}
                  android_ripple={{ color: '#E9F0FB' }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option}
                  </Text>
                  <Feather
                    name={active ? 'check-circle' : 'circle'}
                    size={18}
                    color={active ? '#0B6DD8' : '#A0AFC6'}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {key === 'delete-account' ? (
          <Pressable
            style={[
              styles.ctaButton,
              styles.dangerCta,
              isDeletingAccount && styles.ctaButtonDisabled,
            ]}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            android_ripple={{ color: '#CC334D' }}
          >
            {isDeletingAccount ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.ctaTextWithIcon}>Deleting account...</Text>
              </>
            ) : (
              <>
                <Feather name="trash-2" size={17} color="#FFFFFF" />
                <Text style={styles.ctaTextWithIcon}>Request Account Deletion</Text>
              </>
            )}
          </Pressable>
        ) : null}
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
    flex: 1,
    marginLeft: 10,
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: '#1A2C49',
  },
  rightPad: {
    width: 40,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DEE7F5',
    backgroundColor: '#F8FAFE',
    padding: 14,
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#1D2F4C',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
    color: '#6F83A2',
  },
  group: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DEE7F5',
    backgroundColor: '#F8FAFE',
    overflow: 'hidden',
    marginBottom: 14,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6ECF7',
  },
  pointIcon: {
    marginRight: 9,
    marginTop: 1,
  },
  pointText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: '#2B3A56',
    fontFamily: 'Inter_400Regular',
  },
  supportLinkText: {
    color: '#0B6DD8',
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'underline',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6ECF7',
  },
  optionRowActive: {
    backgroundColor: '#EDF4FF',
  },
  optionText: {
    fontSize: 14.2,
    fontFamily: 'Inter_500Medium',
    color: '#273653',
  },
  optionTextActive: {
    color: '#0B6DD8',
    fontFamily: 'Inter_600SemiBold',
  },
  ctaButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0B6DD8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerCta: {
    backgroundColor: '#E14E68',
  },
  ctaButtonDisabled: {
    opacity: 0.82,
  },
  ctaText: {
    fontSize: 14.2,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  ctaTextWithIcon: {
    marginLeft: 8,
    fontSize: 14.2,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  fallbackWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  fallbackTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#1A2C49',
  },
  fallbackSubtitle: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6F83A2',
    textAlign: 'center',
  },
});
