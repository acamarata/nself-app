# Deployment Guide — ɳTasks

Covers staging, production, and per-surface release for ɳTasks.

> **Version Lock:** All version bumps require an approved release plan. Do NOT bump version fields or create tags without explicit approval.

---

## Versioning

- **Source of truth:** `apps/mobile/package.json` `version:` field (mobile)
- **SPORT F01** and `.claude/docs/MASTER-VERSIONS.md` must match — update both on every bump
- Patch bumps within a Build wave are auto-authorized; minor/major require explicit user instruction

---

## Backend (self-hosted Docker Compose)

The backend runs as Docker Compose managed by `make`. Same process for staging and production — swap the compose overlay.

### Staging

```bash
cd backend
cp .env.example .env.staging  # fill in staging values
make staging-up               # docker compose + staging overlay (Traefik HTTPS)
make health                   # verify all services healthy
```

### Production

```bash
cd backend
cp .env.example .env.prod     # fill in production values
make prod-up                  # docker compose + production overlay (HTTPS + backups + limits)
make health
```

For the hosted `task.nself.org` demo, the same stack runs via `web/backend` (see PPI).

---

## Web SaaS (React + Vite → Vercel, separate repo)

The web SaaS is built and deployed from `web/` in this repo. Auto-deployed: merges to `main` trigger a Vercel deployment (Vercel git integration, `unity-dev` team).

```bash
cd web
pnpm build     # must exit 0 before pushing
```

Preview deploy (before merging):
```bash
vercel deploy --token $VERCEL_TOKEN
```

Production: automatic on merge to `main` via Vercel git integration.

---

## Mobile — iOS + Android (EAS Build)

```bash
cd apps/mobile
pnpm lint && pnpm typecheck && pnpm test   # all must pass

eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android --latest
eas submit --platform ios --latest
```

EAS profiles: `apps/mobile/eas.json` (development, preview, production).

### Signing Credentials (stored in EAS + vault)

| Platform | Credential | Storage |
|---|---|---|
| Android | ANDROID_KEYSTORE + passwords | EAS secrets + `~/.claude/vault.env` |
| iOS | App Store Connect API key | EAS secrets + `~/.claude/vault.env` |

Never commit `.jks`, `.p12`, `.pem`, `.mobileprovision` files.

### Store Details

| Platform | App ID | Store |
|---|---|---|
| Android | `org.nself.tasks` | Google Play |
| iOS | `org.nself.tasks` | App Store |
| Web | `task.nself.org` | Vercel (unity-dev team) |

---

## Desktop (Tauri 2) — Shipped

```bash
cd apps/desktop
pnpm tauri build     # produces .dmg / .msi / .deb
```

Distribute via GitHub Releases.

---

## TV (rn-tvos) — Scaffolded

Package isolation is solved and the app builds locally; no EAS release build has been triggered yet. See `apps/tv/SPIKE.md`.

```bash
cd apps/tv
eas build --platform ios --profile production  # tvOS, not yet run
```

---

## Release Checklist (when version bump is authorized)

1. Update `apps/mobile/package.json` version
2. Update `web/package.json` version (if releasing web)
3. Update root `package.json` version (must match mobile)
4. Update `.claude/docs/MASTER-VERSIONS.md` (ntask entry)
5. Update `~/Sites/nself/.opencode/phases/sport/F01-MASTER-VERSIONS.md`
6. Commit: `chore(release): bump ntask to vX.Y.Z`
7. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
8. Create GitHub Release with changelog entries

---

## Pre-Release Gates

```bash
# From repo root
pnpm version-check                             # Verify root + mobile versions match

# Mobile gates
cd apps/mobile
pnpm lint && pnpm typecheck && pnpm test       # must all pass

# Web SaaS gates (separate repo)
cd web
pnpm build                                     # must exit 0
```

---

## Related

- [Backend-Setup](Backend-Setup): backend setup walkthrough
- [Backend-Architecture](Backend-Architecture): service map
- [Changelog](Changelog): version history
- [Home](Home): wiki home
