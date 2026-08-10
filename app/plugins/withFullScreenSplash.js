const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin for a consistent Android splash on all API levels.
 *
 * Android 12+ uses the system splash with a centered icon, while Android 11
 * and below use windowBackground. We intentionally keep both paths aligned:
 * dark background + centered splashscreen_logo with no stretching.
 */
module.exports = function withFullScreenSplash(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
      const drawableDir = path.join(resDir, 'drawable');
      const valuesDir = path.join(resDir, 'values');

      if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });
      if (!fs.existsSync(valuesDir)) fs.mkdirSync(valuesDir, { recursive: true });

      // Legacy splash for Android 11 and below: centered logo, no scale/crop artifacts.
      const drawableXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashscreen_background" />
    <item>
        <bitmap
            android:src="@drawable/splashscreen_logo"
            android:gravity="center" />
    </item>
</layer-list>
`;
      fs.writeFileSync(path.join(drawableDir, 'splash_fullscreen_bg.xml'), drawableXml);
      console.log('[withFullScreenSplash] Created centered legacy splash drawable');

      // Optional tiny icon asset (kept for compatibility with older generated resources).
      const transparentIconXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">
    <solid android:color="#0A0F1A" />
    <size android:width="1dp" android:height="1dp" />
</shape>
`;
      fs.writeFileSync(path.join(drawableDir, 'splash_transparent_icon.xml'), transparentIconXml);
      console.log('[withFullScreenSplash] Created transparent icon');

      // Override theme that keeps legacy and Android 12+ splash visuals consistent.
      // Do not set android:windowFullscreen here. The activity uses this theme
      // during startup, and keeping that flag on the launch theme can leave the
      // runtime content viewport fighting the status-bar insets on Android.
      const overrideThemeXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="Theme.App.SplashScreen.FullScreen" parent="Theme.App.SplashScreen">
    <item name="android:windowBackground">@drawable/splash_fullscreen_bg</item>
    <item name="windowSplashScreenBackground">#0A0F1A</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
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
