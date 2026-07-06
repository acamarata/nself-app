# Releasing apps/mobile

`ɳTask` mobile is built and distributed via [EAS Build](https://docs.expo.dev/build/introduction/)
(Expo Application Services). This doc is the exact command sequence to go from a clean checkout
to a distributable build. No EAS session exists in this environment as of this writing — the
commands below are the handoff for whoever runs them with real Expo credentials.

## Prerequisites

- An Expo account with access to the `ntask-mobile` project (or create one — see Step 2).
- `EXPO_TOKEN` or interactive browser login available (EAS CLI opens a browser for OAuth).
- Apple Developer + Google Play credentials only needed for `production` submit — `preview`
  builds (internal APK/IPA) don't need store credentials.

## One-time setup

```bash
cd apps/mobile

# 1. Log in (opens browser; or set EXPO_TOKEN env var for CI)
npx eas-cli login

# 2. Confirm session
npx eas-cli whoami

# 3. Link/create the real EAS project — app.json currently has a PLACEHOLDER
#    projectId ("ntask-mobile", not a UUID). `eas init` will replace
#    extra.eas.projectId with the real project UUID on first run.
npx eas-cli init
```

After `eas init`, commit the updated `app.json` (real `projectId` swapped in) and set
`EXPO_PUBLIC_EAS_PROJECT_ID` in `.env.local` / CI secrets to match, since `usePushToken.ts`
reads `Constants.expoConfig?.extra?.eas?.projectId` for push registration.

## Build profiles (`eas.json`)

| Profile | Distribution | Server URL default | Use for |
|---|---|---|---|
| `development` | internal, dev client | none (manual entry) | local device debugging |
| `preview` | internal (APK on Android) | `https://api.task.nself.org` (prod) | QA / TestFlight-less sideload |
| `production` | store (AAB/IPA) | `https://api.task.nself.org` (prod) | App Store / Play Store release |

Both `preview` and `production` bake in `EXPO_PUBLIC_DEFAULT_SERVER_URL=https://api.task.nself.org`
so store builds work against the hosted SaaS out of the box. Self-hosted users can still override
the server URL at first login (`LoginScreen` prefills from this default but the field stays editable).

## Post-login build command

```bash
cd apps/mobile

# Android internal APK (fastest path to a shareable build — no store credentials needed)
npx eas-cli build -p android --profile preview --non-interactive

# iOS internal build (requires Apple credentials on first run; EAS will prompt to create/reuse)
npx eas-cli build -p ios --profile preview --non-interactive

# Production store builds (after store listings + credentials are set up)
npx eas-cli build -p android --profile production
npx eas-cli build -p ios --profile production
```

`--non-interactive` is safe for `preview`/Android since `buildType: apk` needs no signing
credentials beyond EAS-managed ones. iOS still needs interactive credential setup the first time.

## Submit to stores (production only)

```bash
npx eas-cli submit -p android --profile production
npx eas-cli submit -p ios --profile production
```

`eas.json` submit config has placeholders (`APPLE_ID_FROM_EAS_SECRETS`, `FILL_AFTER_ASC_APP_CREATED`,
`FILL_FROM_APPLE_DEVELOPER_ACCOUNT`, `./google-services-key.json`) that must be filled in before
`submit` will work — see [EAS Submit docs](https://docs.expo.dev/submit/introduction/).

## Push notification credentials (FCM + APNs)

The push registration code path (`usePushToken.ts` → `RegisterDeviceToken` mutation →
`np_device_tokens`) is complete and wired end-to-end, but it is inert until real push
credentials exist — this is a manual step tied to paid Apple/Google developer accounts,
not something that can be scaffolded from this repo:

- **Android (FCM):** `app.json` references `android.googleServicesFile` via the
  `GOOGLE_SERVICES_JSON` env var (defaults to `./google-services.json`, which is
  gitignored and not present in this repo). Generate it from the Firebase console for
  the `dev.nself.ntask` package name, place it at `apps/mobile/google-services.json`
  (or point `GOOGLE_SERVICES_JSON` at it in EAS secrets), then re-run `eas build`.
- **iOS (APNs):** No local file is needed — `eas build` provisions the APNs key
  automatically once an Apple Developer account is linked (`eas credentials`). The
  `aps-environment: production` entitlement is already set in `app.json`.
- **Expo push service:** Both platforms route through Expo's push service
  (`getExpoPushTokenAsync`), so no separate FCM/APNs server keys are needed in
  application code — only the two credential artifacts above, uploaded once via EAS.

Until the FCM file exists, `usePushToken` no-ops gracefully in production Android builds
(permission request still fires; `getExpoPushTokenAsync` throws and is caught, so the
app never crashes — see the try/catch in `usePushToken.ts`).

## Verifying a build

```bash
npx eas-cli build:list --platform android --limit 5
npx eas-cli build:view <build-id>
```

The build page URL (printed at the end of `eas build`) shows live logs and, on success, a QR
code / download link for the artifact.
