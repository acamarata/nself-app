# ɳTasks Quickstart Guide

Get ɳTasks running locally in under 10 minutes.

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 10+ | `npm install -g pnpm` |
| Expo CLI | Latest | `pnpm add -g expo-cli` |
| Docker | 20+ | [docker.com](https://docker.com) |
| Make | — | macOS: `xcode-select --install` |

## 1. Clone the Repo

```bash
git clone https://github.com/nself-org/ntask.git
cd ntask
```

## 2. Start the Backend

```bash
cd backend
cp .env.example .env.dev     # Edit passwords for any non-local environment
nself build                  # Generate docker-compose.yml (first time only)
make up                      # Start Postgres, Hasura, Auth, Storage, MinIO, Mailpit
make health                  # Verify all services are up
```

Services:

| Service | Local URL |
|---|---|
| Hasura Console | http://localhost:8080/console |
| GraphQL API | http://localhost:8080/v1/graphql |
| Auth | http://localhost:4000 |
| Storage | http://localhost:8484 |
| MinIO Console | http://localhost:9001 |
| Mailpit (email) | http://localhost:8025 |

## 3. Run the Mobile App (Expo)

```bash
cd apps/mobile
cp .env.example .env.local   # Points to local backend by default
pnpm install
pnpm start                   # Expo dev server
```

Then press `i` for iOS simulator or `a` for Android emulator.

Environment variables (`apps/mobile/.env.local`):

```bash
EXPO_PUBLIC_HASURA_URL=http://localhost:8080/v1/graphql
EXPO_PUBLIC_HASURA_WS_URL=ws://localhost:8080/v1/graphql
EXPO_PUBLIC_AUTH_URL=http://localhost:4000
EXPO_PUBLIC_STORAGE_URL=http://localhost:8484
```

## 4. Run the Web SaaS (Vite)

The web SaaS lives in a separate repo (`web/ntask/` in `nself-org/web`), not in `ntask`:

```bash
git clone https://github.com/nself-org/web.git
cd web/ntask
cp .env.example .env.local
pnpm install
pnpm dev                     # http://localhost:5173
```

Environment variables (`web/ntask/.env.local`):

```bash
VITE_HASURA_URL=http://localhost:8080/v1/graphql
VITE_HASURA_WS_URL=ws://localhost:8080/v1/graphql
VITE_AUTH_URL=http://localhost:4000
VITE_STORAGE_URL=http://localhost:8484
```

## First Steps

### Sign Up and Sign In

1. Navigate to http://localhost:5173/register (web) or tap Register in the mobile app.
2. Create an account — email is handled by nSelf Auth (Mailpit catches emails locally at http://localhost:8025).
3. Sign in and explore Today / Overdue / Calendar views.

### Explore the GraphQL API

All data goes through Hasura. Open http://localhost:8080/console, navigate to the **API** tab, and try:

```graphql
query MyLists {
  np_lists {
    id
    name
    np_todos {
      id
      title
      completed
    }
  }
}
```

Schema prefix: `np_*`. All tables are in the `np_*` namespace (per ADR P0-3).

## Stop the Backend

```bash
cd backend && make down
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `make up` fails | Check Docker is running and ports 8080/4000/8484/9001 are free |
| `nself build` not found | Install nSelf CLI: `brew install nself-org/tap/nself` |
| Expo app can't connect | Verify `.env.local` env vars point to correct local URLs |
| Auth token errors | Run `make down && make up` to reset auth service state |
| GraphQL errors | Check `http://localhost:8080/console` for schema/permission issues |
| `make health` reports Storage: DOWN | Known gap — the generated stack does not currently materialize a Hasura Storage container at `:8484`; MinIO itself (object storage backend) is up and file uploads work via `storage-presign.ts`. Tracked in `.claude/planning/nself-cli-gaps-from-ntask-dogfood.md` (gap #8). |
| `nginx`/`functions` show unhealthy after `make up` | Expected for a backend-only checkout — the default nginx vhost proxies to the `web/ntask` Vite dev server, which lives in a separate repo and isn't started by this backend. Not a broken install. |

## Next Steps

- [[RN-Setup]] — full React Native + Expo setup
- [[Web-SPA]] — full Vite web SaaS setup
- [[Backend-Setup]] — full backend setup
- [[API-Reference]] — GraphQL API reference
- [[Features]] — full feature list
