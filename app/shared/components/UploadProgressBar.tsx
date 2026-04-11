import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function UploadProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.container}>
      <View style={[styles.bar, { width: `${progress}%` }]} />
      <Text style={styles.text} numberOfLines={1}>
        {progress}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 22,
    backgroundColor: '#111827',
    borderRadius: 9,
    overflow: 'hidden',
    marginVertical: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  bar: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  text: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
