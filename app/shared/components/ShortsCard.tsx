import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Feather, Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import PhotoSlideshow from './PhotoSlideshow';
import { getApiUrl } from '@/lib/query-client';
import { createResponsiveStyles, responsiveModerateScale } from '@/lib/responsive';

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
  offerPrice?: number;
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
  shouldRenderVideo?: boolean;
  onSave: () => void;
  onContact: () => void;
  onDetails: () => void;
  cardHeight: number;
  cardWidth: number;
  uiBottomInset?: number;
  uiTopInset?: number;
  onPlaybackMetric?: (
    event: 'first_frame' | 'source_fallback' | 'playback_error',
    details?: {
      sourceMode?: 'direct' | 'hls';
      error?: string;
    }
  ) => void;
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

function getAdaptiveStreamingUrl(videoUrl: string): string {
  const streamingUrl = getStreamingUrl(videoUrl);
  if (!/^https?:\/\//i.test(streamingUrl)) return streamingUrl;
  const apiBaseUrl = getApiUrl();
  return `${apiBaseUrl}/api/videos/hls/master.m3u8?source=${encodeURIComponent(streamingUrl)}`;
}

function getProxyStreamingUrl(videoUrl: string): string {
  const apiBaseUrl = getApiUrl();
  return `${apiBaseUrl}/api/videos/proxy?url=${encodeURIComponent(videoUrl)}`;
}

function VideoPlayer({
  videoUrl,
  isActive,
  onMuteToggle,
  isMuted,
  onPlaybackError,
  uiBottomInset,
  onPlaybackMetric,
}: {
  videoUrl: string;
  isActive: boolean;
  onMuteToggle: () => void;
  isMuted: boolean;
  onPlaybackError: () => void;
  uiBottomInset: number;
  onPlaybackMetric?: (
    event: 'first_frame' | 'source_fallback' | 'playback_error',
    details?: { sourceMode?: 'direct' | 'hls'; error?: string }
  ) => void;
}) {
  const hlsUrl = getAdaptiveStreamingUrl(videoUrl);
  const directUrl = getStreamingUrl(videoUrl);
  // Start with direct stream for faster first frame; fallback to HLS only if needed.
  const [sourceMode, setSourceMode] = React.useState<'hls' | 'direct'>('direct');
  const isLegacyAndroid = Platform.OS === 'android' && Number(Platform.Version) <= 30;
  const selectedUrl = sourceMode === 'hls' ? hlsUrl : directUrl;
  const shouldUseProxy = isLegacyAndroid && /^https?:\/\//i.test(selectedUrl);
  const playbackUrl = shouldUseProxy ? getProxyStreamingUrl(selectedUrl) : selectedUrl;
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [showControls, setShowControls] = React.useState(false);
  const [thumbnailUri, setThumbnailUri] = React.useState<string | null>(null);
  const [hasFirstFrameRendered, setHasFirstFrameRendered] = React.useState(false);
  const hasReportedFirstFrameRef = React.useRef(false);
  const hideControlsTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const player = useVideoPlayer(playbackUrl, (p) => {
    p.loop = true;
    p.muted = false;
    p.volume = 1.0;
    p.audioMixingMode = 'doNotMix';
  });

  React.useEffect(() => {
    setSourceMode('direct');
    hasReportedFirstFrameRef.current = false;
    setHasFirstFrameRendered(false);
    setThumbnailUri(null);
  }, [videoUrl]);

  React.useEffect(() => {
    let cancelled = false;
    const loadThumbnail = async () => {
      try {
        const result = await VideoThumbnails.getThumbnailAsync(getStreamingUrl(videoUrl), {
          time: 350,
        });
        if (!cancelled) {
          setThumbnailUri(result.uri);
        }
      } catch {
        if (!cancelled) {
          setThumbnailUri(null);
        }
      }
    };
    void loadThumbnail();
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  React.useEffect(() => {
    // Force mute when card is not active to avoid lingering audio on tab/screen switches.
    player.muted = !isActive || isMuted;
  }, [isActive, isMuted, player]);

  React.useEffect(() => {
    const sub = player.addListener('statusChange', (status: any) => {
      if (!hasReportedFirstFrameRef.current && status?.status === 'readyToPlay') {
        hasReportedFirstFrameRef.current = true;
        onPlaybackMetric?.('first_frame', { sourceMode });
      }
      if (status?.error) {
        console.warn('[Video] Playback status error:', status.error);
        if (sourceMode === 'direct') {
          // Retry with adaptive HLS when direct playback fails on specific devices/networks.
          onPlaybackMetric?.('source_fallback', {
            sourceMode: 'direct',
            error: String(status.error),
          });
          setSourceMode('hls');
          return;
        }
        onPlaybackMetric?.('playback_error', {
          sourceMode: 'hls',
          error: String(status.error),
        });
        onPlaybackError();
      }
    });
    return () => sub.remove();
  }, [player, onPlaybackError, onPlaybackMetric, sourceMode]);

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
        player.muted = true;
        setIsPlaying(false);
      } catch (err) {
        console.warn('[Video] Pause error:', err);
      }
    }
  }, [isActive, player]);

  React.useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // Best-effort pause during teardown
      }
    };
  }, [player]);

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
        {!hasFirstFrameRendered && thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
          />
        ) : null}
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit="cover"
          surfaceType="textureView"
          useExoShutter={false}
          onFirstFrameRender={() => setHasFirstFrameRendered(true)}
        />
      </Pressable>
      <Pressable
        style={[styles.muteButton, { bottom: uiBottomInset + responsiveModerateScale(88) }]}
        onPress={handleMuteClick}
      >
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
  offerPrice,
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
  shouldRenderVideo = true,
  onSave,
  onContact,
  onDetails,
  cardHeight,
  cardWidth,
  uiBottomInset = 0,
  uiTopInset = 0,
  onPlaybackMetric,
}: ShortsCardProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const hasUnreachablePlaceholder = image.includes('via.placeholder.com');
  const imageSource = hasUnreachablePlaceholder
    ? require('../../assets/images/icon.png')
    : { uri: image };

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Get first video if available
  const videoUrl = videos && videos.length > 0 ? videos[0] : undefined;
  const firstImage = images && images.length > 0 ? images[0] : image;
  const shouldShowPosterOnly = Boolean(videoUrl) && !shouldRenderVideo;

  React.useEffect(() => {
    setHasPlaybackError(false);
  }, [videoUrl]);

  React.useEffect(() => {
    if (isActive) {
      setIsMuted(false);
    }
  }, [isActive]);

  const handlePlaybackError = useCallback(() => {
    setHasPlaybackError(true);
  }, []);

  const hasValidOfferPrice =
    typeof offerPrice === 'number' && Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < price;
  const displayPrice = hasValidOfferPrice ? offerPrice : price;

  return (
    <View style={[styles.container, { width: cardWidth, height: cardHeight }]}>
      {/* Media fills entire card - full bleed like TikTok */}
      <View style={StyleSheet.absoluteFill}>
        {videoUrl && shouldRenderVideo && !hasPlaybackError ? (
          <VideoPlayer
            videoUrl={videoUrl}
            isActive={isActive}
            onMuteToggle={handleMuteToggle}
            isMuted={isMuted}
            onPlaybackError={handlePlaybackError}
            uiBottomInset={uiBottomInset}
            onPlaybackMetric={onPlaybackMetric}
          />
        ) : shouldShowPosterOnly ? (
          <Image
            source={
              firstImage.includes('via.placeholder.com')
                ? require('../../assets/images/icon.png')
                : { uri: firstImage }
            }
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
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
        <View style={[styles.videoBadge, { top: uiTopInset + responsiveModerateScale(16) }]}>
          <Feather name="film" size={12} color="#fff" />
        </View>
      )}

      {/* Side actions - absolute right */}
      <View style={[styles.sideActions, { bottom: uiBottomInset + responsiveModerateScale(44) }]}>
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
      </View>

      {/* Bottom overlay - auto sizes to content, no fixed height */}
      <Pressable style={styles.bottomOverlay} onPress={onDetails}>
        <View style={[styles.bottomContent, { paddingBottom: uiBottomInset }]}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {'\u20B9'}
              {displayPrice.toLocaleString('en-IN')}
            </Text>
            {hasValidOfferPrice && (
              <Text style={styles.originalPrice}>
                {'\u20B9'}
                {price.toLocaleString('en-IN')}
              </Text>
            )}
            <View style={styles.viewLink}>
              <Text style={styles.viewLinkText}>View</Text>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
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
            <Text style={styles.sellerName} numberOfLines={1} ellipsizeMode="tail">
              {sellerName}
            </Text>
            {sellerVerified && (
              <View style={styles.verifiedBadge}>
                <Feather name="check-circle" size={11} color="#fff" />
              </View>
            )}
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.location} numberOfLines={1} ellipsizeMode="tail">
              {location}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = createResponsiveStyles({
  container: {
    position: 'relative',
    backgroundColor: '#000',
  },
  videoBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
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
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  bottomContent: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingRight: 60,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  price: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  originalPrice: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.75)',
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  viewLink: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 28,
  },
  viewLinkText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 18,
    marginBottom: 6,
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
    flexShrink: 1,
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
    flexShrink: 1,
  },
  muteButton: {
    position: 'absolute',
    left: 14,
    zIndex: 10,
  },
  muteButtonInner: {
    backgroundColor: 'rgba(0,0,0,0.2)',
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
    backgroundColor: 'rgba(0,0,0,0.22)',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
