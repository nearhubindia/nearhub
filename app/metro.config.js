const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Mutate in-place to preserve Expo's default extensions (sourceExts, assetExts)
// Do NOT spread/replace config.resolver — that drops platform-specific extension
// resolution and causes .web.js variants to load on Android.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
