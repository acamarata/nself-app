# ɳTask MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes ɳTask task/list
operations as tools, so AI agents (Claude, Cursor, etc.) can manage tasks
directly. Built on the same client library as the [ɳTask CLI](../cli/README.md)
(`@nself/ntask-cli`), so agent and terminal behavior stay in sync.

## Install

```bash
npm install -g @nself/ntask-mcp
```

Point an MCP client at it, for example in Claude Desktop's config:

```json
{
  "mcpServers": {
    "ntask": {
      "command": "npx",
      "args": ["-y", "@nself/ntask-mcp"],
      "env": {
        "NTASK_API_URL": "https://api.task.nself.org/v1/graphql",
        "NTASK_AUTH_URL": "https://auth.task.nself.org",
        "NTASK_EMAIL": "you@example.com",
        "NTASK_PASSWORD": "…"
      }
    }
  }
}
```

From a checkout of this repo instead:

```bash
pnpm install
pnpm --filter @nself/ntask-cli build   # mcp depends on the built cli lib
pnpm --filter @nself/ntask-mcp build
```

## Running standalone

```bash
NTASK_TOKEN=<bearer-token> \
NTASK_API_URL=http://localhost:8080/v1/graphql \
NTASK_AUTH_URL=http://localhost:4000 \
node apps/mcp/dist/index.js
```

The server communicates over stdio (JSON-RPC), so it's normally launched by an
MCP client, not run interactively.

## Authentication

Resolved once at process start, in priority order:

1. `NTASK_TOKEN` — use this bearer token directly.
2. `NTASK_EMAIL` + `NTASK_PASSWORD` — sign in on start via hasura-auth.
3. The ɳTask CLI's stored credentials (`~/.config/ntask/credentials.json`,
   written by `ntask login`), optionally scoped with `NTASK_PROFILE`.

If none of these resolve, every tool call fails with an actionable error
telling you to set `NTASK_TOKEN` or run `ntask login` first.

## Environment variables

| Variable | Purpose |
|---|---|
| `NTASK_API_URL` | GraphQL endpoint (default: `http://localhost:8080/v1/graphql`) |
| `NTASK_AUTH_URL` | Auth endpoint (default: `http://localhost:4000`) |
| `NTASK_ENDPOINT` | Named preset: `local` \| `staging` \| `prod` |
| `NTASK_TOKEN` | Bearer token (skips login) |
| `NTASK_EMAIL` / `NTASK_PASSWORD` | Login-on-start credentials |
| `NTASK_PROFILE` | Named CLI credentials profile to read, if using stored credentials |

## Tools

| Tool | Description |
|---|---|
| `list_lists` | Return all task lists |
| `list_create` | Create a new list |
| `task_list` | List tasks (optionally scoped to a list by name, or filtered by completion) |
| `task_add` | Create a task (title, list, priority, due date, notes) |
| `task_complete` | Mark a task complete or reopen it (matches by id or fuzzy title) |
| `task_search` | Search task titles |
| `task_update` | Update fields on an existing task |

All tools accept a `task`/`list` identifier as either a UUID or a
case-insensitive fuzzy title match, and return both a text block and
`structuredContent` (JSON) for clients that support structured tool output.

## Client configuration

### Claude Desktop / Claude Code (`claude_desktop_config.json` or `.mcp.json`)

```json
{
  "mcpServers": {
    "ntask": {
      "command": "node",
      "args": ["/absolute/path/to/ntask/mcp/dist/index.js"],
      "env": {
        "NTASK_TOKEN": "<bearer-token>",
        "NTASK_API_URL": "http://localhost:8080/v1/graphql",
        "NTASK_AUTH_URL": "http://localhost:4000"
      }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "ntask": {
      "command": "node",
      "args": ["/absolute/path/to/ntask/mcp/dist/index.js"],
      "env": {
        "NTASK_EMAIL": "you@example.com",
        "NTASK_PASSWORD": "your-password",
        "NTASK_ENDPOINT": "staging"
      }
    }
  }
}
```

## Development

```bash
pnpm --filter @nself/ntask-mcp dev     # run from source via tsx
pnpm --filter @nself/ntask-mcp typecheck
pnpm --filter @nself/ntask-mcp test
pnpm --filter @nself/ntask-mcp build
```

To exercise the built server directly over stdio (no MCP client needed), send
newline-delimited JSON-RPC requests to its stdin — e.g. `initialize`, then
`tools/list`, then `tools/call` with a tool name + arguments.
