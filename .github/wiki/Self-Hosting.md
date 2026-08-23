# Self-Hosting

How to run your own ɳTasks backend instead of using the hosted [task.nself.org](https://task.nself.org). Once your backend is running, any app surface (web, desktop, mobile, TV) can point at it.

The backend is orchestrated by the [nSelf CLI](https://nself.org). `make up` and the other `make` targets in `backend/Makefile` are thin wrappers around `nself` commands, not hand-written Docker Compose. This keeps the backend consistent with every other nSelf-based project.

## What you get

- **PostgreSQL 16**, the database
- **Hasura GraphQL Engine**, instant GraphQL API and console, the only way apps talk to the database
- **Hasura Auth**, email and password JWT authentication
- **MinIO**, S3-compatible object storage, used for attachments
- **functions**, a small Node.js service handling Hasura Actions and event-trigger webhooks
- **nginx**, reverse proxy for local dev; Traefik with Let's Encrypt handles HTTPS on staging and production

> **Known gap:** the backend config declares a Hasura Storage service, but the nSelf CLI doesn't yet materialize it as its own container. MinIO comes up and handles the actual storage, and file uploads work fine through it via `backend/functions/storage-presign.ts`. `make health` will report Storage as down; this is expected and doesn't block anything.

## Prerequisites

- Docker 20+ with Docker Compose v2
- nSelf CLI v1.2.1+: `brew install nself-org/tap/nself` (macOS), or see [nself.org/install](https://nself.org/install)
- GNU Make
- Free ports: 5432, 8080, 4000, 9000, 9001, 8025

## Setup

### 1. Configure environment

```bash
cd backend
cp .env.example .env
```

### First install: two commands `make up` does not run

`make up` starts the containers and nothing else. Until these run, the database
has no ɳTask tables and Hasura exposes no `np_*` fields at all, which reads as a
broken install rather than two missing commands.

```bash
make migrate                     # postgres/init.sql + the migrations
make metadata-reconcile APPLY=1  # track tables, permissions, cron + event triggers, actions
make metadata-diff               # confirm the environment matches the repo
```

Both are idempotent, so re-running them on an existing install is a no-op. The
first reconcile tracks 26 tables and applies several hundred permissions and can
take a few minutes.

Do NOT use `hasura metadata apply`. It replaces the entire metadata document, and
this repo does not declare the eight tables hasura-auth owns, so a replace
untracks them and breaks MFA, OAuth logins and role lookups.

At minimum, change these before using the stack for anything beyond local dev:

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Postgres password |
| `HASURA_ADMIN_SECRET` | Admin secret for the Hasura CLI-templated config |
| `HASURA_GRAPHQL_ADMIN_SECRET` | The app-read runtime equivalent, keep this in sync with the one above |
| `AUTH_JWT_SECRET` | 64+ characters, `openssl rand -hex 64` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Change from the published defaults (`minioaccesskey` / `miniosecretkey`) |
| `REDIS_PASSWORD` | `openssl rand -hex 32` |

OAuth provider secrets (Google, GitHub, etc.) are optional, only needed if you want social login.

### 2. Build and start

```bash
nself build       # generates docker-compose.yml, nginx config, SSL certs. Run once, or after config changes.
make up            # alias for `nself start`
```

`make up` also auto-runs a seed script on local and staging environments (never on production), creating eight test accounts (`owner@`, `admin@`, `mod@`, `dev@`, `support@`, `user@`, `demo@`, `test@nself.org`, all password `password`) plus sample lists and todos.

### 3. Verify

```bash
make health
```

Postgres, Hasura, and Auth should report OK. Storage will report DOWN, see the known gap above. `nginx`/`functions` may show unhealthy on a backend-only checkout because the default vhost proxies to the `web/` Vite dev server, which a backend-only checkout doesn't start.

### 4. Apply migrations

```bash
make migrate          # applies pending postgres/migrations/*.sql
make migrate-status    # shows which migrations have been applied
```

If the nSelf CLI's migration runner isn't available, `make db-migrate` is a no-CLI fallback that runs the same SQL through a raw psql script.

### 5. Apply Hasura metadata

```bash
make metadata-apply
```

Applies tracked tables, relationships, permissions, and remote schemas from `backend/hasura/metadata/`. Requires the Hasura CLI on your machine. `make metadata-export` writes the current metadata back out if you've made changes in the console.

### 6. Optional: load curated demo data

```bash
DEMO_SEED=1 make demo-seed
```

Loads a separate demo dataset under `demo@example.com` / `DemoPass123!`. This is distinct from the dev accounts `make up` already seeds.

## Everyday commands

```bash
make up                  # start the stack
make down                # stop the stack
make restart             # down + up
make logs                # tail logs from all services
make logs-hasura         # Hasura logs only
make logs-auth           # Auth logs only
make status              # deployment status
make health              # health check (falls back to raw curl/pg_isready if the CLI is unavailable)
make health-raw           # raw curl/pg_isready checks, no CLI dependency
make psql                 # open a Postgres shell
make console              # open the Hasura console (requires the Hasura CLI)
```

## Backups

```bash
make backup                          # dump Postgres to ./backups/backup-<timestamp>.sql
make restore FILE=backups/backup-xxx.sql   # restore from a local backup file
make backup-remote                   # stream a pg_dump to Cloudflare R2 (needs BACKUP_* env vars in .env)
make restore-remote FILE=ntask/backup-xxx.sql.gz   # restore from an R2 backup
make list-backups                    # list the 20 most recent R2 backups
make dr-test                         # non-destructive disaster-recovery drill: restores the latest backup to a scratch DB and verifies it
```

## Staging and production

```bash
make staging-up      # start the staging stack (raw docker compose fallback)
make staging-down
make staging-logs
make prod-up          # start the production stack (raw docker compose fallback)
make prod-down
make prod-logs
```

## Upgrading

```bash
make upgrade    # backup -> pull -> rebuild -> migrate -> health, in that order
```

## Cleaning up

```bash
make clean    # DESTRUCTIVE: removes all containers and volumes, deletes all data
```

## Service endpoints (local dev)

| Service | URL |
|---|---|
| Hasura GraphQL | `http://localhost:8080/v1/graphql` |
| Hasura Console | `http://localhost:8080/console` |
| Auth API | `http://localhost:4000` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| Mailpit UI | `http://localhost:8025` |
| PostgreSQL | `localhost:5432` |

## Connecting an app to your backend

Every app surface reads its backend endpoint from its own `.env.local`, using the platform's env-var prefix (`EXPO_PUBLIC_*` for mobile and TV, `VITE_*` for web and desktop, since desktop embeds the built Vite frontend). Point these at your self-hosted backend instead of `localhost` if you're running it elsewhere:

```bash
EXPO_PUBLIC_HASURA_URL=https://your-backend.example.com/v1/graphql
EXPO_PUBLIC_AUTH_URL=https://your-backend.example.com/auth
```

See [[Apps]] for per-surface setup, or [[RN-Setup]], [[Web-SPA]], [[Desktop]], [[TV]] for full detail.

## Next steps

- [[Backend-Architecture]]: services, ports, and data flow in depth
- [[Database-Schema]]: table reference
- [[Deployment]]: staging and production deploy walkthrough
- [[Backend-Troubleshooting]]: fixes for common backend issues
- [[Security]]: security practices

## Need help?

Open an issue at [github.com/nself-org/ntask/issues](https://github.com/nself-org/ntask/issues).
