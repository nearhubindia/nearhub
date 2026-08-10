import { Platform, StyleSheet } from 'react-native';

export const MOBILE_CORNER_RADIUS = 2;
const BUTTON_STYLE_KEY =
  /(button|btn|cta|action|submit|continue|apply|send|save|post|buy|pay|message)/i;
const SECTION_STYLE_KEY =
  /(section|card|panel|shell|surface|group|container|input|field|item|row|wrap|banner|prompt|option|tier|summary|history|report|spec|notice|availability|metadata|detail|activity|price|listing|invoice|subscription|profile)/i;
const EXCLUDED_STYLE_KEY =
  /(pill|chip|badge|avatar|image|thumb|dot|indicator|progress|track|bar|backdrop|overlay|sheet|modal|header|footer|tab|icon|bubble|glow|orb|circle|gradient|photo|counter|handle|logo|wordmark|splash)/i;

let isInstalled = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldNormalize(styleKey: string, styleValue: Record<string, unknown>): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  const isButton = BUTTON_STYLE_KEY.test(styleKey);
  const isSection = SECTION_STYLE_KEY.test(styleKey);
  const isSurface = styleValue.backgroundColor !== undefined;
  if ((!isButton && !isSection && !isSurface) || (!isButton && EXCLUDED_STYLE_KEY.test(styleKey))) {
    return false;
  }

  // Keep explicitly circular shapes intact.
  const width = typeof styleValue.width === 'number' ? styleValue.width : undefined;
  const height = typeof styleValue.height === 'number' ? styleValue.height : undefined;
  const radius = typeof styleValue.borderRadius === 'number' ? styleValue.borderRadius : undefined;

  if (width && height && width === height && radius && radius >= width / 2 - 1) {
    return false;
  }

  // Do not introduce corners on ordinary colored surfaces that were not
  // rounded already. Buttons still receive the standard radius when their
  // style omitted one entirely.
  if (radius === undefined && !isButton) {
    return false;
  }

  return true;
}

export function installButtonStyleNormalizer(): void {
  if (isInstalled) {
    return;
  }

  const originalCreate = StyleSheet.create.bind(StyleSheet);

  StyleSheet.create = ((styles: Record<string, unknown>) => {
    const normalizedStyles: Record<string, unknown> = {};

    for (const [styleKey, styleValue] of Object.entries(styles || {})) {
      if (!isRecord(styleValue) || !shouldNormalize(styleKey, styleValue)) {
        normalizedStyles[styleKey] = styleValue;
        continue;
      }

      const currentRadius =
        typeof styleValue.borderRadius === 'number' ? styleValue.borderRadius : undefined;

      if (currentRadius !== MOBILE_CORNER_RADIUS) {
        normalizedStyles[styleKey] = {
          ...styleValue,
          borderRadius: MOBILE_CORNER_RADIUS,
        };
      } else {
        normalizedStyles[styleKey] = styleValue;
      }
    }

    return originalCreate(normalizedStyles as any);
  }) as typeof StyleSheet.create;

  isInstalled = true;
}

installButtonStyleNormalizer();
