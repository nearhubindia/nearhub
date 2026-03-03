import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Path, Circle } from 'react-native-svg';
import BrandWordmark from '@/shared/components/BrandWordmark';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish: () => void;
}

function LocationPinIcon({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 120 150">
      <Defs>
        <SvgGradient id="pinGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#38BDF8" />
          <Stop offset="0.5" stopColor="#3B82F6" />
          <Stop offset="1" stopColor="#8B5CF6" />
        </SvgGradient>
        <SvgGradient id="wifiGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7DD3FC" />
          <Stop offset="1" stopColor="#38BDF8" />
        </SvgGradient>
      </Defs>

      {/* Wifi arc 1 (outermost) */}
      <Path
        d="M 32 32 A 38 38 0 0 1 88 32"
        fill="none"
        stroke="url(#wifiGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity={0.5}
      />
      {/* Wifi arc 2 */}
      <Path
        d="M 40 38 A 26 26 0 0 1 80 38"
        fill="none"
        stroke="url(#wifiGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* Wifi arc 3 (innermost) */}
      <Path
        d="M 48 44 A 15 15 0 0 1 72 44"
        fill="none"
        stroke="url(#wifiGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity={0.9}
      />

      {/* Pin body */}
      <Path
        d="M 60 52 C 38 52 22 68 22 88 C 22 108 60 140 60 140 C 60 140 98 108 98 88 C 98 68 82 52 60 52 Z"
        fill="url(#pinGrad)"
      />
      {/* Pin inner white circle */}
      <Circle cx="60" cy="86" r="18" fill="white" />
      {/* Pin inner dot */}
      <Circle cx="60" cy="86" r="9" fill="url(#pinGrad)" />

      {/* Ground shadow ellipse */}
      <Path
        d="M 40 146 Q 60 152 80 146"
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.3}
      />
    </Svg>
  );
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const [isVisible, setIsVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const iconTranslate = useRef(new Animated.Value(20)).current;
  const loadingAnim = useRef(new Animated.Value(0)).current;

  const handleFinish = useCallback(() => {
    // Fade out before hiding
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      onFinish();
    });
  }, [onFinish, fadeAnim, scaleAnim]);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(iconTranslate, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(loadingAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: false,
      }),
    ]).start();

    const timer = setTimeout(() => {
      handleFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [handleFinish, scaleAnim, iconTranslate, loadingAnim]);

  if (!isVisible) return null;

  const loadingWidth = loadingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <LinearGradient
        colors={['#060A12', '#0C1526', '#15102A']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Subtle radial glow behind icon */}
      <View style={styles.glowOuter} />
      <View style={styles.glowInner} />

      <View style={styles.centerContent}>
        <Animated.View
          style={[styles.iconContainer, { transform: [{ translateY: iconTranslate }] }]}
        >
          <LocationPinIcon size={112} />
        </Animated.View>

        <BrandWordmark size={44} showAiTag />
        <Text style={styles.tagline}>Premium local marketplace</Text>
        <View style={styles.promoBanner}>
          <Text style={styles.promoText}>Buy • Sell • Discover near you</Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingFill, { width: loadingWidth }]}> 
            <LinearGradient
              colors={['#7DD3FC', '#3B82F6', '#A78BFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loadingGradient}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0F1A',
    zIndex: 9999,
    elevation: 9999,
  },
  glowOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(59, 130, 246, 0.045)',
    top: '50%',
    left: '50%',
    marginTop: -200,
    marginLeft: -160,
  },
  glowInner: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
    top: '50%',
    left: '50%',
    marginTop: -145,
    marginLeft: -105,
  },
  centerContent: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 44,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(203, 213, 225, 0.78)',
    letterSpacing: 0.7,
  },
  promoBanner: {
    marginTop: 18,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    backgroundColor: 'rgba(15, 23, 42, 0.64)',
  },
  promoText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(226, 232, 240, 0.9)',
    letterSpacing: 0.5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
  },
  loadingTrack: {
    width: 90,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.2)',
    overflow: 'hidden',
  },
  loadingFill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  loadingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
});
