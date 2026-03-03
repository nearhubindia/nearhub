import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useColorScheme,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNotifications } from '@/shared/contexts/notifications-context';
import Colors from '@/constants/colors';

export function NotificationCenter() {
  const { notifications, removeNotification } = useNotifications();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (notifications.length === 0) {
    return null;
  }

  const getIconName = (type: string) => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'alert-triangle';
      case 'info':
      default:
        return 'info';
    }
  };

  const getAccentColor = (type: string) => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
      default:
        return '#3b82f6';
    }
  };

  return (
    <View style={[styles.container, Platform.OS !== 'web' && { top: 0 }]}>
      {notifications.map((notification) => (
        <Animated.View
          key={notification.id}
          style={[
            styles.notificationCard,
            {
              backgroundColor: isDark ? '#1f2937' : '#fff',
              borderLeftColor: getAccentColor(notification.type),
            },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Feather
                name={getIconName(notification.type)}
                size={20}
                color={getAccentColor(notification.type)}
              />
              <Text style={[styles.title, { color: isDark ? '#f3f4f6' : '#1f2937' }]}>
                {notification.title}
              </Text>
            </View>
            <Text style={[styles.message, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {notification.message}
            </Text>
            {notification.action && (
              <TouchableOpacity
                style={{
                  marginTop: 8,
                  alignSelf: 'flex-start',
                }}
                onPress={() => {
                  notification.action?.onPress();
                  removeNotification(notification.id);
                }}
              >
                <Text
                  style={{
                    color: getAccentColor(notification.type),
                    fontWeight: '600',
                  }}
                >
                  {notification.action.label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => removeNotification(notification.id)}
          >
            <Feather name="x" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 999,
  },
  notificationCard: {
    flexDirection: 'row',
    borderRadius: 8,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});
