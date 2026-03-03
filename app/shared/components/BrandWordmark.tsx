import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';

interface BrandWordmarkProps {
  size?: number;
  showAiTag?: boolean;
}

const NEAR_TEXT = 'Near';
const HUB_TEXT = 'Hub';

export default function BrandWordmark({ size = 28, showAiTag = true }: BrandWordmarkProps) {
  const badgeScale = Math.max(0.72, Math.min(1.1, size / 28));

  return (
    <View style={[styles.container, showAiTag && styles.containerWithBadge]}>
      <Text style={[styles.wordmarkBase, { fontSize: size }]} numberOfLines={1}>
        <Text style={styles.nearText}>{NEAR_TEXT}</Text>
        <Text style={styles.hubText}>{HUB_TEXT}</Text>
      </Text>

      {showAiTag && (
        <View
          style={[
            styles.aiBadge,
            {
              transform: [{ scale: badgeScale }],
            },
          ]}
        >
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'flex-start',
  },
  containerWithBadge: {
    paddingRight: 18,
  },
  wordmarkBase: {
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  nearText: {
    color: Colors.primaryDark,
  },
  hubText: {
    color: Colors.primaryLight,
  },
  aiBadge: {
    position: 'absolute',
    right: 0,
    top: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBadgeText: {
    color: Colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
