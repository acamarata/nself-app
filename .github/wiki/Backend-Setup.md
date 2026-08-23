# Backend Setup

Step-by-step setup for the ɳTasks backend. The backend is an nSelf CLI–orchestrated stack
(Postgres, Hasura GraphQL, Hasura Auth, MinIO, functions, nginx) driven by `backend/nself.yaml`
and a thin `Makefile` wrapper. Per the nSelf-First doctrine, all lifecycle operations route
through the `nself` CLI — `make up`/`make down`/`make build` are aliases for
`nself start`/`nself stop`/`nself build`, not hand-rolled Docker Compose.

## Prerequisites

- Docker 20+ with Docker Compose v2
- nSelf CLI v1.2.1+: `brew install nself-org/tap/nself` (macOS) or see [nself.org/install](https://nself.org/install)
- GNU Make
- Free ports: 5432, 8080, 4000, 8484 (reserved — see Known Gaps below), 9000, 9001, 8025

## What You Get

- **PostgreSQL 16**: database
- **Hasura GraphQL Engine**: instant GraphQL API + console
- **Hasura Auth**: email + password JWT authentication
- **MinIO**: S3-compatible object storage backend
- **functions**: Hasura Action + event-trigger webhook handler (Node.js)
- **nginx**: reverse proxy (dev profile); Traefik HTTPS for staging/production
- **Mailhog**: dev email capture (UI at `http://localhost:8025`)

> **Storage requires `MINIO_ENABLED=true`.** The generator gates the whole MinIO
> service on that one variable, and it is **not** implied by the other `MINIO_*`
> values. Without it `nself build` emits no object store at all, `getUploadUrl`
> has nothing to sign against, and file attachments silently do not work. It is
> set in `.env.example`; if you wrote your own `.env`, add it.
>
> **Known gap:** `backend/nself.yaml` also declares a Hasura Storage service, which
> the CLI does not materialize as a container. That one is not needed — file uploads
> go through `backend/functions/storage-presign.ts`, which talks to MinIO directly.
> Tracked in `.claude/planning/nself-cli-gaps-from-ntask-dogfood.md` gap #8.

## Steps

### 1. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set, at minimum:
- `POSTGRES_PASSWORD`: strong password for Postgres
- `HASURA_ADMIN_SECRET` (CLI-templated) / `HASURA_GRAPHQL_ADMIN_SECRET` (app-read runtime var — keep both in sync, see the naming-drift note in `.env.example`)
- `AUTH_JWT_SECRET`: 64+ chars, `openssl rand -hex 64`
- Auth provider secrets (Google, GitHub, etc.) if you want OAuth — optional

### 2. Build and start the stack

```bash
nself build       # generates docker-compose.yml, nginx config, SSL certs (run once, or after nself.yaml changes)
make up           # alias for `nself start`; also auto-runs scripts/seed-dev.sh (dev/staging only)
```

`make up` brings up Postgres, Hasura, Auth, MinIO, functions, and nginx, then automatically
seeds 8 test accounts (`owner@`/`admin@`/`mod@`/`dev@`/`support@`/`user@`/`demo@`/`test@nself.org`,
all password `password`) plus sample lists/todos — this is guarded to never run against
production. See [[Getting-Started]] for the separate `DEMO_SEED=1 make demo-seed` curated dataset.

### 3. Verify health

```bash
make health
```

Runs `nself deploy health` (falls back to raw curl/pg_isready checks). Postgres, Hasura, and
Auth should report OK. The Hasura Storage *service* reports DOWN — see the Known Gap
above; this does not block app functionality, because uploads use MinIO directly. If
MinIO itself is missing, `MINIO_ENABLED` is unset. `nginx`/`functions` may show unhealthy on a backend-only checkout
because the default vhost proxies to the `web/` Vite dev server in this repo.

### 4. Apply Hasura migrations

```bash
make db-migrate        # idempotent psql runner: postgres/init.sql + postgres/migrations/*.sql
make migrate-status     # show which migrations have been applied
```

### 5. Apply Hasura metadata

```bash
make metadata-apply
```

Applies tracked tables, relationships, permissions, and remote schemas from `hasura/metadata/`
(requires the Hasura CLI on your host).

### 6. (Optional) Seed additional demo data

```bash
DEMO_SEED=1 make demo-seed      # loads example tasks/lists under demo@example.com / DemoPass123!
```

## Useful Commands

```bash
make up                  # start the stack (nself start + auto dev-seed)
make down                # stop the stack (nself stop)
make restart             # restart everything
make logs                # tail logs from all services
make logs-hasura         # tail Hasura logs only
make logs-auth           # tail Auth logs only
make status              # nself deploy status (falls back to docker compose ps)
make health              # nself deploy health (falls back to raw curl checks)
make health-raw          # raw curl/pg_isready checks, no CLI dependency
make psql                # open a Postgres shell
make console             # open Hasura console (requires hasura-cli on host)
make db-migrate          # apply postgres/init.sql + postgres/migrations/*.sql
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
| MinIO (object storage) | `http://localhost:9000` (API), `http://localhost:9001` (console) |
| Mailhog UI | `http://localhost:8025` |
| PostgreSQL | `localhost:5432` |

## Database Initialization

On first start, `backend/postgres/init.sql` and `backend/postgres/migrations/*.sql` run via
`make db-migrate` and create:

- Required extensions (`uuid-ossp`, `pgcrypto`, `citext`)
- Schemas (`auth`, `storage`, `public`)
- Application tables (`np_*` prefix: lists, todos, shares, presence, attachments)
- Indexes for query performance
- Triggers for `updated_at` timestamps
- Auto-profile creation on user signup

If you change migrations after the first run, add a new migration file rather than editing
history — see [[Database-Schema]].

## Hasura Console

Visit `http://localhost:8080/console`. Use your `HASURA_ADMIN_SECRET` to authenticate.

The console gives you:

- Visual table editor and relationship builder
- GraphQL playground with schema explorer
- Permission manager (per role, per table, per operation)
- Migration tools (track tables, save migrations)
- Metadata management

## App Connection

Client apps (`apps/mobile/`, `apps/desktop/`, `apps/tv/`, `web/` — all in this
`web` repo) read their backend endpoint from environment configuration. For local dev, the
defaults match the endpoints above. Override via the surface's `.env.local` file when running
against staging or production.

See [[RN-Setup]] (mobile), [[Web-SPA]] (web), [[Desktop]] (desktop), [[TV]] (TV) for per-surface
setup guides.

## Next Steps

- [[Backend-Architecture]]: services, ports, and data flow
- [[Database-Schema]]: table reference
- [[Deployment]]: staging and production deploy
- [[Features]]: full app feature inventory

## Need help?

Open an issue at [github.com/nself-org/ntask/issues](https://github.com/nself-org/ntask/issues).
