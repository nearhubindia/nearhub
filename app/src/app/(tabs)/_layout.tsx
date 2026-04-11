import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import React from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { TAB_BAR_BASE_HEIGHT, TAB_BAR_MIN_BOTTOM_PADDING } from '@/constants/layout';
import { responsiveFont, responsiveModerateScale } from '@/lib/responsive';
import ProfileMenuModal from '@/shared/components/ProfileMenuModal';
import { useMessages } from '@/shared/contexts/messages-context';

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const baseTabHeight = responsiveModerateScale(TAB_BAR_BASE_HEIGHT);
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const tabBarHeight = baseTabHeight + bottomInset;
  const tabBarPaddingBottom =
    Platform.OS === 'web'
      ? 0
      : Math.max(bottomInset, responsiveModerateScale(TAB_BAR_MIN_BOTTOM_PADDING));
  const { unreadChatsCount } = useMessages();
  const unreadChatsLabel = unreadChatsCount > 99 ? '99+' : String(unreadChatsCount);

  return (
    <>
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
              android: '#fff',
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
            title: 'Home',
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
          name="profile-menu"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <View style={styles.profileIconWrap}>
                <Feather size={responsiveModerateScale(21)} name="user" color={color} />
                {unreadChatsCount > 0 ? (
                  <View style={styles.profileUnreadBadge}>
                    <Text style={styles.profileUnreadBadgeText}>{unreadChatsLabel}</Text>
                  </View>
                ) : null}
              </View>
            ),
            tabBarButton: (props) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile menu"
                style={props.style}
                onLongPress={props.onLongPress}
                onPress={() => setShowProfileMenu(true)}
              >
                {props.children}
              </Pressable>
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
          name="messages"
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

      <ProfileMenuModal visible={showProfileMenu} onClose={() => setShowProfileMenu(false)} />
    </>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  profileIconWrap: {
    width: responsiveModerateScale(28),
    height: responsiveModerateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileUnreadBadge: {
    position: 'absolute',
    top: -7,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileUnreadBadgeText: {
    fontSize: responsiveFont(9),
    lineHeight: responsiveModerateScale(11),
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
