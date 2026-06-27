# nSelf Backend

**Self-hosted backend stack: PostgreSQL + Hasura + Auth + Storage**

This directory contains everything needed to run a complete backend for your application. One command starts the entire stack locally. Two more commands deploy it to staging or production with automatic HTTPS.

---

## Table of Contents

1. [What's Inside](#whats-inside)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Architecture](#architecture)
5. [Services Reference](#services-reference)
6. [Configuration](#configuration)
7. [Database](#database)
8. [Authentication](#authentication)
9. [File Storage](#file-storage)
10. [GraphQL API](#graphql-api)
11. [Deployment](#deployment)
12. [Operations](#operations)
13. [Troubleshooting](#troubleshooting)

---

## What's Inside

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| PostgreSQL 16 | `postgres:16-alpine` | 5432 | Relational database |
| Hasura GraphQL Engine | `hasura/graphql-engine:v2.42.0` | 8080 | GraphQL API + Console |
| Hasura Auth | `nhost/hasura-auth:0.32.1` | 4000 | Authentication (email, OAuth) |
| Hasura Storage | `nhost/hasura-storage:0.6.1` | 8484 | S3-compatible file storage |
| MinIO | `minio/minio` | 9000/9001 | Object storage (S3-compatible) |
| Mailhog | `mailhog/mailhog` | 1025/8025 | Local email testing (dev only) |
| Traefik | `traefik:v3.0` | 80/443 | Reverse proxy + HTTPS (staging/prod) |

---

## Prerequisites

### Local Development

- **Docker** (Docker Desktop or Docker Engine + Compose v2)
  - macOS: `brew install --cask docker`
  - Ubuntu: `sudo apt install docker.io docker-compose-v2`
  - Windows: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Make** (usually pre-installed on macOS/Linux)
  - Windows: Install via `choco install make` or use WSL

### Optional (for advanced usage)

- **Hasura CLI** for migrations and metadata management
  ```bash
  curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | bash
  ```
- **psql** for direct PostgreSQL access
  ```bash
  # macOS
  brew install libpq && brew link --force libpq
  # Ubuntu
  sudo apt install postgresql-client
  ```

---

## Quick Start

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create your environment file
cp backend/.env.example backend/.env.dev
# Edit .env -- at minimum, change passwords for non-local environments

# 3. Start the stack
make up

# 4. Verify everything is running
make health
```

That's it. Your backend is running:

| Service | URL |
|---------|-----|
| GraphQL API | http://localhost:8080/v1/graphql |
| Hasura Console | http://localhost:8080/console |
| Auth API | http://localhost:4000 |
| Storage API | http://localhost:8484 |
| MinIO Console | http://localhost:9001 |
| Mailhog UI | http://localhost:8025 |

---

## App Surfaces

The backend is consumed by multiple clients. All clients are configured via
the server URL set at first login — no hardcoded IPs in source.

| Surface | Location | Start command |
|---|---|---|
| Mobile (iOS/Android) | `apps/mobile/` | `make mobile-start` (from repo root) |
| Web SaaS | `task.nself.org` | Vercel-hosted; see `web/ntask/` |
| Desktop (planned) | — | Tauri 2 wrapping web app (future) |

---

## Bundle Configuration

`backend/nself.yaml` is the canonical plugin manifest for this app.
Edit it to add or remove plugins, then run `nself build` to apply changes.

Active free plugins: auth, storage, cron, notify, notifications, jobs,
search, feature-flags, audit-log, webhooks, invitations, tokens.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│           App Surfaces (iOS/Android via Expo / Web)           │
│           Backend URL configured at login (no hardcoded IPs)  │
└───────────┬──────────────┬───────────────┬───────────────────┘
            │              │               │
            ▼              ▼               ▼
┌───────────────┐ ┌──────────────┐ ┌──────────────┐
│ Hasura GraphQL│ │  Hasura Auth  │ │Hasura Storage│
│   :8080       │ │   :4000       │ │   :8484      │
│               │ │               │ │              │
│ - GraphQL API │ │ - Sign up     │ │ - Upload     │
│ - Subscriptions│ │ - Sign in    │ │ - Download   │
│ - Permissions │ │ - JWT tokens  │ │ - List       │
│ - Console     │ │ - OAuth       │ │ - Delete     │
└───────┬───────┘ └──────┬───────┘ └──────┬───────┘
        │                │                │
        ▼                ▼                ▼
┌──────────────────────────────────────────────────┐
│                  PostgreSQL :5432                  │
│                                                    │
│  public schema    │  auth schema   │  storage      │
│  (your tables)    │  (users, etc.) │  schema       │
└──────────────────────────────────────────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  MinIO :9000  │
                                   │  (S3 storage) │
                                   └──────────────┘
```

**Data flow:**
1. Frontend makes GraphQL queries/mutations via Hasura
2. Hasura enforces row-level permissions based on JWT claims
3. Auth service handles signup/signin and issues JWTs
4. Storage service handles file uploads, backed by MinIO (S3-compatible)
5. All services share the same PostgreSQL database

---

## Services Reference

### PostgreSQL

The database. All other services connect to it.

**Connection string:** `postgres://postgres:postgres@localhost:5432/nself`

**Key files:**
- `postgres/init.sql` -- Creates schemas, tables, triggers, and indexes on first boot

**Accessing directly:**
```bash
make psql                          # Interactive shell
# Or with psql client:
psql postgres://postgres:postgres@localhost:5432/nself
```

### Hasura GraphQL Engine

Instant GraphQL API over PostgreSQL. Auto-generates queries, mutations, and subscriptions for every tracked table.

**Console:** http://localhost:8080/console (admin secret: `nself-admin-secret`)

**GraphQL endpoint:** http://localhost:8080/v1/graphql

**Key concepts:**
- **Tracked tables**: Tables Hasura knows about and exposes via GraphQL
- **Permissions**: Row-level security configured per role (user, admin, public)
- **Relationships**: Foreign key relationships auto-detected or manually configured
- **Actions**: Custom business logic endpoints
- **Event triggers**: Webhooks fired on database events

**Managing with CLI:**
```bash
cd hasura
hasura console --admin-secret nself-admin-secret   # Opens console with migration tracking
hasura migrate create my_change --database-name default
hasura migrate apply --database-name default
hasura metadata apply
hasura metadata export
```

### Hasura Auth

Authentication service. Handles user registration, login, JWT token management, password reset, and OAuth.

**API:** http://localhost:4000

**Key endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/signup/email-password` | Register new user |
| POST | `/signin/email-password` | Login |
| POST | `/signout` | Logout |
| POST | `/token` | Refresh access token |
| POST | `/user/password/reset` | Request password reset |
| POST | `/user/password` | Change password |
| GET | `/healthz` | Health check |

**JWT claims added to every request:**
```json
{
  "x-hasura-user-id": "uuid",
  "x-hasura-default-role": "user",
  "x-hasura-allowed-roles": ["user", "me"]
}
```

### Hasura Storage

S3-compatible file storage with built-in authorization. Files are stored in MinIO and metadata tracked in PostgreSQL.

**API:** http://localhost:8484

**Key endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/files` | Upload a file |
| GET | `/files/:id` | Download a file |
| DELETE | `/files/:id` | Delete a file |
| GET | `/files` | List files |
| GET | `/healthz` | Health check |

### MinIO

S3-compatible object storage. Stores the actual file bytes. Hasura Storage manages the metadata and authorization layer on top.

**Console:** http://localhost:9001
- Username: `minioaccesskey` (from `.env`)
- Password: `miniosecretkey` (from `.env`)

### Mailhog (Development Only)

Catches all outgoing emails so you can test email verification, password reset, etc. without sending real emails.

**UI:** http://localhost:8025

Mailhog is only started when using the `dev` profile (`make up` enables it by default).

---

## Configuration

### Environment Variables

All configuration is done through the `.env` file. Copy the example and customize:

```bash
cp backend/.env.example backend/.env.dev
```

#### Critical Security Settings

**Change these before any non-local deployment:**

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `HASURA_ADMIN_SECRET` | `nself-admin-secret` | Hasura admin access key |
| `AUTH_JWT_SECRET` | `0123456...` | JWT signing key (64+ chars) |
| `S3_ACCESS_KEY` | `minioaccesskey` | MinIO access key |
| `S3_SECRET_KEY` | `miniosecretkey` | MinIO secret key |

**Generate strong secrets:**
```bash
# Generate a random 64-character hex string for JWT secret
openssl rand -hex 32

# Generate a random password
openssl rand -base64 24
```

#### SMTP Configuration

For local development, Mailhog catches all emails. For staging/production, configure a real SMTP provider:

| Provider | SMTP Host | Port | Secure |
|----------|-----------|------|--------|
| Resend | `smtp.resend.com` | 465 | true |
| Postmark | `smtp.postmarkapp.com` | 587 | true |
| SendGrid | `smtp.sendgrid.net` | 587 | true |
| AWS SES | `email-smtp.{region}.amazonaws.com` | 587 | true |
| Gmail | `smtp.gmail.com` | 587 | true |

```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxx
SMTP_SENDER=no-reply@yourdomain.com
SMTP_SECURE=true
```

---

## Database

### Initial Schema

The `postgres/init.sql` file creates the initial database schema on first boot:

- **`auth` schema** -- Reserved for Hasura Auth (created automatically)
- **`storage` schema** -- Reserved for Hasura Storage (created automatically)
- **`public.profiles`** -- User profile data (extends auth.users)
- **`public.todos`** -- Example feature table

### Adding Tables

**Option 1: Edit `init.sql` (before first boot)**

Add your tables to `postgres/init.sql`. This runs once when PostgreSQL first starts.

**Option 2: Hasura Console (interactive)**

1. Open http://localhost:8080/console
2. Go to Data > SQL
3. Write your CREATE TABLE statement
4. Track the table to expose it via GraphQL
5. Configure permissions for each role

**Option 3: Hasura Migrations (recommended for teams)**

```bash
cd hasura

# Create a new migration
hasura migrate create add_products_table --database-name default

# Edit the migration file in migrations/default/{timestamp}_add_products_table/up.sql
# Then apply:
hasura migrate apply --database-name default

# Track the table and configure permissions
hasura metadata apply
```

### Permissions

Permissions are configured per table, per role, per operation (select/insert/update/delete).

The permission system uses JWT claims. When a user is authenticated, their JWT contains:
- `x-hasura-user-id` -- The user's UUID
- `x-hasura-default-role` -- Usually `user`

**Example: Users can only see their own todos:**

In `hasura/metadata/databases/default/tables/tables.yaml`:
```yaml
- table:
    schema: public
    name: todos
  select_permissions:
    - role: user
      permission:
        columns: [id, title, description, completed, created_at]
        filter:
          user_id:
            _eq: X-Hasura-User-Id
```

Or via the Hasura Console: Data > todos > Permissions > user > select > set filter.

### Backups

**Manual backup:**
```bash
make backup    # Creates backup in ./backups/backup-{timestamp}.sql
```

**Restore from backup:**
```bash
make restore FILE=backups/backup-20260208-120000.sql
```

**Automated backups (production):**
The production Docker Compose includes a `pg-backup` service that creates daily backups, keeping:
- 7 daily backups
- 4 weekly backups
- 6 monthly backups

---

## Authentication

### Supported Methods

| Method | Default | Configuration |
|--------|---------|---------------|
| Email + Password | Enabled | Always available |
| Magic Link (passwordless) | Disabled | Set `AUTH_EMAIL_PASSWORDLESS_ENABLED=true` |
| Google OAuth | Disabled | Set `AUTH_PROVIDER_GOOGLE_*` variables |
| GitHub OAuth | Disabled | Set `AUTH_PROVIDER_GITHUB_*` variables |
| Apple Sign In | Disabled | Set `AUTH_PROVIDER_APPLE_*` variables |
| Anonymous | Disabled | Set `AUTH_ANONYMOUS_USERS_ENABLED=true` |

### Email Verification

By default, email verification is **disabled** for faster development. Enable it for production:

```bash
AUTH_REQUIRE_EMAIL_VERIFICATION=true
```

When enabled, users must verify their email before they can sign in. The verification email is sent automatically.

### OAuth Setup

To enable Google OAuth:

1. Create credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add to `.env`:
   ```bash
   AUTH_PROVIDER_GOOGLE_ENABLED=true
   AUTH_PROVIDER_GOOGLE_CLIENT_ID=your-client-id
   AUTH_PROVIDER_GOOGLE_CLIENT_SECRET=your-client-secret
   ```
3. Set the redirect URI in Google Console to: `{AUTH_SERVER_URL}/signin/provider/google/callback`

Same pattern applies for GitHub, Apple, etc.

---

## File Storage

### Creating Buckets

MinIO buckets are created automatically by the `minio-init` service. The default bucket is `nhost`.

To add custom buckets, edit the `minio-init` entrypoint in `docker-compose.yml`:

```yaml
minio-init:
  entrypoint: >
    /bin/sh -c "
    mc alias set myminio http://minio:9000 $${S3_ACCESS_KEY} $${S3_SECRET_KEY};
    mc mb --ignore-existing myminio/nhost;
    mc mb --ignore-existing myminio/avatars;
    mc mb --ignore-existing myminio/documents;
    mc anonymous set download myminio/nhost/public;
    exit 0;
    "
```

### Upload via Storage API

```bash
curl -X POST http://localhost:8484/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@photo.jpg" \
  -F "bucket-id=nhost"
```

### Public vs Private Files

Files uploaded to a path starting with `public/` are publicly accessible. All other files require authentication.

---

## GraphQL API

### Queries

```graphql
# Fetch user's todos
query GetTodos {
  todos(order_by: {created_at: desc}) {
    id
    title
    description
    completed
    created_at
  }
}
```

### Mutations

```graphql
# Create a todo
mutation CreateTodo($title: String!, $description: String) {
  insert_todos_one(object: {title: $title, description: $description}) {
    id
    title
  }
}
```

### Subscriptions (Realtime)

```graphql
# Live updates on todos
subscription WatchTodos {
  todos(order_by: {created_at: desc}) {
    id
    title
    completed
  }
}
```

### Testing in Console

1. Open http://localhost:8080/console
2. Go to API tab
3. Add header: `x-hasura-admin-secret: nself-admin-secret`
4. Write and execute GraphQL queries

---

## Deployment

### Local Development

```bash
make up        # Starts all services with Mailhog
make logs      # Follow logs
make down      # Stop everything
```

### Staging

Prerequisites:
- VPS with Docker (4+ GB RAM)
- DNS A records for your subdomains
- Ports 80 and 443 open

```bash
# On your VPS:
git clone your-repo
cd your-repo/backend
cp backend/.env.example backend/.env.dev

# Edit .env:
# - Set DOMAIN=yourdomain.com
# - Set ACME_EMAIL=admin@yourdomain.com
# - Change ALL passwords and secrets
# - Configure real SMTP

make staging-up
```

Traefik automatically provisions Let's Encrypt SSL certificates.

### Production

Same as staging, plus:
- Automated daily database backups
- Resource limits on containers
- Reduced logging
- No Hasura Console access

```bash
make prod-up
```

### DNS Records Required

| Subdomain | Type | Value |
|-----------|------|-------|
| `api.yourdomain.com` | A | VPS IP address |
| `auth.yourdomain.com` | A | VPS IP address |
| `storage.yourdomain.com` | A | VPS IP address |

For staging, use `api.staging.yourdomain.com`, etc.

---

## Operations

### Monitoring Health

```bash
make health    # Pings all service health endpoints
make status    # Shows Docker container status
make logs      # Follow all logs
```

### Updating Services

```bash
# Pull latest images
docker compose pull

# Restart with new images
make restart
```

### Scaling

For production, consider:
- **PostgreSQL**: Use managed PostgreSQL (AWS RDS, DigitalOcean, etc.) instead of Docker
- **MinIO**: Use AWS S3 or DigitalOcean Spaces instead of self-hosted MinIO
- **Hasura**: Can handle thousands of concurrent connections; add memory if needed

### Resetting (Development Only)

```bash
make clean     # WARNING: Deletes ALL data!
make up        # Fresh start
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check what's running
make status

# View logs for a specific service
docker compose logs graphql-engine
docker compose logs auth
docker compose logs postgres

# Common issue: port conflicts
# Check if something else is using port 8080:
lsof -i :8080
```

### Hasura Can't Connect to PostgreSQL

```bash
# Wait for PostgreSQL to be ready
docker compose logs postgres | grep "ready to accept connections"

# Restart Hasura
docker compose restart graphql-engine
```

### Auth Service Errors

```bash
# Check auth logs
docker compose logs auth

# Common issues:
# - JWT secret mismatch between Hasura and Auth
# - PostgreSQL not ready yet
# - Missing required tables (auth schema)
```

### Permission Denied on GraphQL Queries

1. Check your JWT token is valid (decode at jwt.io)
2. Verify the `x-hasura-user-id` claim matches the data owner
3. Check permissions in Hasura Console > Data > Table > Permissions
4. Make sure the table is tracked in Hasura

### Storage Upload Fails

```bash
# Check MinIO is running
curl http://localhost:9000/minio/health/live

# Check storage logs
docker compose logs storage

# Verify bucket exists
docker compose exec minio mc ls myminio/
```

### Mailhog Not Receiving Emails

Mailhog only runs with the `dev` profile. Make sure you're using `make up` (which includes `--profile dev`).

```bash
# Check Mailhog is running
docker compose ps mailhog

# View Mailhog UI
open http://localhost:8025
```
