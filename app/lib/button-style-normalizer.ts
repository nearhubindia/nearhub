import { StyleSheet } from 'react-native';

const STANDARD_BUTTON_RADIUS = 12;
const BUTTON_STYLE_KEY =
  /(button|btn|cta|action|submit|continue|apply|send|save|post|buy|pay|message)/i;
const NON_BUTTON_STYLE_KEY =
  /(container|wrapper|row|column|card|pill|chip|badge|avatar|image|thumb|dot|indicator|progress|track|bar|backdrop|overlay|sheet|modal|header|footer|tab|item|content)/i;

let isInstalled = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldNormalize(styleKey: string, styleValue: Record<string, unknown>): boolean {
  if (!BUTTON_STYLE_KEY.test(styleKey) || NON_BUTTON_STYLE_KEY.test(styleKey)) {
    return false;
  }

  // Keep explicitly circular shapes intact.
  const width = typeof styleValue.width === 'number' ? styleValue.width : undefined;
  const height = typeof styleValue.height === 'number' ? styleValue.height : undefined;
  const radius = typeof styleValue.borderRadius === 'number' ? styleValue.borderRadius : undefined;

  if (width && height && width === height && radius && radius >= width / 2 - 1) {
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

      if (currentRadius !== STANDARD_BUTTON_RADIUS) {
        normalizedStyles[styleKey] = {
          ...styleValue,
          borderRadius: STANDARD_BUTTON_RADIUS,
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
