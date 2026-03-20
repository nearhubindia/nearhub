import { Platform } from 'react-native';
import { responsiveModerateScale } from '@/lib/responsive';

export const TAB_BAR_BASE_HEIGHT = Platform.OS === 'web' ? 74 : 56;
export const TAB_BAR_MIN_BOTTOM_PADDING = Platform.OS === 'web' ? 0 : 6;

export function getTabBarHeight(bottomInset: number): number {
  const normalizedBottomInset = Platform.OS === 'web' ? 0 : bottomInset;
  const scaledBaseHeight =
    Platform.OS === 'web' ? TAB_BAR_BASE_HEIGHT : responsiveModerateScale(TAB_BAR_BASE_HEIGHT);
  return scaledBaseHeight + normalizedBottomInset;
}

export function getTabOverlayContentPadding(bottomInset: number, extraSpacing = 20): number {
  const scaledExtraSpacing =
    Platform.OS === 'web' ? extraSpacing : responsiveModerateScale(extraSpacing);
  return getTabBarHeight(bottomInset) + scaledExtraSpacing;
}
