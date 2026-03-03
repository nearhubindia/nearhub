import React, { useState, useRef } from 'react';
import { View, FlatList, Dimensions, StyleSheet, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { getApiUrl } from '@/lib/query-client';

const { width } = Dimensions.get('window');

function remapLoopbackUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const isLoopbackHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0';

    if (!isLoopbackHost) {
      return url;
    }

    const apiBase = new URL(getApiUrl());
    parsed.protocol = apiBase.protocol;
    parsed.host = apiBase.host;
    return parsed.toString();
  } catch {
    return url;
  }
}

function getStreamingUrl(videoUrl: string): string {
  const apiBaseUrl = getApiUrl();

  // Use direct absolute URLs as-is (do not force protocol changes)
  if (videoUrl.startsWith('https://') || videoUrl.startsWith('http://')) {
    return remapLoopbackUrl(videoUrl);
  }

  // If backend returns a relative path, resolve via API stream endpoint
  if (videoUrl.startsWith('/videos/')) {
    const filename = videoUrl.replace(/^\/videos\//, '');
    return `${apiBaseUrl}/api/videos/stream/${filename}`;
  }

  return `${apiBaseUrl}/api/videos/stream/${videoUrl}`;
}

interface MediaItem {
  type: 'image' | 'video';
  uri: string;
  id: string;
}

interface MediaCarouselProps {
  images?: string[];
  videos?: string[];
  height: number;
  isFocused?: boolean;
}

/**
 * MediaCarousel Component
 * Displays images and videos in a single horizontal swipeable carousel
 * Combines images and videos with proper pagination
 */
export default function MediaCarousel({
  images = [],
  videos = [],
  height,
  isFocused = true,
}: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activePlayers, setActivePlayers] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  // Combine images and videos into single media array
  const mediaItems: MediaItem[] = [
    ...images.map((uri, i) => ({ type: 'image' as const, uri, id: `img-${i}` })),
    ...videos.map((uri, i) => ({ type: 'video' as const, uri, id: `vid-${i}` })),
  ];

  const totalMedia = mediaItems.length;

  // Auto-play first video on load if available
  React.useEffect(() => {
    console.log(
      '[MediaCarousel] mounted, mediaItems:',
      mediaItems.length,
      'first item:',
      mediaItems[0]?.type
    );
    if (isFocused && mediaItems.length > 0 && mediaItems[0].type === 'video') {
      console.log('[MediaCarousel] Auto-playing first video:', mediaItems[0].id);
      setActivePlayers(new Set([mediaItems[0].id]));
    } else {
      setActivePlayers(new Set());
    }
  }, [mediaItems.length, mediaItems[0]?.type, isFocused]);

  // Pause all videos when screen loses focus
  React.useEffect(() => {
    if (!isFocused) {
      console.log('[MediaCarousel] Screen not focused, pausing all videos');
      setActivePlayers(new Set());
    }
  }, [isFocused]);

  if (totalMedia === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.placeholder}>
          <Feather name="image" size={40} color="#999" />
        </View>
      </View>
    );
  }

  const handleMomentumScrollEnd = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);

    // Auto-play video when scrolled into view (only if screen is focused)
    const item = mediaItems[index];
    console.log('[MediaCarousel] Scrolled to index:', { index, type: item?.type, id: item?.id });
    if (isFocused && item?.type === 'video') {
      const newActivePlayers = new Set([item.id]);
      console.log('[MediaCarousel] Setting active video:', item.id);
      setActivePlayers(newActivePlayers);
    } else {
      setActivePlayers(new Set());
    }
  };

  const renderMediaItem = ({ item }: { item: MediaItem }) => {
    if (item.type === 'image') {
      return (
        <View style={[styles.mediaContainer, { height }]}>
          <Image
            source={{ uri: item.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
        </View>
      );
    }

    // Video type
    return (
      <VideoPlayer
        videoUri={item.uri}
        itemId={item.id}
        height={height}
        activePlayers={activePlayers}
        setActivePlayers={setActivePlayers}
      />
    );
  };

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        ref={flatListRef}
        data={mediaItems}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={totalMedia > 1}
      />

      {/* Media counter badge */}
      {totalMedia > 1 && (
        <View style={styles.counter}>
          <Feather
            name={mediaItems[currentIndex].type === 'video' ? 'play' : 'image'}
            size={12}
            color="#fff"
          />
          <Text style={styles.counterText}>
            {currentIndex + 1}/{totalMedia}
          </Text>
        </View>
      )}
    </View>
  );
}

function VideoPlayer({
  videoUri,
  itemId,
  height,
  activePlayers,
  setActivePlayers,
}: {
  videoUri: string;
  itemId: string;
  height: number;
  activePlayers: Set<string>;
  setActivePlayers: (players: Set<string>) => void;
}) {
  const streamingUrl = getStreamingUrl(videoUri);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  console.log(
    `[VideoPlayer] Creating player - ID: ${itemId}, URI: ${videoUri}, Streaming: ${streamingUrl}`
  );

  const player = useVideoPlayer(streamingUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });

  React.useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  React.useEffect(() => {
    const isActive = activePlayers.has(itemId);
    console.log(
      `[VideoPlayer] Mounted - ID: ${itemId}, Active: ${isActive}, URI Valid: ${!!videoUri}`
    );

    // Add status observation
    const subscription = player.addListener('statusChange', (status: any) => {
      const statusStr = `isPlaying=${status?.isPlaying}, duration=${status?.durationMillis}, position=${status?.positionMillis}, state=${status?.state}`;
      console.log(`[VideoPlayer] Status - ID: ${itemId}, ${statusStr}`);
    });

    return () => {
      subscription.remove();
    };
  }, [videoUri, itemId, player, activePlayers]);

  React.useEffect(() => {
    const isActive = activePlayers.has(itemId);
    console.log(`[VideoPlayer] Play state change - ID: ${itemId}, Active: ${isActive}`);

    if (isActive) {
      try {
        console.log(`[VideoPlayer] Attempting to play: ${itemId}`);
        setVideoError(null);
        player.play();
        setIsPlaying(true);
        console.log(`[VideoPlayer] Play command sent: ${itemId}`);
      } catch (err) {
        console.error(`[VideoPlayer] Play error for ${itemId}:`, String(err));
        setVideoError(`Error: ${String(err)}`);
      }
    } else {
      try {
        player.pause();
        setIsPlaying(false);
        console.log(`[VideoPlayer] Paused: ${itemId}`);
      } catch (err) {
        console.warn(`[VideoPlayer] Pause error for ${itemId}:`, String(err));
      }
    }
  }, [activePlayers, itemId, player]);

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  };

  const handleVideoPress = () => {
    showControlsTemporarily();
  };

  const togglePlayPause = () => {
    try {
      console.log(`[VideoPlayer] Toggle - ID: ${itemId}, Currently Playing: ${isPlaying}`);
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        console.log(`[VideoPlayer] User paused: ${itemId}`);
      } else {
        player.play();
        setIsPlaying(true);
        console.log(`[VideoPlayer] User play sent: ${itemId}`);
      }
      showControlsTemporarily();
    } catch (err) {
      console.error(`[VideoPlayer] Toggle error for ${itemId}:`, String(err));
      setVideoError(`Toggle failed: ${String(err)}`);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    showControlsTemporarily();
  };

  React.useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  return (
    <View style={[styles.mediaContainer, { height }]}>
      {videoError ? (
        <View style={[styles.errorContainer, { height }]}>
          <Feather name="alert-circle" size={40} color="#ff6b6b" />
          <Text style={styles.errorText}>Video failed to load</Text>
          <Text style={styles.errorDetails}>{videoError.substring(0, 100)}</Text>
        </View>
      ) : (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleVideoPress}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              nativeControls={false}
              contentFit="cover"
            />
          </Pressable>
          {/* Mute/Unmute button */}
          <Pressable style={styles.muteButton} onPress={toggleMute}>
            <View style={styles.muteButtonInner}>
              <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
            </View>
          </Pressable>
          {/* Play/Pause button - auto-hides */}
          {showControls && (
            <Pressable style={styles.playPauseButton} onPress={togglePlayPause}>
              <Feather name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
            </Pressable>
          )}
          {/* Video indicator badge */}
          <View style={styles.videoBadge}>
            <Feather name="play" size={16} color="#fff" />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    position: 'relative',
  },
  mediaContainer: {
    width,
    backgroundColor: '#000',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  counterText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  muteButton: {
    position: 'absolute',
    bottom: 64,
    left: 12,
    zIndex: 10,
  },
  muteButtonInner: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  playPauseButton: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    top: '50%',
    left: '50%',
    marginLeft: -28,
    marginTop: -28,
  },
  videoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    gap: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  errorDetails: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 20,
    textAlign: 'center',
  },
});
