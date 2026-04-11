import '@/lib/button-style-normalizer';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import React, { useEffect, useCallback } from 'react';
import { LogBox, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
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
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/shared/contexts/auth-context';
import { ListingsProvider } from '@/shared/contexts/listings-context';
import { MessagesProvider } from '@/shared/contexts/messages-context';
import { SearchHistoryProvider } from '@/shared/contexts/search-history-context';
import { UserInterestsProvider } from '@/shared/contexts/user-interests-context';
import { NotificationsProvider } from '@/shared/contexts/notifications-context';
import { NotificationCenter } from '@/shared/components/NotificationCenter';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();
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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const hasHiddenSplash = React.useRef(false);

  const hideSplashOnce = useCallback(async () => {
    if (hasHiddenSplash.current) return;
    hasHiddenSplash.current = true;
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    async function prepare() {
      if (fontsLoaded) {
        if (Platform.OS === 'android') {
          try {
            // Edge-to-edge mode does not support setBackgroundColorAsync.
            await NavigationBar.setButtonStyleAsync('dark');
          } catch (error) {
            console.warn('[SystemUI] Failed to apply Android navigation bar style:', error);
          }
        }

        // Show the native splash for ~2 seconds then hide
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await hideSplashOnce();
      }
    }
    prepare();
  }, [fontsLoaded, hideSplashOnce]);

  const onLayoutRootView = useCallback(async () => {
    // Intentionally no-op: splash hide is handled in a single controlled path above.
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  const AppProviders = View; // Platform.OS === 'web' ? View : KeyboardProvider;
  const GestureWrapper = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureWrapper style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <AppProviders style={{ flex: 1 }}>
              <AuthProvider>
                <SearchHistoryProvider>
                  <UserInterestsProvider>
                    <ListingsProvider>
                      <MessagesProvider>
                        <NotificationsProvider>
                          <NotificationCenter />
                          <RootLayoutNav />
                        </NotificationsProvider>
                      </MessagesProvider>
                    </ListingsProvider>
                  </UserInterestsProvider>
                </SearchHistoryProvider>
              </AuthProvider>
            </AppProviders>
          </GestureWrapper>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
