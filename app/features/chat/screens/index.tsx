import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useMessages, ChatThread } from '@/shared/contexts/messages-context';
import { getTimeAgo } from '@/lib/utils';

function ChatThreadItem({ thread }: { thread: ChatThread }) {
  const handlePress = () => {
    router.push({
      pathname: '/chat/[listingId]',
      params: {
        listingId: thread.listingId,
        sellerName: thread.sellerName,
        listingTitle: thread.listingTitle,
        listingImage: thread.listingImage,
      },
    });
  };

  const timeAgo = getTimeAgo(thread.lastTimestamp);
  const preview =
    thread.lastMessage.substring(0, 60) + (thread.lastMessage.length > 60 ? '...' : '');

  return (
    <Pressable
      style={({ pressed }) => [styles.threadItem, pressed && styles.threadItemPressed]}
      onPress={handlePress}
    >
      <View style={styles.threadContent}>
        {/* Listing Image */}
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

        {/* Chat Info */}
        <View style={styles.chatInfo}>
          <View style={styles.headerRow}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {thread.sellerName}
            </Text>
            <Text style={styles.timestamp}>{timeAgo}</Text>
          </View>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {thread.listingTitle}
          </Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </View>

      <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
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
        <Text style={styles.headerTitle}>Inbox</Text>
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
          keyExtractor={(item) => item.listingId}
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
    paddingVertical: 12,
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
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  threadItemPressed: {
    backgroundColor: Colors.border,
  },
  threadContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  listingImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  noImage: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sellerName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginLeft: 8,
  },
  listingTitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
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
