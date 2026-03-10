import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import React from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { responsiveFont, responsiveModerateScale } from '@/lib/responsive';

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const baseTabHeight = Platform.OS === 'web' ? responsiveModerateScale(74) : responsiveModerateScale(62);
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const tabBarHeight = baseTabHeight + bottomInset;
  const tabBarPaddingBottom =
    Platform.OS === 'web' ? 0 : Math.max(bottomInset, responsiveModerateScale(8));

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: Platform.select({
            ios: 'transparent',
            android: isDark ? '#000' : '#fff',
            web: '#fff',
          }),
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingTop: Platform.OS === 'web' ? 4 : 6,
          paddingBottom: tabBarPaddingBottom,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: responsiveFont(11),
          marginBottom: Platform.OS === 'web' ? 6 : 0,
        },
        tabBarIconStyle: {
          marginBottom: Platform.OS === 'web' ? 2 : 0,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color }) => (
            <Feather size={responsiveModerateScale(21)} name="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: 'Shorts',
          tabBarIcon: ({ color }) => (
            <Feather size={responsiveModerateScale(21)} name="video" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Post',
          tabBarIcon: ({ color }) => (
            <Ionicons size={responsiveModerateScale(21)} name="add-circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => (
            <Feather size={responsiveModerateScale(21)} name="message-circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}
