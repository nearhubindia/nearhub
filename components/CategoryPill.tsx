import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { Category, CATEGORY_ICONS } from '@/lib/types';

interface CategoryPillProps {
  category: Category | 'All';
  isSelected: boolean;
  onPress: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  All: Colors.primary,
  Electronics: Colors.categoryElectronics,
  Vehicles: Colors.categoryVehicles,
  Furniture: Colors.categoryFurniture,
  Clothing: Colors.categoryClothing,
  'Home & Garden': Colors.categoryHome,
  Sports: Colors.categorySports,
  Other: Colors.categoryOther,
};

export default function CategoryPill({ category, isSelected, onPress }: CategoryPillProps) {
  const color = CATEGORY_COLORS[category] || Colors.primary;
  const iconInfo = category === 'All' ? null : CATEGORY_ICONS[category as Category];

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
      {iconInfo && (
        <Feather
          name={iconInfo.name as any}
          size={14}
          color={isSelected ? '#fff' : color}
        />
      )}
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
