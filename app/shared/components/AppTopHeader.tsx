import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';

type AppTopHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
};

export default function AppTopHeader({
  eyebrow,
  title,
  subtitle,
  onBackPress,
  rightAction,
}: AppTopHeaderProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.topRow}>
        {onBackPress ? (
          <Pressable style={styles.iconButton} onPress={onBackPress}>
            <Feather name="arrow-left" size={18} color={Colors.text} />
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
        {rightAction ? rightAction : <View style={styles.iconPlaceholder} />}
      </View>

      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconPlaceholder: {
    width: 36,
    height: 36,
  },
  eyebrow: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 6,
    color: '#0F172A',
    fontSize: 28,
    lineHeight: 32,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
});
