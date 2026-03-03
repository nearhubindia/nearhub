const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to allow cleartext HTTP traffic on Android.
 * Required for connecting to local backend over http:// during development.
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (manifest.application?.[0]?.$) {
      manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
};
