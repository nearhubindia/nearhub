import React from 'react';
import { View, StyleSheet, ViewStyle, Image } from 'react-native';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showTagline?: boolean;
  style?: ViewStyle;
}

export function Logo({ size = 'md', showText = true, showTagline = false, style }: LogoProps) {
  const sizes = {
    sm: { height: 32, text: 16, tagline: 10 },
    md: { height: 48, text: 22, tagline: 12 },
    lg: { height: 64, text: 32, tagline: 14 },
    xl: { height: 80, text: 44, tagline: 16 },
  };

  const { height, text, tagline } = sizes[size];

  return (
    <View style={[styles.container, style]}>
      {/* Logo Image */}
      <Image
        source={require('@/assets/images/nearhub_logo.png')}
        style={{ width: height * 2.5, height: height }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
