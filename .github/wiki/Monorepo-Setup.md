# Workspace Setup — ɳTasks pnpm Monorepo

ɳTasks is a pnpm workspace with the app surfaces under `apps/` (mobile, desktop, TV, CLI, MCP) plus the web SaaS in `web/`, all sharing a common backend and the `@nself/*` packages.

---

## Overview

```
ntask/
├── apps/
│   ├── mobile/    # React Native 0.79.7 + Expo 53 (iOS + Android)
│   ├── desktop/   # Tauri 2 wrapping the web SPA (macOS/Windows/Linux) — Shipped
│   ├── tv/        # react-native-tvos (Apple TV + Android TV) — Scaffolded
│   ├── cli/       # ntask terminal CLI
│   └── mcp/       # MCP server for AI agents
├── backend/       # Docker Compose stack (nSelf-First)
├── tests/         # Playwright e2e against a deployed surface
├── pnpm-workspace.yaml
├── package.json   # Root workspace scripts
└── Makefile       # Backend convenience targets
```

The web SaaS (React 19 + Vite 6 SPA, `task.nself.org`) is `web/` in this repo.

All apps consume shared TypeScript packages from `packages/` (`@nself/*`) via pnpm workspace protocol.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| pnpm | 10+ | Workspace package manager |
| Node | 20+ | JS/TS runtime |
| Expo CLI | Latest | Mobile + TV dev server |
| EAS CLI | Latest | Cloud builds for mobile/TV |
| Rust (rustup) | Latest stable | Desktop (Tauri 2) |
| XCode CLI | Latest | macOS/iOS builds |
| Docker | 20+ | Backend |
| Make | Any | Backend targets |

---

## Install

```bash
git clone https://github.com/nself-org/ntask.git
cd ntask
pnpm install   # installs all workspace packages
```

The `pnpm-workspace.yaml` includes `apps/mobile`, `apps/tv`, and `../packages/@nself/*`.

---

## Running Surfaces

### Mobile (React Native + Expo)

```bash
cd apps/mobile
pnpm start      # Expo dev server (opens in Expo Go or simulator)
pnpm ios        # iOS simulator (XCode required)
pnpm android    # Android emulator
```

See [RN-Setup](RN-Setup) for full mobile setup guide.

### Web SaaS (React + Vite)

```bash
git clone https://github.com/nself-org/web.git
cd web
pnpm dev        # Vite dev server (default: http://localhost:5173)
pnpm build      # Production build
```

See [Web-SPA](Web-SPA) for full web setup guide.

### Desktop (Tauri 2) — Shipped

```bash
cd apps/desktop
pnpm tauri dev  # Dev (requires Rust toolchain)
pnpm tauri build
```

See [Desktop](Desktop) for setup guide.

### TV (rn-tvos) — Scaffolded

```bash
cd apps/tv
pnpm start      # Dev server
pnpm tvos       # Apple TV simulator
pnpm android-tv # Android TV emulator
```

See [TV](TV) for setup guide.

### Backend

```bash
cd backend
cp .env.example .env.dev
make up         # Alias for nself start
make health     # Verify all services running
make down       # Stop
```

See [Backend-Setup](Backend-Setup) for full backend setup guide.

---

## Shared Packages

All surfaces import from `@nself/*` packages (sourced from the `packages/` repo at `../packages/@nself/*`):

| Package | Purpose |
|---|---|
| `@nself/auth-core` | JWT auth, token refresh, secure storage |
| `@nself/graphql-client` | urql client, GraphQL operations |
| `@nself/types` | Shared TypeScript types |
| `@nself/i18n` | Internationalization, RTL support, Hijri dates |
| `@nself/errors` | Error handling utilities |
| `@nself/observability` | Sentry integration |
| `@nself/sdk-core` | Core SDK utilities |

---

## Environment Config

Each surface has its own `.env.local` (copied from `.env.example`):

| Surface | Config file | Key vars |
|---|---|---|
| Mobile | `apps/mobile/.env.local` | `EXPO_PUBLIC_HASURA_URL`, `EXPO_PUBLIC_AUTH_URL` |
| Web SaaS | `web/.env.local` | `VITE_HASURA_URL`, `VITE_AUTH_URL`, `VITE_SENTRY_DSN` |
| Desktop | `apps/desktop/.env.local` | Same as web SaaS |
| TV | `apps/tv/.env.local` | Same as mobile |

Backend env: `backend/.env.dev` (copied from `backend/.env.example`).

---

## Common Pitfalls

### pnpm workspace protocol

When adding a `@nself/*` package as a dep, use workspace protocol in `package.json`:
```json
"@nself/auth-core": "workspace:*"
```

### Metro bundler cache

If RN bundler behaves unexpectedly after updating `@nself/*` packages:
```bash
cd apps/mobile
pnpm start --reset-cache
```

### Tauri needs Vite first

`apps/desktop` embeds the `web/` Vite build as its frontend. Build `web/` first, then `cd apps/desktop && pnpm tauri build` for production.

---

## Related

- [Backend-Setup](Backend-Setup): backend setup walkthrough
- [RN-Setup](RN-Setup): React Native mobile setup
- [Web-SPA](Web-SPA): Vite web SaaS setup
- [Desktop](Desktop): Tauri desktop setup
- [TV](TV): rn-tvos TV setup
