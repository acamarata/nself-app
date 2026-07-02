# Web SaaS Setup (ɳTasks)

Setup guide for the React 19 + Vite 6 web SaaS at `task.nself.org`. The app itself lives in a separate repo — `web/ntask/` in the `nself-org/web` monorepo — not in this repo. This repo (`ntask`) ships the backend plus the mobile, desktop, and TV clients; the web client is developed and deployed alongside the rest of nself.org.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 20+ | JS/TS runtime |
| pnpm | 10+ | Package manager |

## Install

```bash
git clone https://github.com/nself-org/web.git
cd web/ntask
pnpm install
```

## Environment Config

```bash
cd web/ntask
cp .env.example .env.local
```

Key vars:

| Var | Default (dev) | Description |
|---|---|---|
| `VITE_HASURA_URL` | `http://localhost:8080/v1/graphql` | Hasura GraphQL endpoint |
| `VITE_AUTH_URL` | `http://localhost:4000` | Hasura Auth endpoint |
| `VITE_STORAGE_URL` | `http://localhost:8484` | Hasura Storage endpoint |
| `VITE_SENTRY_DSN` | (optional) | Sentry error tracking DSN |

## Run (Development)

Start the backend first:
```bash
cd backend && make up
```

Then start Vite dev server:
```bash
cd web/ntask
pnpm dev     # http://localhost:5173 by default
```

## Build

```bash
cd web/ntask
pnpm build      # Production build (dist/)
pnpm preview    # Preview production build locally
```

## Tests

```bash
cd web/ntask
pnpm test               # Vitest (once)
pnpm test -- --watch    # Watch mode
pnpm test -- --coverage # Coverage report
pnpm test:e2e           # Playwright e2e
```

## Deployment

The hosted `task.nself.org` is served from `web/ntask/` (the `web` monorepo) via Vercel, pointed at this repo's backend. See [Deployment](Deployment) for the staging/production deploy guide.

## Related

- [Backend-Setup](Backend-Setup): start the Docker Compose backend
- [Desktop](Desktop): Tauri shell wrapping this same app
- [testing](testing): full testing guide
- [Deployment](Deployment): Vercel deploy
