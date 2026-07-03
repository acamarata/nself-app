# ɳTask Self-Hosting Guide

Run the full ɳTask stack on your own server. You keep your data. No account required.

---

## Overview

Self-hosting gives you:
- Full data ownership — tasks, files, and user accounts stay on your server
- MIT license — free forever, no subscription
- All features available locally (same backend as the managed cloud)

What you need:
- A machine that can run Docker (local laptop or a VPS)
- The nSelf CLI (free, open-source)
- Node.js 20+ and pnpm 9+ (for the mobile app)

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker + Compose v2 | 20+ | [docker.com](https://www.docker.com/products/docker-desktop/) |
| nSelf CLI | 1.2.1+ | `brew install nself-org/tap/nself` (macOS) or [nself.org/install](https://nself.org/install) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | `npm install -g pnpm` |
| Domain + DNS | — | Production only — for HTTPS via Traefik |

---

## Quick Start (5 commands)

```bash
git clone https://github.com/nself-org/ntask.git
cd ntask
make bootstrap               # copies env, builds, starts backend
# edit backend/.env.dev to set real secrets
make health                  # verify all services are green
DEMO_SEED=1 make demo-seed   # optional: load example tasks
```

After bootstrap, open the mobile app:

```bash
cd apps/mobile && pnpm start
```

Enter `http://localhost:8080` as the backend URL at first login (or your LAN IP on a real device).

---

## Step-by-Step (manual control)

```bash
# 1. Clone
git clone https://github.com/nself-org/ntask.git
cd ntask

# 2. Configure backend secrets
cp backend/.env.example backend/.env.dev
# Edit backend/.env.dev — change at minimum:
#   AUTH_JWT_SECRET  (openssl rand -hex 64)
#   POSTGRES_PASSWORD
#   HASURA_ADMIN_SECRET  (openssl rand -hex 32)

# 3. Build and start backend
cd backend
nself build      # generates docker-compose.yml from nself.yaml
nself start      # starts Postgres + Hasura + Auth + Storage + MinIO
make health      # all services should show OK

# 4. Configure mobile app
cd ../apps/mobile
cp .env.example .env.local
# Edit .env.local if you want a default backend URL pre-filled at login

# 5. Start mobile app
pnpm install
pnpm start
# Scan QR with Expo Go, or: pnpm ios / pnpm android
```

---

## Configuration

All backend configuration is in `backend/.env.dev`. Key variables:

| Variable | Required | Description | Production value |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Yes | Database password | Strong random string |
| `HASURA_ADMIN_SECRET` | Yes | Hasura Console + migration auth | `openssl rand -hex 32` |
| `AUTH_JWT_SECRET` | Yes | JWT signing key — minimum 64 chars | `openssl rand -hex 64` |
| `S3_ACCESS_KEY` | Yes | MinIO access key | Change from `minioaccesskey` |
| `S3_SECRET_KEY` | Yes | MinIO secret key | Change from `miniosecretkey` |
| `DOMAIN` | Prod only | Your domain for Traefik TLS | `yourdomain.com` |
| `ACME_EMAIL` | Prod only | Let's Encrypt contact email | `admin@yourdomain.com` |
| `DEMO_SEED` | No | Set to 1 to allow `make demo-seed` | Leave 0 on real installs |

Never commit `backend/.env.dev` — it is gitignored.

---

## Plugin Configuration

`backend/nself.yaml` declares which plugins are active for this app.
ɳTask uses free plugins only — no license key required.

Active plugins:

| Plugin | Purpose |
|---|---|
| auth | Email/password + OAuth user management |
| storage | File upload and download via MinIO |
| cron | Recurring task evaluation and scheduled jobs |
| notify | In-app and push notification routing |
| notifications | FCM/APNs device push delivery |
| jobs | Async background job queue |
| search | Full-text task search |
| feature-flags | Per-user and global feature rollout |
| audit-log | Tamper-evident mutation log |
| webhooks | HTTP callbacks on task/list events |
| invitations | Email-based list sharing |
| tokens | Scoped long-lived API tokens |

To verify active plugins after starting:

```bash
make psql
# then in psql:
SELECT name, tier, enabled FROM np_plugins WHERE enabled = true ORDER BY name;
```

---

## Production Deployment

For a real domain with HTTPS:

1. Point your domain DNS to the server IP.
2. Set `DOMAIN` and `ACME_EMAIL` in `backend/.env.dev`.
3. Start with the production compose overlay:

```bash
cd backend
nself build --env production
nself start --env production
```

Traefik obtains a Let's Encrypt certificate automatically. Services are available at:
- Hasura: `https://hasura.yourdomain.com`
- Auth: `https://auth.yourdomain.com`
- Storage: `https://storage.yourdomain.com`

---

## Connecting App Surfaces

### Mobile (React Native / Expo)

At first login the app prompts for a backend URL. Enter your Hasura URL:
- Local dev: `http://localhost:8080` (or `http://192.168.x.x:8080` on a real device)
- Production: `https://hasura.yourdomain.com`

Set `EXPO_PUBLIC_DEFAULT_SERVER_URL` in `apps/mobile/.env.local` to pre-fill this.

### Web App (task.nself.org)

The web SaaS at `task.nself.org` points to the managed nSelf cloud. To use your own
backend, set `VITE_BACKEND_URL` when deploying `web/ntask/`.

### Desktop (planned)

Tauri 2 desktop app is planned. It will use the same backend URL configured at login.

---

## Demo Data

Load example tasks, lists, and a demo user:

```bash
DEMO_SEED=1 make demo-seed
```

Login credentials: `demo@example.com` / `DemoPass123!`

Running twice is safe (idempotent). Remove or rotate the demo account before going to production.

---

## Backup

```bash
make backup
# Creates a timestamped SQL dump in backend/backups/
```

Restore from a backup:

```bash
make restore FILE=backend/backups/backup-20260627-120000.sql
```

---

## Upgrading

See [UPGRADE.md](UPGRADE.md).

One-command upgrade:

```bash
make upgrade
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and fixes.

Quick diagnostics:

```bash
make health           # check all services
make logs             # tail all service logs
make logs-hasura      # Hasura logs only
make logs-auth        # Auth service logs only
```
