# React Native Mobile Setup (ɳTasks)

Setup guide for the React Native + Expo mobile app (`apps/mobile/`).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 20+ | JS/TS runtime |
| pnpm | 10+ | Package manager |
| Expo CLI | Latest | `npm install -g expo-cli` |
| EAS CLI | Latest | `npm install -g eas-cli` (for cloud builds) |
| XCode | Latest | iOS simulator (macOS only) |
| Android Studio | Latest | Android emulator |

## Install

```bash
git clone https://github.com/nself-org/ntask.git
cd ntask
pnpm install         # installs all workspace packages
```

## Environment Config

```bash
cd apps/mobile
cp .env.example .env.local
```

Key vars in `.env.local`:

| Var | Default (dev) | Description |
|---|---|---|
| `EXPO_PUBLIC_HASURA_URL` | `http://localhost:8080/v1/graphql` | Hasura GraphQL endpoint |
| `EXPO_PUBLIC_AUTH_URL` | `http://localhost:4000` | Hasura Auth endpoint |
| `EXPO_PUBLIC_STORAGE_URL` | `http://localhost:8484` | Hasura Storage endpoint |

For simulator/emulator: replace `localhost` with your host machine IP (e.g., `10.0.2.2` for Android emulator on macOS).

## Run (Development)

Start the backend first:
```bash
cd backend && make up
```

Then start Expo dev server:
```bash
cd apps/mobile
pnpm start           # Expo Go or press i/a
pnpm ios             # iOS simulator (XCode required)
pnpm android         # Android emulator
```

## Tests

```bash
cd apps/mobile
pnpm test               # jest-expo (once)
pnpm test -- --watch    # watch mode
pnpm test -- --coverage # coverage (>= 80% line required)
```

### E2E (Detox)

E2E tests are `.skip`'d pending simulator provisioning. See `.claude/inbox/pci-native-simulator-detox.md`.

```bash
pnpm e2e:ios      # iOS simulator required
pnpm e2e:android  # Android emulator required
```

## Build for Release (EAS Build)

```bash
cd apps/mobile
eas build --platform ios     # iOS (requires Apple Developer account)
eas build --platform android # Android
eas build --platform all     # Both
```

EAS profiles: `apps/mobile/eas.json` (development, preview, production).

## Common Pitfalls

**Metro cache:** if bundler behaves unexpectedly after `@nself/*` package updates:
```bash
pnpm start --reset-cache
```

**Simulator IP:** mobile simulators cannot reach `localhost` — use host machine IP or `10.0.2.2` (Android).

**pnpm workspace:** `@nself/*` packages are resolved via workspace protocol — run `pnpm install` from the repo root, not inside `apps/mobile/`.

## Related

- [Backend-Setup](Backend-Setup): start the Docker Compose backend
- [Monorepo-Setup](Monorepo-Setup): workspace layout
- [testing](testing): full testing guide
