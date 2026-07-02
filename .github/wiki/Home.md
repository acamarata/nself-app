# ɳTasks

> Self-hosted, collaborative task management. React Native mobile + Vite web SaaS + Tauri desktop + rn-tvos TV, all over one Postgres + Hasura + Auth backend. Version 1.1.4.

## Quick Start

```bash
git clone https://github.com/nself-org/ntask.git my-tasks
cd my-tasks/backend && cp .env.example .env.dev && make up
cd ../apps/mobile && pnpm install && pnpm start
```

The mobile app (Expo) launches against the local backend. Open the Hasura console at `http://localhost:8080/console`. The web SaaS lives in a separate repo — see [Web-SPA](Web-SPA).

## Contents

- [Getting Started](#getting-started)
- [Core Stack](#core-stack)
- [Features](#features)
- [Commands](#commands)
- [Configuration](#configuration)
- [Plugins](#plugins)
- [Guides](#guides)
- [Architecture](#architecture)
- [Security](#security)
- [Contributing](#contributing)
- [Resources](#resources)

## Getting Started

- [Getting-Started](Getting-Started): prerequisites and first run
- [Quickstart-Guide](Quickstart-Guide): short version for experienced devs
- [RN-Setup](RN-Setup): React Native mobile app setup
- [Web-SPA](Web-SPA): Vite web SaaS setup
- [Desktop](Desktop): Tauri desktop setup (Shipped)
- [TV](TV): rn-tvos setup (Scaffolded)
- [Backend-Setup](Backend-Setup): start the Docker Compose backend
- [Backend-Troubleshooting](Backend-Troubleshooting): fixes for common backend issues

## Core Stack

### Client Surfaces

| Surface | Framework | Path |
|---|---|---|
| Mobile | React Native 0.79.7 + Expo 53 | `apps/mobile/` |
| Web SaaS | React 19 + Vite 6 SPA | `web/ntask/` in the separate `web` monorepo → task.nself.org |
| Desktop | Tauri 2 | `apps/desktop/` — Shipped, wraps `web/ntask` |
| TV | react-native-tvos | `apps/tv/` — Scaffolded |

All surfaces share `@nself/*` packages and connect to the same Hasura GraphQL backend.

### Backend (self-contained Docker Compose)

- **PostgreSQL 16**: database
- **Hasura GraphQL Engine**: instant GraphQL API
- **Hasura Auth**: JWT authentication
- **Hasura Storage**: S3-compatible upload/download
- **MinIO**: object storage backend
- **Mailpit**: dev email capture
- **Traefik**: HTTPS reverse proxy (staging and production only)

See [Backend-Architecture](Backend-Architecture) for the full service map.

## Features

- [Features](Features): full capability inventory (35+ features)
- Categories: List Management, Advanced Todos, Real-Time Collaboration, Sharing, Search and Filtering, Sorting, Bulk Operations, Smart Views, Attachments, Notifications, User Preferences

## Commands

Backend is operated via `make` targets (thin aliases for `nself start` / `nself stop`):

```bash
make up | make down | make restart
make logs | make status | make health
make psql | make migrate | make metadata-apply
make backup | make restore FILE=...
make staging-up | make prod-up
```

Mobile: `cd apps/mobile && pnpm start`
Web SaaS: `cd web/ntask && pnpm dev` (separate repo)

## Configuration

- [Backend-Setup](Backend-Setup): `.env.dev` reference and required variables
- [RN-Setup](RN-Setup): mobile env config (`apps/mobile/.env.local`)
- [Web-SPA](Web-SPA): web env config (`web/ntask/.env.local`, separate repo)

## Plugins

`ntask` is free-plugins-only by design (per F03, F12). No pro plugins (ai, claw, mux, livekit, etc.). Free capabilities used: auth and storage, delivered as standard Hasura services.

## Guides

- [Deployment](Deployment): staging and production deployment
- [Monorepo-Setup](Monorepo-Setup): pnpm workspace layout
- [Developer-Tools](Developer-Tools): testing, debugging, dev tooling
- [API-Reference](API-Reference): GraphQL API reference (stub — pending Epic B)
- [CLI](CLI): the `ntask` terminal CLI
- [MCP-Server](MCP-Server): the MCP server for AI agents

## Architecture

- [Backend-Architecture](Backend-Architecture): services, ports, data flow
- [Database-Schema](Database-Schema): table reference

## Security

- [Security](Security): security best practices

## Contributing

- [Contributing](Contributing): contributor guide
- [Changelog](Changelog): version history

## Resources

- **GitHub:** [nself-org/ntask](https://github.com/nself-org/ntask)
- **Issues:** [Report a bug](https://github.com/nself-org/ntask/issues)
- **Discussions:** [Q&A](https://github.com/nself-org/ntask/discussions)
- **License:** [MIT](https://github.com/nself-org/ntask/blob/main/LICENSE)
- **Marketing site:** [task.nself.org](https://task.nself.org)
- **Ecosystem docs:** [docs.nself.org](https://docs.nself.org)
