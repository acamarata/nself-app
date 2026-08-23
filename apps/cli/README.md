# ɳTask CLI

Terminal client for [ɳTasks](https://task.nself.org) — manage tasks and lists
from a shell or script, with JSON output for AI agents and automation.

## Install

```bash
npm install -g @nself/ntask-cli
ntask --help
```

Or run it without installing:

```bash
npx @nself/ntask-cli lists --endpoint prod
```

From a checkout of this repo instead:

```bash
pnpm install
pnpm --filter @nself/ntask-cli build
node apps/cli/dist/index.js --help
```

## Quickstart

```bash
# Log in (prompts for a hidden password)
ntask login you@example.com

# See your lists
ntask lists

# See tasks
ntask ls                 # all tasks
ntask ls Work            # tasks in the "Work" list (fuzzy-matched)

# Add a task
ntask add "Ship the release" -l Work -p high -d 2026-07-15

# Complete / remove (matches by id or fuzzy title)
ntask done "ship the release"
ntask rm <task-id>

# Search
ntask search release

# Due-date views
ntask today
ntask upcoming --days 14
```

Add `--json` to any command for machine-readable output (used by scripts and
the MCP server's underlying client).

## Commands

| Command | Description |
|---|---|
| `login <email>` | Authenticate, store tokens in `~/.config/ntask/credentials.json` (mode 0600) |
| `lists` | Show all lists |
| `ls [list]` | Show tasks (optionally scoped to a list) |
| `add <title>` | Add a task (`-l/--list`, `-d/--due`, `-p/--priority`, `--tags`) |
| `done <idOrFuzzy>` | Mark a task complete |
| `rm <idOrFuzzy>` | Delete a task |
| `search <query>` | Search task titles |
| `today` | Tasks due today (+ overdue) |
| `upcoming [--days N]` | Tasks due in the next N days (default 7) |

Every command supports:

- `--json` — raw JSON output only (no decorative text)
- `--endpoint <local\|staging\|prod>` — named endpoint preset
- `--api-url <url>` / `--auth-url <url>` — explicit endpoint overrides
- `--profile <name>` — named credentials profile (defaults to the endpoint name)

## Environment variables

| Variable | Purpose |
|---|---|
| `NTASK_API_URL` | Override the GraphQL endpoint |
| `NTASK_AUTH_URL` | Override the auth endpoint |
| `NTASK_TOKEN` | Use a bearer token directly, skipping stored credentials |

## Endpoint presets

| Preset | GraphQL | Auth |
|---|---|---|
| `local` (default) | `http://localhost:8080/v1/graphql` | `http://localhost:4000` |
| `staging` | `https://api.task.staging.nself.org/v1/graphql` | `https://auth.task.staging.nself.org` |
| `prod` | `https://api.task.nself.org/v1/graphql` | `https://auth.task.nself.org` |

## Security

- Passwords are never stored or printed — only the bearer/refresh token pair
  returned by hasura-auth.
- `~/.config/ntask/credentials.json` is written with mode `0600`; its parent
  directory `~/.config/ntask/` with `0700`.
- Multiple profiles (e.g. `local`, `staging`) can coexist in the same
  credentials file, selected via `--profile`.

## Development

```bash
pnpm --filter @nself/ntask-cli dev -- lists   # run from source via tsx
pnpm --filter @nself/ntask-cli typecheck
pnpm --filter @nself/ntask-cli test
pnpm --filter @nself/ntask-cli build
```

Shared client/auth/GraphQL code lives in `src/lib/` and `src/gql.ts` — this is
also what the [MCP server](../mcp/README.md) imports, so CLI and agent tool
behavior stay in lockstep.
