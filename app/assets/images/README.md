# Native image assets

Keep the app branding in these canonical files:

- `icon.png` — symbol-only Expo app icon and fallback listing/photo placeholder; Android and iOS launchers add the app label separately.
- `near_hub_splash.png` — full NearHub lockup used by the app/legacy splash artwork.
- `android-icon-foreground.png` — Android adaptive-icon foreground.
- `android-icon-monochrome.png` — Android themed-icon variant.
- `nearhub_logo.png` — in-app logo used by the shared logo component and AI valuator.
- `favicon.png` — web favicon configured in `app/app.json`.

The checked-in Android and iOS resources are generated platform copies of these sources. Android splash resources use a smaller padded copy of the full lockup because Android 12 masks the splash icon. When branding changes, update the canonical assets and refresh the platform copies together. Avoid adding alternate icon or splash variants here.
