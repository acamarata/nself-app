# ɳTasks

> Self-hosted task management reference app. Flutter client over a Postgres + Hasura + Auth backend. Version 1.0.9+1.

## Quick Start

```bash
git clone https://github.com/nself-org/task.git my-tasks
cd my-tasks/backend && cp .env.example .env && make up
cd ../app && flutter run
```

The Flutter app launches against the local backend. Open the Hasura console at `http://localhost:8080/console`.

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
- [Brand](#brand)
- [Contributing](#contributing)
- [Resources](#resources)

## Getting Started

- [Getting-Started](Getting-Started): install prerequisites and first run
- [Quickstart-Guide](Quickstart-Guide): short version for experienced devs
- [Backend-Setup](Backend-Setup): start the Docker Compose backend
- [Backend-Troubleshooting](Backend-Troubleshooting): fixes for common backend issues

## Core Stack

The backend is a self-contained Docker Compose stack (no nSelf CLI required: `task/` is the "any-stack" reference app):

- **PostgreSQL 16**: database
- **Hasura GraphQL Engine**: instant GraphQL API
- **Hasura Auth**: JWT authentication
- **Hasura Storage**: S3-compatible upload/download
- **MinIO**: object storage backend
- **Mailpit**: dev email capture
- **Traefik**: HTTPS reverse proxy (staging and production only)

Other Type C apps in the ecosystem (`chat`, `claw`, `ntv`) use the nSelf CLI; this repo demonstrates the same pattern as plain Docker Compose.

See [Backend-Architecture](Backend-Architecture) for the full service map.

## Features

- [Features](Features): full capability inventory (35+ features)
- Categories: List Management, Advanced Todos, Real-Time Collaboration, Sharing, Search and Filtering, Sorting, Bulk Operations, Smart Views, Attachments, Notifications, User Preferences, PWA, Cross-Platform Targets

## Commands

`task/` is operated via `make` targets, not nSelf CLI commands:

```bash
make up | make down | make restart
make logs | make status | make health
make psql | make migrate | make metadata-apply
make backup | make restore FILE=...
make staging-up | make prod-up
```

Full list and descriptions: [Backend-Setup](Backend-Setup).

For nSelf CLI commands across the wider ecosystem, see the [cli wiki](https://github.com/nself-org/cli/wiki).

## Configuration

- [Backend-Setup](Backend-Setup): `.env` reference and required variables
- See `backend/.env.example` for the full env template

## Plugins

`task/` is free-plugins-only by design (per F03, F12). It does not install nSelf pro plugins (ai, claw, mux, livekit, etc.). The free capabilities used here are auth and storage, both delivered as standard Hasura services.

For the full ecosystem inventory of 138 plugins (29 free + 109 pro), see the [cli wiki](https://github.com/nself-org/cli/wiki).

## Guides

- [Deployment](Deployment): staging and production deployment
- [Monorepo-Setup](Monorepo-Setup): placing this repo inside a larger workspace
- [Developer-Tools](Developer-Tools): testing, debugging, dev tooling

## Architecture

- [Backend-Architecture](Backend-Architecture): services, ports, data flow
- [Database-Schema](Database-Schema): table reference

## Security

- [Security](Security): security best practices

## Brand

ɳTasks shares the nSelf brand identity.

## Contributing

- [Contributing](Contributing): contributor guide
- [Changelog](Changelog): version history

## Resources

- **GitHub:** [nself-org/task](https://github.com/nself-org/task)
- **Issues:** [Report a bug](https://github.com/nself-org/task/issues)
- **Discussions:** [Q&A](https://github.com/nself-org/task/discussions)
- **License:** [MIT](https://github.com/nself-org/task/blob/main/LICENSE)
- **Marketing site:** [task.nself.org](https://task.nself.org) (web/task)
- **Ecosystem docs:** [docs.nself.org](https://docs.nself.org)
