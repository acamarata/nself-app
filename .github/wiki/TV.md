# TV Setup (ɳTasks)

Setup guide for the rn-tvos app (`apps/tv/`).

> **Status: Scaffolded.** Package isolation (react-native-tvos alongside the mobile app's react-native) is solved and the app builds; EAS release builds have not been triggered yet. Treat this as an early preview, not a finished app. See `apps/tv/SPIKE.md` for the integration notes.

## Scope

The TV surface is a read-focused glanceable dashboard: Today view, Overdue view, and Calendar view. Optimized for D-pad navigation on Apple TV and Android TV.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 20+ | JS/TS runtime |
| pnpm | 10+ | Package manager |
| Expo CLI | Latest | `npm install -g expo-cli` |
| EAS CLI | Latest | `npm install -g eas-cli` |
| XCode | Latest | Apple TV Simulator (tvOS) |
| Android Studio | Latest | Android TV emulator |

## Environment Config

```bash
cd apps/tv
cp .env.example .env.local
```

Same env vars as mobile (`EXPO_PUBLIC_HASURA_URL`, `EXPO_PUBLIC_AUTH_URL`, etc.).

## Run (Development)

Start the backend first:
```bash
cd backend && make up
```

Then:
```bash
cd apps/tv
pnpm start        # Expo dev server
pnpm tvos         # Apple TV simulator
pnpm android-tv   # Android TV emulator
```

## Supported Platforms

| Platform | Status |
|---|---|
| Apple TV (tvOS) | Scaffolded — builds locally, no release build yet |
| Android TV | Scaffolded — builds locally, no release build yet |

## Related

- [Monorepo-Setup](Monorepo-Setup): workspace layout
- [RN-Setup](RN-Setup): React Native mobile setup (shares many patterns)
- [Backend-Setup](Backend-Setup): backend setup
