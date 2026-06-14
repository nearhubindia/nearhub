import Colors from '@/constants/colors';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_PICTURE_IMAGES,
  CATEGORY_PICTURES,
} from '@/lib/types';

const FALLBACK_COLORS = [
  '#0759E6',
  '#0F766E',
  '#B45309',
  '#BE185D',
  '#4F46E5',
  '#15803D',
  '#7C3AED',
  '#C2410C',
];

const FALLBACK_ICONS = [
  'tag',
  'grid',
  'package',
  'briefcase',
  'truck',
  'home',
  'tool',
  'shopping-bag',
  'book',
  'coffee',
  'heart',
  'sun',
  'archive',
  'map-pin',
  'gift',
  'box',
] as const;

const FALLBACK_EMOJIS = ['🏷️', '📦', '✨', '🛍️', '📍', '🧰', '🚀', '🎯'];

function hashString(value: string): number {
  return value
    .trim()
    .toLowerCase()
    .split('')
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

export function getCategoryDisplayMeta(category: string) {
  const normalized = String(category || '').trim();
  const hash = hashString(normalized || 'other');

  return {
    color: CATEGORY_COLORS[normalized] || FALLBACK_COLORS[hash % FALLBACK_COLORS.length] || Colors.primary,
    icon: CATEGORY_ICONS[normalized]?.name || FALLBACK_ICONS[hash % FALLBACK_ICONS.length],
    picture: CATEGORY_PICTURES[normalized] || FALLBACK_EMOJIS[hash % FALLBACK_EMOJIS.length],
    pictureImage: CATEGORY_PICTURE_IMAGES[normalized] || '',
  };
}
