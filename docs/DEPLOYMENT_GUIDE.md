# NearHub Mobile App - Build & Deployment Guide

## 📱 Quick Start

### Option 1: EAS Local Build (Android APK) - Recommended

```bash
# Build a local APK (uses your configured IP in eas.json)
eas build --platform android --local

# Or specify a different profile
eas build --platform android --profile local-apk --local
```

**Time:** ~5-15 minutes (first build may be slower)  
**Output:** `build-*/app-release.apk`

---

## 🔧 Prerequisites

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Authenticate with EAS (one-time)

```bash
eas login
```

- You'll need an Expo account (free)
- Creates ~/.eas/credentials.json locally

### 3. Ensure Java & Android SDK (for local builds)

```bash
# Check Java
java -version

# Check Android SDK
$ANDROID_HOME/tools/bin/sdkmanager --list
```

---

## 🚀 Build Profiles

Your `eas.json` has these profiles:

### `local-apk` (Recommended for testing)

```json
{
  "distribution": "internal",
  "android": {
    "buildType": "apk",
    "gradleCommand": ":app:assembleRelease"
  },
  "env": {
    "EXPO_PUBLIC_DOMAIN": "192.168.29.58:5000"
  }
}
```

- **Output:** APK file (installable)
- **Backend:** 192.168.29.58:5000
- **Use Case:** Testing on physical devices

### `preview`

```json
{
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```

- Cloud-based build
- Good for CI/CD pipelines

### `production`

Empty - ready to configure for Play Store submission

---

## 📲 Installation on Device

### Method 1: Direct APK Install (Fastest)

```bash
# 1. Build APK
eas build --platform android --profile local-apk --local

# 2. Install on connected device
adb install -r build-*/app-release.apk
```

### Method 2: Automatic (via EAS)

```bash
# Builds and installs to connected device
eas build --platform android --profile local-apk --local --device
```

### Method 3: Manual Install

1. Build APK: `eas build --platform android --profile local-apk --local`
2. Download APK from build output
3. Transfer to phone via USB or email
4. Open file manager → find APK → tap to install
5. Enable "Unknown sources" if prompted

---

## 🔍 Troubleshooting

### Build Fails: "Cannot find Android SDK"

```bash
# Set ANDROID_HOME
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
export ANDROID_HOME=$HOME/Android/Sdk           # Linux
export ANDROID_HOME=%LOCALAPPDATA%\Android\sdk  # Windows
```

### APK Won't Install: "App not installed"

- Check Android version (app requires Android 8.0+)
- Enable "Unknown sources" in Settings > Security
- Uninstall previous version first: `adb uninstall com.nearhub`

### Backend Connection Error

Edit `eas.json` to match your server:

```json
"env": {
  "EXPO_PUBLIC_DOMAIN": "YOUR_IP:5000"
}
```

---

## 📊 Build Status Check

```bash
# View all your builds
eas build:list

# View specific build details
eas build:view <BUILD_ID>

# Cancel a build
eas build:cancel <BUILD_ID>
```

---

## 🔄 Development Workflow

### For Quick Testing During Development:

```bash
# Option 1: Expo Go (Fastest)
npm run expo:dev
# Scan QR code with Expo Go app

# Option 2: Development Build
eas build --platform android --profile development --local
# Installs Expo Development Client + your app

# Option 3: Production Build
eas build --platform android --profile local-apk --local
# Real app experience
```

---

## 📋 Deployment Checklist

- [ ] Update version in `app.json` and `package.json`
- [ ] Run `npm run quality-check` (lint + type-check)
- [ ] Test on device with `npm run expo:dev`
- [ ] Verify backend connection (check `eas.json` EXPO_PUBLIC_DOMAIN)
- [ ] Build: `eas build --platform android --profile local-apk --local`
- [ ] Install: `adb install -r build-*/app-release.apk`
- [ ] Test app functionality
- [ ] Commit code: `git commit -am "Release v1.0.0"`

---

## 🎯 Common Commands

```bash
# Full build & install in one command
eas build --platform android --profile local-apk --local && adb install -r build-*/app-release.apk

# View build logs in real-time
eas build --platform android --profile local-apk --local --verbose

# Clean build (sometimes fixes issues)
rm -rf node_modules .expo build-* && npm install && eas build --platform android --profile local-apk --local

# Check app version
grep -A2 '"version"' app.json
```

---

## 📚 Additional Resources

- [EAS Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Local Builds](https://docs.expo.dev/build-reference/local-builds/)
- [Expo Router Guide](https://docs.expo.dev/routing/introduction/)
- [NearHub Documentation](../docs/ARCHITECTURE.md)

---

## ❓ Need Help?

```bash
# Show help for EAS CLI
eas --help

# Show help for specific command
eas build --help

# Check Expo account status
eas whoami
```

Generated: February 20, 2026
