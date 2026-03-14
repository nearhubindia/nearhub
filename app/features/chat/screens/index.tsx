import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useMessages, ChatThread } from '@/shared/contexts/messages-context';
import { getTimeAgo } from '@/lib/utils';

function ChatThreadItem({ thread }: { thread: ChatThread }) {
  const handleOpenProfile = () => {
    const otherUserId = String(thread.otherUserId || '').trim();
    if (!otherUserId) return;
    router.push({
      pathname: '/user/[userId]',
      params: {
        userId: otherUserId,
        userName: thread.sellerName,
      },
    });
  };

  const handlePress = () => {
    router.push({
      pathname: '/chat/[listingId]',
      params: {
        listingId: thread.listingId,
        conversationId: thread.conversationId,
        otherUserId: thread.otherUserId || '',
        sellerName: thread.sellerName,
        listingTitle: thread.listingTitle,
        listingImage: thread.listingImage,
      },
    });
  };

  const timeAgo = getTimeAgo(thread.lastTimestamp);
  const preview =
    thread.lastMessage && thread.lastMessage.trim().length > 0
      ? thread.lastMessage.substring(0, 60) + (thread.lastMessage.length > 60 ? '...' : '')
      : 'No messages yet';
  const initial = (thread.sellerName || 'U').trim().charAt(0).toUpperCase();
  const unreadCount = Math.max(0, Number(thread.unreadCount || 0));
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.threadItem,
        hasUnread && styles.threadItemUnread,
        pressed && styles.threadItemPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.threadContent}>
        <Pressable
          style={styles.personPress}
          onPress={(event) => {
            event.stopPropagation?.();
            handleOpenProfile();
          }}
        >
          <View style={styles.mediaWrap}>
            {thread.listingImage ? (
              <Image
                source={{ uri: thread.listingImage }}
                style={styles.listingImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.listingImage, styles.noImage]}>
                <Feather name="image" size={20} color={Colors.textTertiary} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>{initial}</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.chatInfo}>
          <View style={styles.headerRow}>
            <View style={styles.namePress}>
              <Text style={styles.productName} numberOfLines={1}>
                {thread.listingTitle || 'Product'}
              </Text>
            </View>
            <View style={styles.trailingMeta}>
              <Text style={styles.timestamp}>{timeAgo}</Text>
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text
            style={[styles.sellerName, unreadCount > 0 && styles.sellerNameUnread]}
            numberOfLines={1}
            onPress={handleOpenProfile}
          >
            {thread.sellerName || 'User'}
          </Text>
          <Text
            style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="message-circle" size={48} color={Colors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No Messages Yet</Text>
      <Text style={styles.emptyDescription}>
        Start a conversation by reaching out to a seller about a listing
      </Text>
    </View>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { threads, isLoading } = useMessages();
  const webTopInset = Platform.OS === 'web' ? 56 : 0;

  // Sort threads by latest message timestamp
  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const timeA = new Date(a.lastTimestamp).getTime();
        const timeB = new Date(b.lastTimestamp).getTime();
        return timeB - timeA;
      }),
    [threads]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top || webTopInset }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inbox</Text>
          <Text style={styles.headerSubtitle}>{sortedThreads.length} conversations</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : sortedThreads.length > 0 ? (
        <FlatList
          data={sortedThreads}
          renderItem={({ item }) => <ChatThreadItem thread={item} />}
          keyExtractor={(item) => item.conversationId}
          scrollEnabled={true}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 11,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  threadItemUnread: {
    borderColor: '#BFDCF8',
    backgroundColor: '#F8FCFF',
  },
  threadItemPressed: {
    opacity: 0.9,
  },
  threadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  mediaWrap: {
    position: 'relative',
  },
  personPress: {
    borderRadius: 12,
  },
  namePress: {
    flex: 1,
  },
  listingImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  noImage: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  productName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    flex: 1,
  },
  sellerName: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  sellerNameUnread: {
    color: Colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  timestamp: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    marginLeft: 8,
  },
  trailingMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  lastMessage: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  lastMessageUnread: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
