# Android App Installation

## Requirements
- Android 8.0 (Oreo) or higher
- 50MB free storage
- Internet connection for real-time sync

## Installation Steps

1. **Download the APK**
   ```
   nself-tasks-v0.1.0.apk
   ```

2. **Enable Unknown Sources**
   - Go to Settings → Security → Unknown Sources
   - Toggle ON to allow installation from this source

3. **Install**
   - Locate the downloaded APK in your Downloads folder
   - Tap to install
   - Grant requested permissions:
     - Camera (for photo completion proof)
     - Storage (for photo uploads)
     - Internet (for real-time sync)

4. **Launch**
   - Open ɳTask from your app drawer
   - Sign in with your account

## Features
- ✅ Task management with priorities
- ✅ Photo completion proof
- ✅ Task approval workflow (kids → parents)
- ✅ Real-time sync across devices
- ✅ Works offline (syncs when back online)
- ✅ Dark mode support
- ✅ Tablet-optimized layouts

## Troubleshooting

**App won't install**
- Check Android version (must be 8.0+)
- Enable Unknown Sources
- Clear Downloads app cache

**Camera not working**
- Grant camera permission in Settings → Apps → ɳTask → Permissions
- Restart the app

**Sync not working**
- Check internet connection
- Verify login credentials
- Check backend URL in settings

## Old Device Support

Optimized for:
- Low-end devices (2GB RAM)
- Slow internet connections
- Android 8.0+ (released 2017)

Performance tips:
- Enable "Lite Mode" in settings
- Disable animations if sluggish
- Compress photos before upload

## Building from Source

```bash
# From project root
cd frontend
pnpm build
pnpm dlx cap sync android
cd android
./gradlew assembleRelease

# Output:
# android/app/build/outputs/apk/release/app-release.apk
```
