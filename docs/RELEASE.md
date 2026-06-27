# ɳTask Release Guide

This guide covers how ɳTask is built and shipped on each platform.

> **Version Lock:** All version bumps require an approved release plan.
> Do NOT bump `apps/mobile/package.json` version or create a git tag without explicit approval.

---

## Versioning

- **Source of truth:** `apps/mobile/package.json` `version:` field (mobile); `web/ntask/package.json` (web SaaS)
- **SPORT F01** and `MASTER-VERSIONS.md` must match — update both on every bump
- Patch bumps within a Build wave are auto-authorized; minor/major require explicit user instruction
- `app/pubspec.yaml` is a legacy reference — **not the version source of truth**

---

## Release Checklist

### Pre-release (run locally)
```bash
# From repo root
pnpm version-check                        # Verify root + mobile versions match

# Mobile app gates
cd apps/mobile
pnpm lint && pnpm typecheck && pnpm test  # Must all pass

# Web SaaS gates
cd ../../web/ntask
pnpm build                                # Must exit 0
```

### Version bump (when approved)
1. Update `apps/mobile/package.json` version
2. Update `web/ntask/package.json` version (if releasing web)
3. Update root `package.json` version (must match mobile)
4. Update `.claude/docs/MASTER-VERSIONS.md` (ntask entry)
5. Update `~/Sites/nself/.opencode/phases/sport/F01-MASTER-VERSIONS.md`
6. Commit: `chore(release): bump ntask to vX.Y.Z`
7. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`

---

## Mobile (React Native + Expo)

**Status:** EAS build setup is pending (Epic C). Current process is manual.

### Prerequisites
- Node 20+, pnpm 10+
- Expo CLI: `pnpm dlx expo-cli`
- EAS CLI: `pnpm dlx eas-cli`
- Android: EAS handles signing via secrets — no local keystore needed for CI builds
- iOS: EAS handles Apple credentials — no local provisioning profile needed for CI builds

### Development build
```bash
cd apps/mobile
pnpm install
pnpm start           # Expo dev server
```

### Production build (EAS — when configured)
```bash
cd apps/mobile
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android --latest
eas submit --platform ios --latest
```

### Manual local build (interim, pre-EAS)
Android: Use Android Studio or `npx expo run:android --variant release`
iOS: Use Xcode or `npx expo run:ios --configuration Release`

---

## Web SaaS (Vite SPA → Vercel)

**Auto-deployed:** Merges to `main` trigger Vercel deployment automatically.

```bash
cd web/ntask
pnpm install  # from web/ root for workspace packages
pnpm build    # exits 0 = deploy-ready
```

Preview: `vercel deploy --token $VERCEL_TOKEN` from `web/ntask/`
Production: Auto on merge to main via Vercel git integration

---

## Desktop (Tauri 2)

**Status:** Desktop surface pending Epic E. Not yet released.

---

## TV (React Native TV)

**Status:** TV surface pending Epic F. Not yet released.

---

## Signing & Credentials

- Android signing: EAS secrets (`ANDROID_KEYSTORE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)
- iOS signing: EAS Apple credentials (`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY`)
- All secrets in `~/.claude/vault.env` locally; GitHub Actions Secrets for CI
- **Never commit** `.jks`, `.p12`, `.pem`, `.mobileprovision` files

---

## Store Details

| Platform | App ID | Store |
|---|---|---|
| Android | `org.nself.tasks` | Google Play |
| iOS | `org.nself.tasks` | App Store |
| Web | `task.nself.org` | Vercel (unity-dev team) |
