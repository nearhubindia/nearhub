import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  FlatList,
  Pressable,
  Platform,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useNotifications, type Notification } from '@/shared/contexts/notifications-context';
import { openNotificationTarget } from '@/lib/notification-navigation';

type ScreenTheme = {
  background: string;
  headerBorder: string;
  text: string;
  mutedText: string;
  card: string;
  cardBorder: string;
  trash: string;
  clearText: string;
  emptyIcon: string;
};

function getIconColor(type: Notification['type']): string {
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
}

function getIconName(type: Notification['type']): keyof typeof Feather.glyphMap {
  switch (type) {
    case 'success':
      return 'check';
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
}

function NotificationItem({
  item,
  theme,
  onRemove,
  onMarkRead,
}: {
  item: Notification;
  theme: ScreenTheme;
  onRemove: (id: string) => void;
  onMarkRead: (notification: Notification) => void;
}) {
  const handleOpen = () => {
    if (item.data) {
      onMarkRead(item);
      void openNotificationTarget(item.data);
      return;
    }

    if (item.action) {
      onMarkRead(item);
      item.action.onPress();
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      onPress={handleOpen}
      accessibilityRole={item.data || item.action ? 'button' : undefined}
      accessibilityLabel={item.data || item.action ? `Open ${item.title}` : undefined}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
      ) : null}
      <View style={[styles.iconCircle, { backgroundColor: getIconColor(item.type) + '20' }]}>
        <Feather name={getIconName(item.type)} size={14} color={getIconColor(item.type)} />
      </View>

      <View style={styles.itemTextWrap}>
        <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.itemMessage, { color: theme.mutedText }]} numberOfLines={2}>
          {item.message}
        </Text>
      </View>

      <Pressable
        onPress={() => onRemove(item.id)}
        hitSlop={8}
        style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
      >
        <Feather name="trash-2" size={16} color={theme.trash} />
      </Pressable>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 56 : 0;
  const { notifications, removeNotification, clearAll, markNotificationRead } = useNotifications();

  const theme: ScreenTheme = isDark
    ? {
        background: '#0f172a',
        headerBorder: '#1f2937',
        text: '#f3f4f6',
        mutedText: '#9ca3af',
        card: '#111827',
        cardBorder: '#1f2937',
        trash: '#9ca3af',
        clearText: '#f87171',
        emptyIcon: '#4b5563',
      }
    : {
        background: Colors.background,
        headerBorder: Colors.border,
        text: Colors.text,
        mutedText: Colors.textSecondary,
        card: '#ffffff',
        cardBorder: '#e5e7eb',
        trash: '#9ca3af',
        clearText: '#ef4444',
        emptyIcon: '#d1d5db',
      };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top || webTopInset,
            borderBottomColor: theme.headerBorder,
            backgroundColor: theme.background,
          },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
            {notifications.length} total
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
          onPress={clearAll}
          disabled={notifications.length === 0}
        >
          <Text
            style={[
              styles.clearText,
              {
                color: notifications.length > 0 ? theme.clearText : theme.mutedText,
              },
            ]}
          >
            Clear
          </Text>
        </Pressable>
      </View>

      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              theme={theme}
              onRemove={removeNotification}
              onMarkRead={markNotificationRead}
            />
          )}
        />
      ) : (
        <View style={styles.emptyWrap}>
          <Feather name="bell-off" size={44} color={theme.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No notifications yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.mutedText }]}>
            New alerts will appear here.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  clearBtn: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnPressed: {
    opacity: 0.7,
  },
  clearText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 26,
    gap: 10,
  },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  itemMessage: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonPressed: {
    opacity: 0.7,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
