const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin for a single full-screen splash on Android.
 *
 * Shows near_hub_splash.png as the entire windowBackground so it fills
 * the screen edge-to-edge. The Android 12+ SplashScreen API icon is made
 * invisible (tiny dark circle matching bg color) so the user only sees
 * our full-screen image. No AnimatedSplash component needed.
 */
module.exports = function withFullScreenSplash(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
      const drawableDir = path.join(resDir, 'drawable');
      const valuesDir = path.join(resDir, 'values');

      const splashSrc = path.join(projectRoot, 'assets', 'images', 'near_hub_splash.png');
      if (!fs.existsSync(splashSrc)) {
        console.warn('[withFullScreenSplash] Splash image not found');
        return config;
      }

      if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });
      if (!fs.existsSync(valuesDir)) fs.mkdirSync(valuesDir, { recursive: true });

      // Copy splash image
      fs.copyFileSync(splashSrc, path.join(drawableDir, 'splash_fullscreen.png'));
      console.log('[withFullScreenSplash] Copied splash image');

      // Full-screen layer-list: bg color + image filling entire screen
      const drawableXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashscreen_background" />
    <item>
        <bitmap
            android:src="@drawable/splash_fullscreen"
            android:gravity="fill" />
    </item>
</layer-list>
`;
      fs.writeFileSync(path.join(drawableDir, 'splash_fullscreen_bg.xml'), drawableXml);
      console.log('[withFullScreenSplash] Created fullscreen drawable');

      // Tiny invisible icon (matches bg color) to hide the Android 12+ centered icon
      const transparentIconXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">
    <solid android:color="#0A0F1A" />
    <size android:width="1dp" android:height="1dp" />
</shape>
`;
      fs.writeFileSync(path.join(drawableDir, 'splash_transparent_icon.xml'), transparentIconXml);
      console.log('[withFullScreenSplash] Created transparent icon');

      // Override theme: visible splash (no blank screen)
      const overrideThemeXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="Theme.App.SplashScreen.FullScreen" parent="Theme.App.SplashScreen">
    <item name="android:windowBackground">@drawable/splash_fullscreen_bg</item>
    <item name="windowSplashScreenBackground">#0A0F1A</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
    <item name="android:windowFullscreen">true</item>
    <item name="android:windowNoTitle">true</item>
  </style>
</resources>
`;
      fs.writeFileSync(path.join(valuesDir, 'styles_splash_override.xml'), overrideThemeXml);
      console.log('[withFullScreenSplash] Created override theme');

      const packageName = config.android?.package || 'com.nearhub';
      const packagePath = packageName.replace(/\./g, path.sep);
      const mainActivityKotlinPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'MainActivity.kt'
      );

      if (fs.existsSync(mainActivityKotlinPath)) {
        const mainActivitySource = fs.readFileSync(mainActivityKotlinPath, 'utf8');
        const withoutRegisterCall = mainActivitySource
          .split('\n')
          .filter((line) => {
            const trimmedLine = line.trim();
            if (trimmedLine === 'import expo.modules.splashscreen.SplashScreenManager') {
              return false;
            }
            if (trimmedLine.includes('SplashScreenManager.registerOnActivity(this)')) {
              return false;
            }
            if (trimmedLine.startsWith('// @generated begin expo-splashscreen')) {
              return false;
            }
            if (trimmedLine.startsWith('// @generated end expo-splashscreen')) {
              return false;
            }
            return true;
          })
          .join('\n');

        if (withoutRegisterCall !== mainActivitySource) {
          fs.writeFileSync(mainActivityKotlinPath, withoutRegisterCall);
          console.log('[withFullScreenSplash] Removed SplashScreenManager from MainActivity');
        }
      }

      return config;
    },
  ]);

  // Set MainActivity to use our full-screen splash theme
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application;
    if (!application || !application[0] || !application[0].activity) return config;

    for (const activity of application[0].activity) {
      if (activity.$['android:name'] === '.MainActivity') {
        activity.$['android:theme'] = '@style/Theme.App.SplashScreen.FullScreen';
        console.log('[withFullScreenSplash] Set MainActivity theme');
        break;
      }
    }
    return config;
  });

  return config;
};
