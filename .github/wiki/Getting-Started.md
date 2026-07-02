# Getting Started — ɳTasks

Get ɳTasks running on your machine in minutes. ɳTasks is a multi-surface app: React Native + Expo (mobile), React 19 + Vite SPA (web, built in the separate `web/ntask` repo), a shipped Tauri 2 desktop shell, and a scaffolded rn-tvos TV surface.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 10+ | `npm install -g pnpm` |
| Expo CLI | Latest | `pnpm add -g expo-cli` |
| EAS CLI | Latest | `pnpm add -g eas-cli` |
| Docker Desktop | 20+ | [docker.com](https://docker.com) |
| nSelf CLI | Latest | `brew install nself-org/tap/nself` |
| Make | — | macOS: `xcode-select --install` |

Optional for mobile:
- **Xcode** — iOS simulator (macOS only)
- **Android Studio** — Android emulator

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/nself-org/ntask.git
cd ntask
```

### 2. Start the Backend

The backend stack runs locally via Docker (managed by nSelf CLI):

```bash
cd backend
cp .env.example .env.dev     # Edit passwords for any non-local environment
nself build                  # Generate docker-compose.yml (first time only)
make up                      # Start Postgres, Hasura, Auth, Storage, MinIO, Mailpit
make health                  # Verify all services are up
```

Backend services:

| Service | Local URL |
|---|---|
| GraphQL API | http://localhost:8080/v1/graphql |
| Hasura Console | http://localhost:8080/console |
| Auth API | http://localhost:4000 |
| Storage API | http://localhost:8484 |
| MinIO Console | http://localhost:9001 |
| Mailpit (email) | http://localhost:8025 |

### 3. Run the Mobile App

```bash
cd apps/mobile
cp .env.example .env.local
pnpm install
pnpm start          # Expo dev server
```

Press `i` for iOS simulator, `a` for Android emulator.

Environment (`apps/mobile/.env.local`):

```bash
EXPO_PUBLIC_HASURA_URL=http://localhost:8080/v1/graphql
EXPO_PUBLIC_HASURA_WS_URL=ws://localhost:8080/v1/graphql
EXPO_PUBLIC_AUTH_URL=http://localhost:4000
EXPO_PUBLIC_STORAGE_URL=http://localhost:8484
```

See [[RN-Setup]] for the full React Native setup guide.

### 4. Run the Web SaaS

The web SaaS lives in a separate repo (`web/ntask/` in the `nself-org/web` monorepo), not in `ntask`:

```bash
git clone https://github.com/nself-org/web.git
cd web/ntask
cp .env.example .env.local
pnpm install
pnpm dev            # http://localhost:5173
```

Environment (`web/ntask/.env.local`):

```bash
VITE_HASURA_URL=http://localhost:8080/v1/graphql
VITE_HASURA_WS_URL=ws://localhost:8080/v1/graphql
VITE_AUTH_URL=http://localhost:4000
VITE_STORAGE_URL=http://localhost:8484
```

See [[Web-SPA]] for the full Vite web SaaS setup guide.

---

## First Steps

### 1. Create an Account

- **Mobile:** tap the Register button in the app.
- **Web:** navigate to http://localhost:5173/register.

Emails are caught locally by Mailpit at http://localhost:8025.

### 2. Explore the App

After signing in:
- **Today** — tasks due today
- **Overdue** — past-due tasks
- **Calendar** — date-based view
- **Notifications** — task activity feed
- **List detail** — tap any list to see tasks; create/edit/complete tasks; share lists

### 3. Explore the GraphQL API

Open http://localhost:8080/console → **API** tab:

```graphql
query MyLists {
  np_lists {
    id
    name
    np_todos {
      id
      title
      completed
      due_date
    }
  }
}
```

Schema prefix: `np_*`. Tables: `np_lists`, `np_todos`, `np_shares`, `np_attachments`, `np_comments`, `np_subtasks`, `np_presence`.

---

## Project Structure

```
ntask/
├── apps/
│   ├── mobile/       # React Native + Expo (iOS, Android)
│   ├── desktop/      # Tauri 2 shell wrapping web/ntask (Shipped)
│   └── tv/           # rn-tvos (Scaffolded)
├── backend/
│   ├── hasura/       # GraphQL metadata + migrations
│   ├── nginx/        # Reverse proxy config
│   └── postgres/     # Init scripts + migrations (np_* schema)
├── cli/              # ntask terminal CLI
├── mcp/              # MCP server for AI agents
└── .github/
    ├── wiki/         # This documentation
    └── workflows/    # CI/CD
```

The web SaaS (`task.nself.org`) is built in a separate repo: `web/ntask/` in `nself-org/web`, not in this repo.

---

## Stop the Backend

```bash
cd backend && make down
```

---

## Common Issues

| Symptom | Fix |
|---|---|
| `make up` hangs | Run `make down` first, then `make up` |
| Port 8080/4000/8484 in use | Stop conflicting service or edit `backend/.env.dev` ports |
| `nself build` not found | Install nSelf CLI: `brew install nself-org/tap/nself` |
| Expo metro bundler error | Delete `apps/mobile/.expo/` and restart |
| Vite dev server can't connect | Verify `web/ntask/.env.local` env vars are set (separate repo) |

See [Backend-Troubleshooting](Backend-Troubleshooting) for more.

---

**Next:** [[Backend-Setup]] | [[RN-Setup]] | [[Web-SPA]] | [[Features]]
