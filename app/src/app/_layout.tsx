import '@/lib/button-style-normalizer';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname } from 'expo-router';
import React, { useEffect, useCallback } from 'react';
import Constants from 'expo-constants';
import { InteractionManager, LogBox, Platform, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import * as Linking from 'expo-linking';
// import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { getApiUrl, queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/shared/contexts/auth-context';
import { ListingsProvider } from '@/shared/contexts/listings-context';
import { MessagesProvider } from '@/shared/contexts/messages-context';
import { SearchHistoryProvider } from '@/shared/contexts/search-history-context';
import { UserInterestsProvider } from '@/shared/contexts/user-interests-context';
import { NotificationsProvider } from '@/shared/contexts/notifications-context';
import { NotificationCenter } from '@/shared/components/NotificationCenter';
import { maybeHandleDeferredListingDeepLink } from '@/lib/deferred-listing-deeplink';
import { getAppDownloadUrl } from '@/lib/config';
import {
  initializeFirebaseAnalytics,
  setAnalyticsUser,
  trackScreenView,
} from '@/lib/firebase-analytics';

// Keep the splash screen visible while we fetch resources
void SplashScreen.preventAutoHideAsync();
if (__DEV__) {
  const globalKey = '__nearhubSafeAreaWarnPatched__';
  const globalRef = globalThis as unknown as Record<string, unknown>;
  if (!globalRef[globalKey]) {
    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);
    const isSafeAreaDeprecationLog = (args: unknown[]): boolean => {
      const joined = args
        .map((arg) => (typeof arg === 'string' ? arg : ''))
        .filter(Boolean)
        .join(' ');

      return (
        joined.includes('SafeAreaView has been deprecated') &&
        joined.includes('react-native-safe-area-context')
      );
    };

    console.warn = (...args: unknown[]) => {
      if (isSafeAreaDeprecationLog(args)) {
        return;
      }
      originalWarn(...args);
    };

    console.error = (...args: unknown[]) => {
      if (isSafeAreaDeprecationLog(args)) {
        return;
      }
      originalError(...args);
    };
    globalRef[globalKey] = true;
  }
}
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  '`SafeAreaView` has been deprecated',
  "SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.",
]);

type HardUpdateStatus = {
  required: boolean;
  message: string;
  storeUrl: string;
  minVersion?: string;
};

const HARD_UPDATE_VERSION_KEYS = [
  'minSupportedVersion',
  'minimumSupportedVersion',
  'minAppVersion',
  'forceUpdateMinVersion',
];
const HARD_UPDATE_BUILD_KEYS = [
  'minSupportedBuildNumber',
  'minimumSupportedBuildNumber',
  'minBuildNumber',
  'forceUpdateMinBuildNumber',
];
const HARD_UPDATE_ANDROID_BUILD_KEYS = [
  'minSupportedAndroidBuildNumber',
  'minimumAndroidBuildNumber',
  'minAndroidBuildNumber',
  'forceUpdateMinAndroidBuildNumber',
];
const HARD_UPDATE_IOS_BUILD_KEYS = [
  'minSupportedIosBuildNumber',
  'minimumIosBuildNumber',
  'minIosBuildNumber',
  'forceUpdateMinIosBuildNumber',
];
const HARD_UPDATE_MESSAGE_KEYS = [
  'forceUpdateMessage',
  'hardUpdateMessage',
  'updateRequiredMessage',
];
const HARD_UPDATE_URL_KEYS = ['forceUpdateUrl', 'appUpdateUrl', 'playStoreUrl', 'appStoreUrl'];
const HARD_UPDATE_ENABLED_KEYS = ['forceUpdateEnabled', 'hardUpdateEnabled'];

function getFirstString(settings: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = settings[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function getFirstNumber(settings: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = settings[key];
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function compareVersionStrings(currentVersion: string, minVersion: string): number {
  const currentParts = currentVersion.split('.').map((part) => Number(part) || 0);
  const minParts = minVersion.split('.').map((part) => Number(part) || 0);
  const maxLength = Math.max(currentParts.length, minParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const current = currentParts[index] ?? 0;
    const min = minParts[index] ?? 0;
    if (current > min) return 1;
    if (current < min) return -1;
  }
  return 0;
}

function resolveHardUpdateStatus(settings: Record<string, unknown>): HardUpdateStatus {
  const explicitEnabled = HARD_UPDATE_ENABLED_KEYS.some((key) => settings[key] === true);
  const explicitDisabled = HARD_UPDATE_ENABLED_KEYS.some((key) => settings[key] === false);
  const currentVersion = String(
    Constants.nativeAppVersion || Constants.expoConfig?.version || '0.0.0'
  ).trim();
  const currentBuild = Number(Constants.nativeBuildVersion);

  const minVersion = getFirstString(settings, HARD_UPDATE_VERSION_KEYS);
  const platformBuildKeys =
    Platform.OS === 'android'
      ? [...HARD_UPDATE_ANDROID_BUILD_KEYS, ...HARD_UPDATE_BUILD_KEYS]
      : Platform.OS === 'ios'
        ? [...HARD_UPDATE_IOS_BUILD_KEYS, ...HARD_UPDATE_BUILD_KEYS]
        : HARD_UPDATE_BUILD_KEYS;
  const minBuild = getFirstNumber(settings, platformBuildKeys);

  const hasConstraints = Boolean(minVersion || minBuild);
  const canEvaluate = explicitEnabled || (hasConstraints && !explicitDisabled);
  if (!canEvaluate || Platform.OS === 'web') {
    return { required: false, message: '', storeUrl: getAppDownloadUrl() };
  }

  let required = false;
  if (typeof minBuild === 'number' && Number.isFinite(currentBuild)) {
    required = currentBuild < minBuild;
  }
  if (!required && minVersion) {
    required = compareVersionStrings(currentVersion, minVersion) < 0;
  }

  const storeUrl = getFirstString(settings, HARD_UPDATE_URL_KEYS) || getAppDownloadUrl();
  const message =
    getFirstString(settings, HARD_UPDATE_MESSAGE_KEYS) ||
    'A new app version is required to continue. Please update now.';

  return { required, message, storeUrl, minVersion };
}

function HardUpdateScreen({ message, storeUrl }: { message: string; storeUrl: string }) {
  const openStore = useCallback(async () => {
    try {
      await Linking.openURL(storeUrl);
    } catch (error) {
      console.warn('[HardUpdate] Failed to open store URL:', error);
    }
  }, [storeUrl]);

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
    >
      <Text
        style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' }}
      >
        Update Required
      </Text>
      <Text
        style={{
          marginTop: 12,
          fontSize: 15,
          lineHeight: 22,
          fontFamily: 'Inter_400Regular',
          color: '#4B5563',
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={openStore}
        style={{
          marginTop: 24,
          backgroundColor: '#2563EB',
          borderRadius: 12,
          paddingHorizontal: 24,
          paddingVertical: 12,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>
          Update Now
        </Text>
      </Pressable>
    </View>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="search"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="search-results"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="home-section-list"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="categories"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="listing/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="listings/edit"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="chat/index"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="chat/[listingId]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="auth/register"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="auth/verify-otp"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="auth/select-plan"
        options={{
          headerShown: false,
          presentation: 'card',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="auth/complete-profile"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="user/[userId]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="my-listings"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create-listing"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="create-deal"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="subscriptions"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

function AppTelemetry() {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    void initializeFirebaseAnalytics();
  }, []);

  useEffect(() => {
    void setAnalyticsUser(
      user
        ? {
            id: user.id,
            plan: user.plan,
            city: user.location?.city,
          }
        : null
    );
  }, [user]);

  useEffect(() => {
    if (!pathname) return;
    void trackScreenView(pathname);
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const hasHiddenSplash = React.useRef(false);
  const [isVersionCheckComplete, setIsVersionCheckComplete] = React.useState(Platform.OS === 'web');
  const [hardUpdateStatus, setHardUpdateStatus] = React.useState<HardUpdateStatus>({
    required: false,
    message: '',
    storeUrl: getAppDownloadUrl(),
  });

  const hideSplashOnce = useCallback(async () => {
    if (hasHiddenSplash.current) return;
    hasHiddenSplash.current = true;
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimer = setTimeout(() => {
      if (cancelled) return;
      void hideSplashOnce();
    }, 1800);

    async function prepare() {
      if (Platform.OS === 'android') {
        try {
          // Edge-to-edge mode does not support setBackgroundColorAsync.
          await NavigationBar.setButtonStyleAsync('dark');
        } catch (error) {
          console.warn('[SystemUI] Failed to apply Android navigation bar style:', error);
        }
      }
      // Hide splash as soon as first frame is ready (remove fixed startup delay).
      requestAnimationFrame(() => {
        if (cancelled) return;
        void hideSplashOnce();
      });
    }

    void prepare();
    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, [hideSplashOnce]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsVersionCheckComplete(true);
      return;
    }

    let cancelled = false;
    const supportsAbortController = typeof AbortController !== 'undefined';
    const controller = supportsAbortController ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) {
        controller.abort();
      }
    }, 8000);

    const checkHardUpdate = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/admin/settings`, {
          ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response.ok) return;

        const data = await response.json().catch(() => null);
        const settings = (data?.settings || {}) as Record<string, unknown>;
        const status = resolveHardUpdateStatus(settings);
        if (!cancelled) {
          setHardUpdateStatus(status);
        }
      } catch (error) {
        console.warn('[HardUpdate] Settings fetch skipped:', error);
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setIsVersionCheckComplete(true);
        }
      }
    };

    void checkHardUpdate();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (controller) {
        controller.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!fontsLoaded || hardUpdateStatus.required) return;

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      maybeHandleDeferredListingDeepLink().catch((error) => {
        console.warn('[DeepLink] Failed handling deferred listing deep link:', error);
      });
    });

    return () => {
      interactionTask.cancel();
    };
  }, [fontsLoaded, hardUpdateStatus.required]);

  const AppProviders = View; // Platform.OS === 'web' ? View : KeyboardProvider;
  const GestureWrapper = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureWrapper style={{ flex: 1 }}>
            <AppProviders style={{ flex: 1 }}>
              {isVersionCheckComplete && hardUpdateStatus.required ? (
                <HardUpdateScreen
                  message={hardUpdateStatus.message}
                  storeUrl={hardUpdateStatus.storeUrl}
                />
              ) : (
                <AuthProvider>
                  <SearchHistoryProvider>
                    <UserInterestsProvider>
                      <ListingsProvider>
                        <MessagesProvider>
                          <NotificationsProvider>
                            <AppTelemetry />
                            <NotificationCenter />
                            <RootLayoutNav />
                          </NotificationsProvider>
                        </MessagesProvider>
                      </ListingsProvider>
                    </UserInterestsProvider>
                  </SearchHistoryProvider>
                </AuthProvider>
              )}
            </AppProviders>
          </GestureWrapper>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
