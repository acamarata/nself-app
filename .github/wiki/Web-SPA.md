# Web SaaS Setup (ɳTasks)

Setup guide for the React 19 + Vite 6 web SaaS at `task.nself.org` (`apps/web/`).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 20+ | JS/TS runtime |
| pnpm | 10+ | Package manager |

## Install

```bash
git clone https://github.com/nself-org/ntask.git
cd ntask
pnpm install
```

## Environment Config

```bash
cd apps/web
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
cd apps/web
pnpm dev     # http://localhost:5173 by default
```

## Build

```bash
cd apps/web
pnpm build      # Production build (dist/)
pnpm preview    # Preview production build locally
```

## Tests

```bash
cd apps/web
pnpm test               # Vitest (once)
pnpm test -- --watch    # Watch mode
pnpm test -- --coverage # Coverage report
pnpm test:e2e           # Playwright e2e (if configured)
```

## Deployment

The hosted `task.nself.org` is served from `web/ntask/` (the `web/` repo) via Vercel. The `apps/web/` directory here is the development workspace; the Vercel deploy in `web/ntask/` may differ in build config.

See [Deployment](Deployment) for staging/production deploy guide.

## Related

- [Backend-Setup](Backend-Setup): start the Docker Compose backend
- [Monorepo-Setup](Monorepo-Setup): workspace layout
- [testing](testing): full testing guide
- [Deployment](Deployment): Vercel deploy
