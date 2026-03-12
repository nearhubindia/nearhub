import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import PhotoSlideshow from './PhotoSlideshow';
import { getApiUrl } from '@/lib/query-client';

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

interface ShortsCardProps {
  title: string;
  price: number;
  image: string;
  images?: string[];
  videos?: string[];
  sellerName: string;
  sellerAvatar?: string;
  sellerVerified?: boolean;
  location: string;
  category: string;
  condition: string;
  isSaved: boolean;
  isActive?: boolean;
  onSave: () => void;
  onContact: () => void;
  onDetails: () => void;
  cardHeight: number;
  cardWidth: number;
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

function VideoPlayer({
  videoUrl,
  isActive,
  onMuteToggle,
  isMuted,
}: {
  videoUrl: string;
  isActive: boolean;
  onMuteToggle: () => void;
  isMuted: boolean;
}) {
  const streamingUrl = getStreamingUrl(videoUrl);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [showControls, setShowControls] = React.useState(false);
  const hideControlsTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const player = useVideoPlayer(streamingUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });

  React.useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  React.useEffect(() => {
    if (isActive) {
      try {
        player.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('[Video] Play error:', err);
      }
    } else {
      try {
        player.pause();
        setIsPlaying(false);
      } catch (err) {
        console.warn('[Video] Pause error:', err);
      }
    }
  }, [isActive, player]);

  const handleMuteClick = () => {
    onMuteToggle();
  };

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

  const handlePlayPauseToggle = () => {
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
      console.warn('[Video] Play/Pause toggle error:', err);
    }
  };

  React.useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleVideoPress}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit="cover"
        />
      </Pressable>
      <Pressable style={styles.muteButton} onPress={handleMuteClick}>
        <View style={styles.muteButtonInner}>
          <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
        </View>
      </Pressable>
      {showControls && (
        <Pressable style={styles.playPauseButton} onPress={handlePlayPauseToggle}>
          <View style={styles.playPauseButtonInner}>
            <Feather name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
          </View>
        </Pressable>
      )}
    </View>
  );
}

export default function ShortsCard({
  title,
  price,
  image,
  images,
  videos,
  sellerName,
  sellerAvatar,
  sellerVerified = false,
  location,
  category,
  condition,
  isSaved,
  isActive = false,
  onSave,
  onContact,
  onDetails,
  cardHeight,
  cardWidth,
}: ShortsCardProps) {
  const [isMuted, setIsMuted] = useState(true);
  const hasUnreachablePlaceholder = image.includes('via.placeholder.com');
  const imageSource = hasUnreachablePlaceholder
    ? require('../../assets/images/icon.png')
    : { uri: image };

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Get first video if available
  const videoUrl = videos && videos.length > 0 ? videos[0] : undefined;

  return (
    <View style={[styles.container, { width: cardWidth, height: cardHeight }]}>
      {/* Media fills entire card - full bleed like TikTok */}
      <View style={StyleSheet.absoluteFill}>
        {videoUrl && isActive ? (
          <VideoPlayer
            videoUrl={videoUrl}
            isActive={isActive}
            onMuteToggle={handleMuteToggle}
            isMuted={isMuted}
          />
        ) : images && images.length > 0 ? (
          <PhotoSlideshow
            images={images}
            isActive={isActive}
            interval={3000}
            cardHeight={cardHeight}
            cardWidth={cardWidth}
          />
        ) : (
          <Image
            source={imageSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
        )}
      </View>

      {videoUrl && (
        <View style={styles.videoBadge}>
          <Feather name="film" size={12} color="#fff" />
        </View>
      )}

      {/* Side actions - absolute right */}
      <View style={styles.sideActions}>
        <Pressable style={styles.actionButton} onPress={onSave}>
          <Ionicons
            name={isSaved ? 'heart' : 'heart-outline'}
            size={28}
            color={isSaved ? Colors.accent : '#fff'}
          />
          <Text style={styles.actionLabel}>Save</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onContact}>
          <Feather name="message-circle" size={26} color="#fff" />
          <Text style={styles.actionLabel}>Contact</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onDetails}>
          <Feather name="maximize-2" size={24} color="#fff" />
          <Text style={styles.actionLabel}>Details</Text>
        </Pressable>
      </View>

      {/* Bottom overlay - auto sizes to content, no fixed height */}
      <Pressable style={styles.bottomOverlay} onPress={onDetails}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.3, 1]}
          style={styles.bottomGradient}
        >
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {'\u20B9'}
              {price.toLocaleString('en-IN')}
            </Text>
            <View style={styles.viewLink}>
              <Text style={styles.viewLinkText}>View</Text>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.sellerRow}>
            <View style={styles.avatar}>
              {sellerAvatar ? (
                <Image
                  source={{ uri: sellerAvatar }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{sellerName.charAt(0)}</Text>
              )}
            </View>
            <Text style={styles.sellerName}>{sellerName}</Text>
            {sellerVerified && (
              <View style={styles.verifiedBadge}>
                <Feather name="check-circle" size={11} color="#fff" />
              </View>
            )}
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.location}>{location}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
  },
  videoBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    bottom: 140,
    alignItems: 'center',
    gap: 18,
    zIndex: 5,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  bottomGradient: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 14,
    paddingRight: 60,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  price: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 28,
  },
  viewLinkText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 20,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  sellerName: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginRight: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  location: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  muteButton: {
    position: 'absolute',
    bottom: 180,
    left: 14,
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
    top: '50%',
    left: '50%',
    transform: [{ translateX: -28 }, { translateY: -28 }],
    zIndex: 10,
  },
  playPauseButtonInner: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
