import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import React from "react";
import { Feather } from "@expo/vector-icons";

import Colors from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Browse</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create">
        <Icon sf={{ default: "plus.circle", selected: "plus.circle.fill" }} />
        <Label>Sell</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <Label>Saved</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shorts">
        <Icon sf={{ default: "play.rectangle", selected: "play.rectangle.fill" }} />
        <Label>Shorts</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: isDark ? "#000" : "#fff",
            web: "#fff",
          }),
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === "web" ? 84 : undefined,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => (
            <Feather name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Sell",
          tabBarIcon: ({ color, size }) => (
            <Feather name="plus-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, size }) => (
            <Feather name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: "Shorts",
          tabBarIcon: ({ color, size }) => (
            <Feather name="play" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
