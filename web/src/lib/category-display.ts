const FALLBACK_COLORS = ['#0759E6', '#0F766E', '#B45309', '#BE185D', '#4F46E5', '#15803D'];

function hashString(value: string): number {
  return value
    .trim()
    .toLowerCase()
    .split('')
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 11);
}

export function getCategoryAccent(category: string): string {
  const hash = hashString(category || 'other');
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
