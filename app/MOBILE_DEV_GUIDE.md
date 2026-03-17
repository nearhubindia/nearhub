# Mobile Development Guide

## Daily Workflow

### 1. Start Metro

```bash
cd app
npm run dev
```

### 2. Run on Android Device/Emulator

```bash
cd app
npx expo run:android
```

If multiple devices are connected:

```bash
adb devices -l
npx expo run:android --device
```

## Native Changes

If you changed native config/plugins/splash/icons:

```bash
cd app
npx expo prebuild -p android --clean
npx expo run:android
```

## USB Debugging Checklist (Android)

- Enable Developer options
- Enable USB debugging
- Accept RSA prompt on phone
- Verify device:

```bash
adb devices -l
```

## Troubleshooting

### Device not detected

```bash
adb kill-server
adb start-server
adb devices -l
```

### Clean and rebuild Android app

```bash
cd app/android
./gradlew clean
cd ..
npx expo run:android
```

### Type-check before build

```bash
cd app
npm run type-check
```

## Notes

- New architecture is enabled for Android.
- Splash and Shorts layout fixes were tuned for Android 11+ behavior.
- Listing cards now read live `Views`, `Likes` (favorites/saves), and `Chats` from backend data.
