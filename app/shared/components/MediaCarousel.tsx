import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Feather } from '@expo/vector-icons';
import { getAdaptiveStreamingUrl, getStreamingUrl } from '@/lib/video-streaming-url';

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
  onCurrentMediaTypeChange?: (type: 'image' | 'video') => void;
  onVideoEnlargePress?: () => void;
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
  onCurrentMediaTypeChange,
  onVideoEnlargePress,
}: MediaCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Combine images and videos into single media array
  const mediaItems: MediaItem[] = useMemo(
    () => [
      ...images.map((uri, i) => ({ type: 'image' as const, uri, id: `img-${i}` })),
      ...videos.map((uri, i) => ({ type: 'video' as const, uri, id: `vid-${i}` })),
    ],
    [images, videos]
  );

  const totalMedia = mediaItems.length;

  // Auto-play first video on load if available
  React.useEffect(() => {
    if (isFocused && mediaItems.length > 0 && mediaItems[0].type === 'video') {
      setActiveVideoId(mediaItems[0].id);
    } else {
      setActiveVideoId(null);
    }
    if (mediaItems.length > 0) {
      onCurrentMediaTypeChange?.(mediaItems[0].type);
    }
  }, [isFocused, mediaItems]);

  // Warm up first 2 video streams to reduce startup latency when user swipes.
  React.useEffect(() => {
    const warmupTargets = mediaItems.filter((item) => item.type === 'video').slice(0, 2);
    if (warmupTargets.length === 0) return;

    const controller = new AbortController();
    warmupTargets.forEach((item) => {
      const url = getStreamingUrl(item.uri);
      fetch(url, { method: 'HEAD', signal: controller.signal }).catch(() => {
        // Best-effort warmup only.
      });
    });

    return () => controller.abort();
  }, [mediaItems]);

  // Pause all videos when screen loses focus
  React.useEffect(() => {
    if (!isFocused) {
      setActiveVideoId(null);
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

  const handleMomentumScrollEnd = useCallback(
    (e: any) => {
      const contentOffsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(contentOffsetX / windowWidth);
      setCurrentIndex(index);

      // Auto-play video when scrolled into view (only if screen is focused)
      const item = mediaItems[index];
      if (item) {
        onCurrentMediaTypeChange?.(item.type);
      }
      if (isFocused && item?.type === 'video') {
        setActiveVideoId(item.id);
      } else {
        setActiveVideoId(null);
      }
    },
    [isFocused, mediaItems, onCurrentMediaTypeChange, windowWidth]
  );

  const renderMediaItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      if (item.type === 'image') {
        return (
          <View style={[styles.mediaContainer, { height, width: windowWidth }]}>
            <Image
              source={{ uri: item.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={220}
              cachePolicy="memory-disk"
            />
          </View>
        );
      }

      // Video type
      return (
        <VideoPlayer
          videoUri={item.uri}
          itemId={item.id}
          isActive={activeVideoId === item.id}
          height={height}
          width={windowWidth}
          onVideoEnlargePress={onVideoEnlargePress}
        />
      );
    },
    [activeVideoId, height, onVideoEnlargePress, windowWidth]
  );

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        ref={flatListRef}
        data={mediaItems}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item.id}
        extraData={`${windowWidth}-${activeVideoId ?? ''}`}
        horizontal
        pagingEnabled
        snapToInterval={windowWidth}
        snapToAlignment="start"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={totalMedia > 1}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        updateCellsBatchingPeriod={32}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={(_, index) => ({
          length: windowWidth,
          offset: windowWidth * index,
          index,
        })}
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
  isActive,
  height,
  width,
  onVideoEnlargePress,
}: {
  videoUri: string;
  itemId: string;
  isActive: boolean;
  height: number;
  width: number;
  onVideoEnlargePress?: () => void;
}) {
  const streamingUrl = getAdaptiveStreamingUrl(videoUri);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [hasFirstFrameRendered, setHasFirstFrameRendered] = useState(false);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const player = useVideoPlayer(streamingUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });

  React.useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  React.useEffect(() => {
    let cancelled = false;
    const loadThumbnail = async () => {
      try {
        const result = await VideoThumbnails.getThumbnailAsync(getStreamingUrl(videoUri), {
          time: 350,
        });
        if (!cancelled) {
          setThumbnailUri(result.uri);
          setShowThumbnail(true);
          setHasFirstFrameRendered(false);
        }
      } catch {
        if (!cancelled) {
          setThumbnailUri(null);
          setHasFirstFrameRendered(false);
        }
      }
    };
    loadThumbnail();
    return () => {
      cancelled = true;
    };
  }, [videoUri]);

  React.useEffect(() => {
    if (isActive) {
      try {
        setVideoError(null);
        player.play();
        setIsPlaying(true);
      } catch (err) {
        setVideoError(`Error: ${String(err)}`);
      }
    } else {
      try {
        player.pause();
        setIsPlaying(false);
        setShowThumbnail(true);
        setHasFirstFrameRendered(false);
      } catch {
        // best-effort
      }
    }
  }, [isActive, player]);

  React.useEffect(() => {
    if (isActive && hasFirstFrameRendered) {
      setShowThumbnail(false);
    }
  }, [hasFirstFrameRendered, isActive]);

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
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
      showControlsTemporarily();
    } catch (err) {
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
    <View style={[styles.mediaContainer, { height, width }]}>
      {videoError ? (
        <View style={[styles.errorContainer, { height }]}>
          <Feather name="alert-circle" size={40} color="#ff6b6b" />
          <Text style={styles.errorText}>Video failed to load</Text>
          <Text style={styles.errorDetails}>{videoError.substring(0, 100)}</Text>
        </View>
      ) : (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleVideoPress}>
            {showThumbnail && thumbnailUri ? (
              <Image
                source={{ uri: thumbnailUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : null}
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              nativeControls={false}
              contentFit="cover"
              useExoShutter={false}
              onFirstFrameRender={() => setHasFirstFrameRendered(true)}
            />
          </Pressable>
          {onVideoEnlargePress ? (
            <Pressable style={styles.enlargeButton} onPress={onVideoEnlargePress}>
              <View style={styles.enlargeButtonInner}>
                <Feather name="maximize-2" size={22} color="#fff" />
              </View>
            </Pressable>
          ) : null}
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
    borderRadius: 5,
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
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  playPauseButton: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    top: '50%',
    left: '50%',
    marginLeft: -28,
    marginTop: -28,
  },
  enlargeButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -31,
    marginTop: -31,
    zIndex: 12,
  },
  enlargeButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  videoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 5,
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
