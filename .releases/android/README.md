# Android Release — ɳTask

## Prerequisites
- EAS CLI: `npm install -g eas-cli` or `pnpm dlx eas-cli`
- Logged in: `eas login` (use nself-org account)
- EAS project linked (check `apps/mobile/eas.json`)

## Build (EAS — recommended)
```bash
cd apps/mobile
eas build --platform android --profile production
```

Signing is handled automatically via EAS secrets. No local keystore setup needed.

## Submit to Play Store
```bash
eas submit --platform android --latest
# or specify a specific build:
eas submit --platform android --id <BUILD_ID>
```

## Sideload APK (manual testing)

1. Download the APK from EAS build output or from the Play Store internal track
2. Enable Unknown Sources: Settings → Security → Install unknown apps → Enable for your file manager
3. Tap the APK to install
4. Grant permissions: Internet (required for real-time sync)

## App Details
- Package: `org.nself.tasks`
- Min SDK: Android 8.0 (API 26)
- Target SDK: Android 14 (API 34)
