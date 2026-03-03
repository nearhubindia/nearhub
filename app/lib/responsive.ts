import { Dimensions, PixelRatio, StyleSheet } from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 812;

export const responsiveWidth = (percent: number): number => wp(percent);
export const responsiveHeight = (percent: number): number => hp(percent);

export const responsiveScale = (size: number): number => {
  const { width } = Dimensions.get('window');
  return Math.round((width / DESIGN_WIDTH) * size);
};

export const responsiveModerateScale = (size: number, factor = 0.5): number => {
  const scaled = responsiveScale(size);
  return Math.round(size + (scaled - size) * factor);
};

export const responsiveFont = (size: number): number => RFValue(size, DESIGN_HEIGHT);

export const isTablet = (): boolean => {
  const { width, height } = Dimensions.get('window');
  const pixelDensity = PixelRatio.get();
  const adjustedWidth = width * pixelDensity;
  const adjustedHeight = height * pixelDensity;
  return Math.min(adjustedWidth, adjustedHeight) >= 1000;
};

const NON_SCALABLE_KEYS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'fontWeight',
  'aspectRatio',
]);

const FONT_KEYS = ['fontSize'];
const SPACING_KEYS = [
  'width',
  'height',
  'top',
  'right',
  'bottom',
  'left',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginHorizontal',
  'marginVertical',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingHorizontal',
  'paddingVertical',
  'gap',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'lineHeight',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'letterSpacing',
  'elevation',
];

function shouldScaleKey(key: string): boolean {
  if (NON_SCALABLE_KEYS.has(key)) return false;
  if (FONT_KEYS.includes(key)) return true;
  return SPACING_KEYS.includes(key);
}

function scaleStyleValue(key: string, value: unknown): unknown {
  if (typeof value !== 'number') return value;
  if (!shouldScaleKey(key)) return value;

  if (FONT_KEYS.includes(key)) {
    return responsiveFont(value);
  }

  if (key === 'lineHeight') {
    return responsiveModerateScale(value, 0.45);
  }

  return responsiveModerateScale(value);
}

export function createResponsiveStyles<
  T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>,
>(styles: T): T {
  const scaledStyles: Record<string, any> = {};

  for (const [styleKey, styleValue] of Object.entries(styles as Record<string, any>)) {
    const next: Record<string, any> = {};
    for (const [propKey, propValue] of Object.entries(styleValue || {})) {
      next[propKey] = scaleStyleValue(propKey, propValue);
    }
    scaledStyles[styleKey] = next;
  }

  return StyleSheet.create(scaledStyles) as T;
}
