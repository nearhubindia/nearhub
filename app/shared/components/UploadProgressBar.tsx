import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function UploadProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.container}>
      <View style={[styles.bar, { width: `${progress}%` }]} />
      <Text style={styles.text}>{progress}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 18,
    backgroundColor: '#111827',
    borderRadius: 9,
    overflow: 'hidden',
    marginVertical: 8,
  },
  bar: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  text: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
