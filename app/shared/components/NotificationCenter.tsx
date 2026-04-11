import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  useColorScheme,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications, type Notification } from '@/shared/contexts/notifications-context';
import { openNotificationTarget } from '@/lib/notification-navigation';
import { responsiveFont, responsiveModerateScale } from '@/lib/responsive';

export function NotificationCenter() {
  const { popupNotification, clearPopupNotification } = useNotifications();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getIconName = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'alert-triangle';
      case 'message':
        return 'message-circle';
      case 'info':
      default:
        return 'info';
    }
  };

  const getAccentColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'message':
        return '#14b8a6';
      case 'info':
      default:
        return '#3b82f6';
    }
  };

  useEffect(() => {
    if (!popupNotification) {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      return;
    }

    opacity.setValue(0);
    translateY.setValue(-12);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 120,
      }),
    ]).start();

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    const timeout = popupNotification.duration ?? 6000;
    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null;
      clearPopupNotification();
    }, timeout);

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [clearPopupNotification, opacity, popupNotification, translateY]);

  if (!popupNotification) {
    return null;
  }

  const accentColor = getAccentColor(popupNotification.type);

  const handlePress = () => {
    clearPopupNotification();
    void openNotificationTarget(popupNotification.data);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          top: insets.top + 8,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.banner,
          {
            backgroundColor: isDark ? '#111827' : '#fff',
            borderColor: isDark ? '#334155' : '#e5e7eb',
            borderLeftColor: accentColor,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${popupNotification.title}`}
        >
          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: `${accentColor}20` }]}>
              <Feather
                name={getIconName(popupNotification.type)}
                size={responsiveModerateScale(16)}
                color={accentColor}
              />
            </View>
            <View style={styles.textBlock}>
              <Text
                style={[styles.title, { color: isDark ? '#f3f4f6' : '#1f2937' }]}
                numberOfLines={1}
              >
                {popupNotification.title}
              </Text>
              <Text
                style={[styles.message, { color: isDark ? '#d1d5db' : '#6b7280' }]}
                numberOfLines={2}
              >
                {popupNotification.message}
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={responsiveModerateScale(18)}
              color={isDark ? '#9ca3af' : '#94a3b8'}
              style={styles.chevron}
            />
          </View>
        </Pressable>
        <Pressable
          onPress={clearPopupNotification}
          hitSlop={8}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Feather name="x" size={responsiveModerateScale(16)} color={isDark ? '#9ca3af' : '#6b7280'} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
  },
  banner: {
    position: 'relative',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
    overflow: 'hidden',
  },
  pressable: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingRight: 44,
  },
  pressablePressed: {
    opacity: Platform.OS === 'ios' ? 0.82 : 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: responsiveModerateScale(34),
    height: responsiveModerateScale(34),
    borderRadius: responsiveModerateScale(17),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: responsiveFont(14),
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: responsiveFont(12),
    lineHeight: responsiveModerateScale(17),
  },
  chevron: {
    marginTop: 6,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
  },
});
