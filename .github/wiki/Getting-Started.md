# Getting Started

There are two ways to get going with ɳTasks. Pick one.

## Path A: use the hosted version

Go to [task.nself.org](https://task.nself.org), create an account, and start using it. Nothing to install, nothing to run. This is the fastest path if you just want a task manager.

Skip the rest of this page and read [[Features]] to see what's available.

## Path B: self-host

Run your own backend and connect any app surface (web, desktop, mobile, TV) to it. You own the data, and it's free.

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 10+ | `npm install -g pnpm` |
| Docker | 20+ | [docker.com](https://docker.com) |
| GNU Make | any | macOS: `xcode-select --install` |
| nSelf CLI | v1.2.1+ | `brew install nself-org/tap/nself` |

Optional, only needed if you're building the mobile or TV apps:
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli` (for cloud builds)
- Xcode (macOS only, iOS simulator)
- Android Studio (Android emulator)

### 1. Clone the repo

```bash
git clone https://github.com/nself-org/ntask.git
cd ntask
```

### 2. Start the backend

```bash
cd backend
cp .env.example .env     # edit passwords before using this anywhere but local dev
nself build                  # generates docker-compose.yml (first time only)
make up                      # starts Postgres, Hasura, Auth, MinIO, functions, nginx
make health                  # confirm everything is up
```

`make up` also auto-seeds a set of dev test accounts (`owner@`, `admin@`, `mod@`, `dev@`, `support@`, `user@`, `demo@`, `test@nself.org`, all password `password`) plus sample lists and todos on local and staging. It's guarded to never run against production.

Backend services once it's up:

| Service | Local URL |
|---|---|
| GraphQL API | http://localhost:8080/v1/graphql |
| Hasura Console | http://localhost:8080/console |
| Auth API | http://localhost:4000 |
| MinIO (object storage) | http://localhost:9000 (API), http://localhost:9001 (console) |
| Mailpit (dev email capture) | http://localhost:8025 |
| PostgreSQL | localhost:5432 |

See [[Self-Hosting]] for the full backend walkthrough including migrations, metadata, and backups.

### 3. Run an app against it

Pick whichever surface you want to try. Each needs the backend running first.

**Mobile (React Native + Expo):**

```bash
cd apps/mobile
cp .env.example .env.local
pnpm install
pnpm start          # Expo dev server, press i for iOS sim, a for Android emulator
```

**Web (React + Vite):** the web app lives in `web/` in this repo.

```bash
git clone https://github.com/nself-org/web.git
cd web
cp .env.example .env.local
pnpm install
pnpm dev            # http://localhost:5173
```

**Desktop (Tauri 2):** wraps the same Vite frontend as web.

```bash
cd apps/desktop
pnpm tauri dev
```

**TV (react-native-tvos):** early preview, see [[Apps]] for current status.

```bash
cd apps/tv
pnpm start
```

Full per-surface guides: [[RN-Setup]] (mobile), [[Web-SPA]] (web), [[Desktop]] (desktop), [[TV]] (TV).

### 4. Create an account and explore

- **Mobile/Desktop:** tap Register in the app.
- **Web:** go to http://localhost:5173/register.

Dev emails (verification, invites) are caught locally by Mailpit at http://localhost:8025, not sent anywhere real.

After signing in you'll see:
- **Today**: tasks due today
- **Overdue**: past-due tasks
- **Upcoming**: tasks due soon
- **List detail**: tap a list to see its tasks, add or edit tasks, share the list with someone else

### 5. Poke at the GraphQL API directly

Open http://localhost:8080/console, go to the API tab, and try:

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

The app schema uses the `np_*` prefix: `np_lists`, `np_todos`, `np_shares`, `np_attachments`, `np_comments`, `np_subtasks`, `np_presence`.

### Stop the backend

```bash
cd backend && make down
```

### Common issues

| Symptom | Fix |
|---|---|
| `make up` hangs | `make down`, then `make up` again |
| Port 8080/4000/8484/5432/9000 in use | Free the port, or edit `backend/.env` |
| `nself build` not found | Install the nSelf CLI: `brew install nself-org/tap/nself` |
| Expo metro bundler error | Delete `apps/mobile/.expo/` and restart |
| Vite dev server can't connect | Check `web/.env.local` has the right endpoints |
| `make health` reports Storage: DOWN | Known gap: the CLI generates a Hasura Storage config but doesn't materialize the container yet. MinIO is up and file uploads still work through it. |

More detail: [[Backend-Troubleshooting]].

**Next:** [[Self-Hosting]] | [[Features]] | [[Apps]]
