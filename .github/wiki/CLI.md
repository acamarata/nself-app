# CLI

The `ntask` terminal CLI (`cli/`) manages tasks and lists from a shell or script, with `--json` output for automation and AI agents.

## Install

Workspace-linked, not yet published standalone:

```bash
pnpm install
pnpm --filter @nself/ntask-cli build
```

Run it directly (`node apps/cli/dist/index.js --help`) or link a global `ntask` binary:

```bash
cd cli && pnpm link --global
ntask --help
```

## Quickstart

```bash
ntask login you@example.com     # prompts for a hidden password
ntask lists                     # show all lists
ntask ls                        # show tasks (optionally: ntask ls Work)
ntask add "Ship the release" -l Work -p high -d 2026-07-15
ntask done "ship the release"   # matches by id or fuzzy title
ntask search release
ntask today
ntask upcoming --days 14
```

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

Every command supports `--json` (raw machine-readable output), `--endpoint <local\|staging\|prod>`, `--api-url`/`--auth-url` overrides, and `--profile <name>` for named credential sets.

## Endpoint presets

| Preset | GraphQL | Auth |
|---|---|---|
| `local` (default) | `http://localhost:8080/v1/graphql` | `http://localhost:4000` |
| `staging` | `https://api.task.staging.nself.org/v1/graphql` | `https://auth.task.staging.nself.org` |
| `prod` | `https://api.task.nself.org/v1/graphql` | `https://auth.task.nself.org` |

## Security

Passwords are never stored or printed — only the bearer/refresh token pair returned by hasura-auth. Credentials are written to `~/.config/ntask/credentials.json` at mode `0600` (parent dir `0700`). Multiple profiles (e.g. `local`, `staging`) can coexist in the same credentials file.

## Shared code with the MCP server

The CLI's client, auth, and GraphQL layer live in `cli/src/lib/` and `cli/src/gql.ts`. The [MCP server](MCP-Server) imports this same code, so CLI and AI-agent behavior stay in lockstep.

## Related

- [MCP-Server](MCP-Server): AI-agent tool interface built on the same client
- [Backend-Setup](Backend-Setup): start the backend the CLI talks to
- [apps/cli/README.md](https://github.com/nself-org/ntask/blob/main/apps/cli/README.md): full reference
