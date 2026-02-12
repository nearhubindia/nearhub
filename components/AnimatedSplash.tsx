import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const letterSpacing = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(20);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const ring2Scale = useSharedValue(0);
  const ring2Opacity = useSharedValue(0);
  const wholeOpacity = useSharedValue(1);
  const dotScale = useSharedValue(0);
  const shimmerX = useSharedValue(-width);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    ringScale.value = withDelay(0, withTiming(2.5, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    ringOpacity.value = withSequence(
      withTiming(0.4, { duration: 400 }),
      withDelay(600, withTiming(0, { duration: 400 }))
    );
    ring2Scale.value = withDelay(200, withTiming(3, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    ring2Opacity.value = withSequence(
      withDelay(200, withTiming(0.25, { duration: 400 })),
      withDelay(600, withTiming(0, { duration: 400 }))
    );

    logoScale.value = withDelay(150, withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 }));
    logoOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    letterSpacing.value = withDelay(200, withSpring(2, { damping: 14, stiffness: 80 }));

    dotScale.value = withDelay(600, withSpring(1, { damping: 8, stiffness: 200 }));

    glowOpacity.value = withSequence(
      withDelay(400, withTiming(0.6, { duration: 600 })),
      withTiming(0.2, { duration: 800 }),
      withTiming(0.5, { duration: 600 }),
      withTiming(0, { duration: 400 })
    );

    shimmerX.value = withDelay(500, withTiming(width, { duration: 1000, easing: Easing.inOut(Easing.ease) }));

    taglineOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
    taglineTranslateY.value = withDelay(700, withSpring(0, { damping: 14, stiffness: 90 }));

    const timer = setTimeout(() => {
      wholeOpacity.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(onFinish)();
        }
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
    letterSpacing: letterSpacing.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: wholeOpacity.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={['#0A0F1A', '#0D1B2A', '#0F2027']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <Animated.View style={[styles.glowCircle, glowStyle]} />

      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={[styles.ring2, ring2Style]} />

      <View style={styles.centerContent}>
        <Animated.View style={[styles.logoRow, logoStyle]}>
          <Text style={styles.logoText}>adli</Text>
          <Animated.View style={dotStyle}>
            <Text style={styles.logoX}>x</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.15)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>

        <Animated.Text style={[styles.tagline, taglineStyle]}>
          Your Local Marketplace
        </Animated.Text>
      </View>

      <Animated.View style={[styles.bottomDots, taglineStyle]}>
        <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
        <View style={[styles.dot, { backgroundColor: Colors.primaryLight }]} />
        <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  glowCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    elevation: 20,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  ring2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  centerContent: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontSize: 56,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  logoX: {
    fontSize: 56,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmerGradient: {
    width: 80,
    height: '100%',
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  bottomDots: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
