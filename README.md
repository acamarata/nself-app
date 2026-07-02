# ɳTasks

Self-hosted, multi-surface task management reference app. React Native mobile + Vite web SaaS + Tauri desktop + rn-tvos TV, all over one Postgres + Hasura + Auth backend.

[![Version](https://img.shields.io/github/v/release/nself-org/ntask?label=version)](https://github.com/nself-org/ntask/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Build](https://github.com/nself-org/ntask/actions/workflows/test.yml/badge.svg)](https://github.com/nself-org/ntask/actions/workflows/test.yml)
<!-- VERSION_BADGE -->

> **Full self-hosting guide:** [.github/docs/SELF-HOSTING.md](.github/docs/SELF-HOSTING.md)

## Description

**ɳTasks** is a reference app in the nSelf ecosystem. Four client surfaces (React Native mobile, Vite web SaaS at `task.nself.org`, Tauri desktop, rn-tvos TV) connect to a shared backend running PostgreSQL 16, Hasura GraphQL Engine, Hasura Auth, Hasura Storage, and MinIO, orchestrated under `backend/` by the nSelf CLI.

Like the other Type C reference apps (`nchat`, `nclaw`, `ntv`), ɳTasks uses the nSelf CLI as its backend entry point. `make up` delegates to `nself start`; `make down` delegates to `nself stop`.

## Quick Start

> **Fastest path:** `make bootstrap` sets up the full local environment in one command.
> Edit `backend/.env.dev` after for custom secrets. See step-by-step below for details.

### 1. Prerequisites

- Docker 20+ with Docker Compose v2
- nSelf CLI v1.0.9+: `brew install nself-org/tap/nself` (macOS) or see [nself.org/install](https://nself.org/install)
- Node.js 20+ and pnpm 10+
- (iOS/Android builds) Expo CLI: `pnpm add -g expo-cli`

### 2. Backend

```bash
git clone https://github.com/nself-org/ntask.git
cd ntask
cp backend/.env.example backend/.env.dev    # then edit secrets
make build           # generates docker-compose.yml (run once)
make up              # starts Postgres + Hasura + Auth + Storage
make health          # verify all services are green
```

### 3. Mobile App (React Native / Expo)

```bash
cd apps/mobile
cp .env.example .env.local       # edit EXPO_PUBLIC_* if needed
pnpm install
pnpm start                       # Expo dev server
# Scan the QR code with Expo Go, or: pnpm ios / pnpm android
# On first launch: enter your backend URL (http://localhost:8080)
# On a real device use your LAN IP: http://192.168.x.x:8080
```

### 4. Demo Data (optional)

```bash
DEMO_SEED=1 make demo-seed      # loads example tasks and lists
# Login: demo@example.com / DemoPass123!
```

## Features

ɳTasks ships 35+ task-management capabilities (lists, tags, recurring tasks, sharing, real-time presence, calendar/today/overdue views, attachments, smart notifications, PWA install). The full inventory lives in the wiki:

- See the [Features wiki page](https://github.com/nself-org/ntask/wiki/Features) for the complete capability list with status, configuration, and usage notes.

## Installation

### Prerequisites

- React Native/Expo environment ([setup guide](https://docs.expo.dev/get-started/installation/))
- nSelf CLI v1.0.9+ ([install guide](https://nself.org/install))
- Docker 20+ with Docker Compose v2
- GNU Make
- Node.js 20+ and pnpm 10+
- (Optional) Hasura CLI for migration management

### Backend Setup

```bash
cd backend
cp .env.example .env.dev         # fill in project secrets
nself build                       # generates docker-compose.yml, nginx config, SSL certs
nself start                       # start the stack  (or: make up)
make health                       # verify all services are healthy
```

Stop with `nself stop` (or `make down`). View logs with `make logs`. Open a Postgres shell with `make psql`.

### Mobile App Setup

```bash
cd apps/mobile
cp .env.example .env.local        # customize EXPO_PUBLIC_* vars
pnpm install
pnpm start                        # Expo dev server
```

For platform-specific builds:

```bash
pnpm ios          # iOS simulator (macOS host required)
pnpm android      # Android emulator
pnpm build        # EAS production build
```

## Usage

```bash
make up                            # start backend (or: cd backend && nself start)
make mobile-start                  # start Expo dev server
DEMO_SEED=1 make demo-seed         # load example tasks (optional)
```

```bash
make migrate                       # apply pending Hasura migrations
make backup                        # create a Postgres backup to backend/backups/
cd backend && nself start --env staging   # bring up staging stack
```

```bash
make mobile-test                   # unit + integration tests
make ci-local                      # full CI gate (lint + typecheck + tests)
```

## Architecture

All four surfaces (mobile, web, desktop, TV) connect to a Docker Compose backend (PostgreSQL 16, Hasura GraphQL Engine, Hasura Auth, Hasura Storage over MinIO, Mailpit for dev email, Traefik for staging/prod HTTPS). Hasura GraphQL is the only backend boundary — no direct Postgres access.

See the [Backend Architecture wiki page](https://github.com/nself-org/ntask/wiki/Backend-Architecture) for the full deep-dive.

## Platform Support

| Target | Status | Notes |
|--------|--------|-------|
| iOS | Active | `pnpm ios` (sim) or EAS build for device |
| Android | Active | `pnpm android` (emulator) or EAS build |
| Web SaaS | Active | `task.nself.org` — built and deployed from the separate `web/ntask` repo, not from this repo |
| Desktop (macOS/Win/Linux) | Shipped | `apps/desktop/` — Tauri 2 shell wrapping the `web/ntask` Vite SPA |
| Apple TV / Android TV | Scaffolded | `apps/tv/` — react-native-tvos; package isolation solved, EAS build not yet triggered |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile (iOS/Android) | React Native 0.79 + Expo 53 (TypeScript) |
| Web SaaS | React 19 + Vite 6 (TypeScript), built in the separate `web/ntask` repo |
| Desktop | Tauri 2 wrapping the `web/ntask` Vite SPA (Shipped) |
| TV (Apple TV / Android TV) | react-native-tvos (Scaffolded — EAS build pending) |
| State management | Zustand |
| Local storage | expo-secure-store + AsyncStorage (mobile) / localStorage (web) |
| Networking | GraphQL over HTTP/WS (urql) |
| Shared packages | @nself/* (auth-core, types, graphql-client, ui, observability) |
| Database | PostgreSQL 16 |
| GraphQL | Hasura GraphQL Engine |
| Auth | Hasura Auth (JWT) |
| Storage | Hasura Storage over MinIO (S3-compatible) |
| Dev email | Mailpit |
| HTTPS (staging/prod) | Traefik with Let's Encrypt |
| Orchestration | nSelf CLI + Docker Compose + Makefile |

## CLI & MCP Server

`cli/` — the open-source `ntask` terminal CLI (login, list/add/complete/search tasks, `--json` output for scripting). `mcp/` — an MCP server exposing the same operations as tools (`task_list`, `task_add`, `task_complete`, `task_search`, `task_update`, `list_lists`, `list_create`) so AI agents like Claude or Cursor can manage tasks directly. Both share one client library so behavior stays in sync. See [cli/README.md](cli/README.md) and [mcp/README.md](mcp/README.md).

## Documentation

- [Self-Hosting Guide](.github/docs/SELF-HOSTING.md)
- [Upgrade Guide](.github/docs/UPGRADE.md) (stub — see H-S4-T2)
- [Home](https://github.com/nself-org/ntask/wiki/Home)
- [Backend Setup](https://github.com/nself-org/ntask/wiki/Backend-Setup)
- [Backend Architecture](https://github.com/nself-org/ntask/wiki/Backend-Architecture)
- [Database Schema](https://github.com/nself-org/ntask/wiki/Database-Schema)
- [Features](https://github.com/nself-org/ntask/wiki/Features)
- [Deployment](https://github.com/nself-org/ntask/wiki/Deployment)
- [Security](https://github.com/nself-org/ntask/wiki/Security)

## Contributing

See [Contributing](https://github.com/nself-org/ntask/wiki/Contributing) for the contributor guide.

## License

MIT, see [LICENSE](LICENSE).

## Related Repos

- [cli](https://github.com/nself-org/cli): the nSelf CLI
- [admin](https://github.com/nself-org/admin): local GUI companion for the CLI
- [nchat](https://github.com/nself-org/nchat): open-source chat reference app
- [nclaw](https://github.com/nself-org/nclaw): open-source AI assistant reference app
- [ntv](https://github.com/nself-org/ntv): open-source media player reference app
- [web](https://github.com/nself-org/web): `nself.org` marketing + docs + cloud

