import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotifications } from '@/shared/contexts/notifications-context';
import Colors from '@/constants/colors';
import { responsiveFont, responsiveModerateScale } from '@/lib/responsive';

interface NotificationBellProps {
  tone?: 'light' | 'dark';
}

export function NotificationBell({ tone = 'light' }: NotificationBellProps) {
  const router = useRouter();
  const { notifications } = useNotifications();
  const isDarkTone = tone === 'dark';

  return (
    <TouchableOpacity
      style={[styles.bellButton, isDarkTone && styles.bellButtonDark]}
      onPress={() => router.push('/notifications')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Open notifications"
    >
      <Feather
        name="bell"
        size={responsiveModerateScale(20)}
        color={isDarkTone ? '#E2E8F0' : Colors.light.tint}
      />
      {notifications.length > 0 && (
        <View style={[styles.badge, isDarkTone && styles.badgeDark]}>
          <Text style={styles.badgeText}>{notifications.length > 99 ? '99+' : notifications.length}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    position: 'relative',
    padding: responsiveModerateScale(6),
  },
  bellButtonDark: {
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: responsiveModerateScale(18),
    height: responsiveModerateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeDark: {
    borderColor: '#0F172A',
  },
  badgeText: {
    color: '#fff',
    fontSize: responsiveFont(10),
    fontWeight: '700',
  },
});
