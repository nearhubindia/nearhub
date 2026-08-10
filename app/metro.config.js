const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The compression policy is shared with the web runtime. Allow Metro to
// watch and bundle that platform-neutral module from the repository root.
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '..', 'shared')];

// Mutate in-place to preserve Expo's default extensions (sourceExts, assetExts)
// Do NOT spread/replace config.resolver — that drops platform-specific extension
// resolution and causes .web.js variants to load on Android.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = withNativeWind(config, { input: './global.css' });
