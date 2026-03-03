import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNotifications } from '@/shared/contexts/notifications-context';
import Colors from '@/constants/colors';

export function NotificationBell() {
  const { notifications, removeNotification, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getIconColor = (type: string) => {
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
    <>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Feather name="bell" size={24} color={Colors.light.tint} />
        {notifications.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {notifications.length > 99 ? '99+' : notifications.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setIsOpen(false)}
          activeOpacity={1}
        >
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#f3f4f6' : '#1f2937' }]}>
                Notifications
              </Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Feather name="x" size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
            </View>

            {notifications.length > 0 ? (
              <>
                <FlatList
                  data={notifications}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.notificationItem,
                        {
                          borderBottomColor: isDark ? '#374151' : '#e5e7eb',
                          backgroundColor: isDark ? '#111827' : '#f9fafb',
                        },
                      ]}
                    >
                      <View style={styles.itemContent}>
                        <View
                          style={[
                            styles.iconCircle,
                            { backgroundColor: getIconColor(item.type) + '20' },
                          ]}
                        >
                          <Feather
                            name={item.type === 'success' ? 'check' : 'info'}
                            size={16}
                            color={getIconColor(item.type)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.itemTitle, { color: isDark ? '#f3f4f6' : '#1f2937' }]}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={[styles.itemMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}
                            numberOfLines={2}
                          >
                            {item.message}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeNotification(item.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather
                            name="trash-2"
                            size={18}
                            color={isDark ? '#6b7280' : '#9ca3af'}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  scrollEnabled={notifications.length > 5}
                  style={{ maxHeight: 400 }}
                />
                {notifications.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { borderTopColor: isDark ? '#374151' : '#e5e7eb' }]}
                    onPress={() => {
                      clearAll();
                      setIsOpen(false);
                    }}
                  >
                    <Text
                      style={{
                        color: '#ef4444',
                        fontWeight: '600',
                        fontSize: 14,
                      }}
                    >
                      Clear All
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="bell-off" size={48} color={isDark ? '#4b5563' : '#d1d5db'} />
                <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  No notifications yet
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: Platform.OS === 'web' ? 'flex-start' : 'center',
  },
  modalContent: {
    ...(Platform.OS === 'web'
      ? {
          position: 'absolute',
          top: 60,
          right: 16,
          width: 380,
          borderRadius: 12,
        }
      : {
          marginHorizontal: 16,
          borderRadius: 12,
          maxHeight: '80%',
        }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  notificationItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyState: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
});
