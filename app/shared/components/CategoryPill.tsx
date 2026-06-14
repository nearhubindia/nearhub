import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { Category } from '@/lib/types';
import { getCategoryDisplayMeta } from '@/lib/category-display';
import { responsiveFont, responsiveModerateScale } from '@/lib/responsive';

interface CategoryPillProps {
  category: Category | 'All';
  isSelected: boolean;
  onPress: () => void;
}

export default function CategoryPill({ category, isSelected, onPress }: CategoryPillProps) {
  const meta = getCategoryDisplayMeta(category);
  const color = category === 'All' ? Colors.primary : meta.color;
  const iconName = category === 'All' ? 'grid' : meta.icon;

  return (
    <Pressable
      style={[
        styles.pill,
        isSelected
          ? { backgroundColor: color }
          : { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1 },
      ]}
      onPress={onPress}
    >
      <Feather
        name={iconName as any}
        size={responsiveModerateScale(12)}
        color={isSelected ? '#fff' : color}
      />
      <Text style={[styles.text, { color: isSelected ? '#fff' : Colors.textSecondary }]}>
        {category}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveModerateScale(12),
    paddingVertical: responsiveModerateScale(6),
    borderRadius: responsiveModerateScale(12),
    gap: responsiveModerateScale(5),
    marginRight: responsiveModerateScale(8),
  },
  text: {
    fontSize: responsiveFont(12),
    fontFamily: 'Inter_500Medium',
  },
});
