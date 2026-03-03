import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useMessages, ChatMessage } from '@/shared/contexts/messages-context';
import { getTimeAgo } from '@/lib/utils';

function MessageBubble({ message }: { message: ChatMessage }) {
  const isMe = message.sender === 'me';
  const time = new Date(message.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowSeller]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleSeller]}>
        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextSeller]}>
          {message.text}
        </Text>
        <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeSeller]}>
          {timeStr}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { listingId, sellerName, listingTitle, listingImage } = useLocalSearchParams<{
    listingId: string;
    sellerName: string;
    listingTitle: string;
    listingImage: string;
  }>();
  const insets = useSafeAreaInsets();
  const { getListingById } = useListings();
  const { getThread, sendMessage } = useMessages();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const listing = getListingById(listingId);
  const thread = getThread(listingId);
  const messages = thread?.messages || [];

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');

    await sendMessage(
      listingId,
      text,
      sellerName || listing?.sellerName || 'Seller',
      listingTitle || listing?.title || 'Item',
      listingImage || listing?.images[0] || ''
    );
  }, [inputText, listingId, sellerName, listingTitle, listingImage]);

  const reversedMessages = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 4 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          {listingImage || listing?.images[0] ? (
            <Image
              source={{ uri: listingImage || listing?.images[0] }}
              style={styles.headerThumb}
              contentFit="cover"
            />
          ) : null}
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {sellerName || listing?.sellerName || 'Seller'}
            </Text>
            <Text style={styles.headerListing} numberOfLines={1}>
              {listingTitle || listing?.title || 'Item'}
            </Text>
          </View>
        </View>
        {listing && (
          <View style={styles.headerPrice}>
            <Text style={styles.priceText}>₹{listing.price.toLocaleString('en-IN')}</Text>
          </View>
        )}
      </View>

      {messages.length === 0 && (
        <View style={styles.emptyChat}>
          {listingImage || listing?.images[0] ? (
            <Image
              source={{ uri: listingImage || listing?.images[0] }}
              style={styles.emptyImage}
              contentFit="cover"
            />
          ) : null}
          <Text style={styles.emptyTitle}>{listingTitle || listing?.title}</Text>
          {listing && (
            <Text style={styles.emptyPrice}>₹{listing.price.toLocaleString('en-IN')}</Text>
          )}
          <Text style={styles.emptyHint}>Send a message to the seller to get started</Text>

          <View style={styles.quickMessages}>
            {['Is this still available?', "What's your best price?", 'Can I see more photos?'].map(
              (msg) => (
                <Pressable
                  key={msg}
                  style={styles.quickBtn}
                  onPress={() => {
                    setInputText(msg);
                  }}
                >
                  <Text style={styles.quickText}>{msg}</Text>
                </Pressable>
              )
            )}
          </View>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        renderItem={({ item }) => <MessageBubble message={item} />}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={[styles.messagesList, { paddingBottom: 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />

      <View
        style={[
          styles.inputBar,
          { paddingBottom: (insets.bottom || (Platform.OS === 'web' ? 34 : 0)) + 6 },
        ]}
      >
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Feather
              name="send"
              size={18}
              color={inputText.trim() ? '#fff' : Colors.textTertiary}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  headerListing: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  headerPrice: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  priceText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  emptyChat: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 30,
    gap: 6,
  },
  emptyImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    textAlign: 'center',
  },
  emptyPrice: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginTop: 4,
  },
  quickMessages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  quickBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  bubbleRow: {
    marginVertical: 3,
    maxWidth: '80%',
  },
  bubbleRowMe: {
    alignSelf: 'flex-end',
  },
  bubbleRowSeller: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleSeller: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#fff',
  },
  bubbleTextSeller: {
    color: Colors.text,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeMe: {
    color: 'rgba(255,255,255,0.6)',
  },
  bubbleTimeSeller: {
    color: Colors.textTertiary,
  },
  inputBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.borderLight,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'transparent',
  },
});
