# Backend Setup

Step-by-step setup for the ɳTasks backend. The backend is a self-contained Docker Compose stack driven by a Makefile.

## Prerequisites

- Docker 20+ with Docker Compose v2
- GNU Make
- (Optional) Hasura CLI for migration management
- Free ports: 5432, 8080, 4000, 8484, 9000, 9001, 8025

## What You Get

- **PostgreSQL 16**: database
- **Hasura GraphQL Engine**: instant GraphQL API + console
- **Hasura Auth**: email + password JWT authentication
- **Hasura Storage**: S3-compatible upload and download API
- **MinIO**: object storage backend
- **Mailpit**: dev email capture (UI at `http://localhost:8025`)
- **Traefik**: HTTPS reverse proxy (only for staging and production profiles)

## Steps

### 1. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set:
- `POSTGRES_PASSWORD`: strong password for Postgres
- `HASURA_GRAPHQL_ADMIN_SECRET`: required to access the Hasura console
- `HASURA_GRAPHQL_JWT_SECRET`: JSON object with key + algorithm (see `.env.example` for the format)
- Auth provider secrets (Google, GitHub, etc.) if you want OAuth

### 2. Start the stack

```bash
make up
```

This brings up Postgres, Hasura, Auth, Storage, MinIO, and Mailpit. First run pulls images and runs `postgres/init.sql` to create extensions, schemas, and application tables.

### 3. Verify health

```bash
make health
```

Expected output: all four checks (Postgres, Hasura, Auth, Storage) report OK.

### 4. Apply Hasura migrations

```bash
make migrate
```

Applies pending Hasura migrations from `backend/hasura/migrations/`. Run `make migrate-status` to see migration state.

### 5. Apply Hasura metadata

```bash
make metadata-apply
```

Applies tracked tables, relationships, permissions, and remote schemas from `backend/hasura/metadata/`.

### 6. (Optional) Seed sample data

```bash
make seed
```

Runs the seed script from the app side to populate sample lists and todos for local testing.

## Useful Commands

```bash
make up                  # start the stack
make down                # stop the stack
make restart             # restart everything
make logs                # tail logs from all services
make logs-hasura         # tail Hasura logs only
make logs-auth           # tail Auth logs only
make status              # docker compose ps
make health              # health endpoint check
make psql                # open a Postgres shell
make console             # open Hasura console (requires hasura-cli on host)
make migrate             # apply pending migrations
make migrate-status      # show migration state
make metadata-apply      # apply Hasura metadata
make metadata-export     # export current metadata
make backup              # dump Postgres to ./backups/backup-<timestamp>.sql
make restore FILE=...    # restore from a backup file
make staging-up          # start staging stack (Traefik HTTPS)
make staging-down        # stop staging stack
make prod-up             # start production stack
make prod-down           # stop production stack
make clean               # destroy containers + volumes (DESTRUCTIVE)
```

## Service Endpoints (local dev)

| Service | URL |
|---------|-----|
| Hasura GraphQL | `http://localhost:8080/v1/graphql` |
| Hasura Console | `http://localhost:8080/console` |
| Auth API | `http://localhost:4000` |
| Storage API | `http://localhost:8484` |
| MinIO Console | `http://localhost:9001` |
| Mailpit UI | `http://localhost:8025` |
| PostgreSQL | `localhost:5432` |

## Database Initialization

On first start, `backend/postgres/init.sql` runs automatically and creates:

- Required extensions (`uuid-ossp`, `pgcrypto`, `citext`)
- Schemas (`auth`, `storage`, `public`)
- Application tables (lists, todos, shares, presence, attachments)
- Indexes for query performance
- Triggers for `updated_at` timestamps
- Auto-profile creation on user signup

If you change `init.sql` after the first run, you must `make clean` and `make up` again, or run the new statements via `make psql`.

## Hasura Console

Visit `http://localhost:8080/console`. Use your `HASURA_GRAPHQL_ADMIN_SECRET` to authenticate.

The console gives you:

- Visual table editor and relationship builder
- GraphQL playground with schema explorer
- Permission manager (per role, per table, per operation)
- Migration tools (track tables, save migrations)
- Metadata management

## App Connection

Client apps (`apps/mobile/`, `apps/desktop/`, `apps/tv/` here, plus `web/ntask/` in the separate `web` repo) read their backend endpoint from environment configuration. For local dev, the defaults match the Docker Compose ports above. Override via the surface's `.env.local` file when running against staging or production.

See [RN-Setup](RN-Setup) (mobile), [Web-SPA](Web-SPA) (web), [Desktop](Desktop) (desktop), [TV](TV) (TV) for per-surface setup guides.

## Alternative for nSelf CLI Users

If you already use the nSelf CLI elsewhere, you can substitute `nself start` against a generated config. The canonical, supported path for this repo, however, is `make up` against the included Compose files, since `task/` is the "any-stack" reference app and does not require the CLI.

## Next Steps

- [Backend Architecture](Backend-Architecture): services, ports, and data flow
- [Database Schema](Database-Schema): table reference
- [Deployment](Deployment): staging and production deploy
- [Features](Features): full app feature inventory

## Need help?

Open an issue at [github.com/nself-org/task/issues](https://github.com/nself-org/task/issues).
