import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import React, { useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
// import { KeyboardProvider } from 'react-native-keyboard-controller';
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
        name="profile"
        options={{
          headerShown: false,
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
  useEffect(() => {
    async function prepare() {
      if (fontsLoaded) {
        // Show the native splash for ~2 seconds then hide
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, [fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its initial pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const AppProviders = View; // Platform.OS === 'web' ? View : KeyboardProvider;
  const GestureWrapper = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
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
                        <RootLayoutNav />
                        <NotificationCenter />
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
  );
}
