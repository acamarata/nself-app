# MCP Server

The ɳTask MCP server (`mcp/`) exposes task and list operations as [Model Context Protocol](https://modelcontextprotocol.io) tools, so AI agents (Claude, Cursor, etc.) can manage tasks directly. It's built on the same client library as the [CLI](CLI) (`@nself/ntask-cli`), so agent and terminal behavior stay in sync.

## Install

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
node mcp/dist/index.js
```

The server communicates over stdio (JSON-RPC) — it's meant to be launched by an MCP client, not run interactively.

## Authentication

Resolved once at process start, in priority order:

1. `NTASK_TOKEN` — bearer token used directly.
2. `NTASK_EMAIL` + `NTASK_PASSWORD` — signs in on start via hasura-auth.
3. The CLI's stored credentials (`~/.config/ntask/credentials.json`), optionally scoped with `NTASK_PROFILE`.

If none resolve, every tool call fails with an error telling you to set `NTASK_TOKEN` or run `ntask login` first.

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

Every tool accepts a `task`/`list` identifier as either a UUID or a case-insensitive fuzzy title match, and returns both a text block and `structuredContent` (JSON) for clients that support structured tool output.

## Client configuration

**Claude Desktop / Claude Code** (`claude_desktop_config.json` or `.mcp.json`):

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

**Cursor** (`.cursor/mcp.json`):

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

## Related

- [CLI](CLI): terminal client built on the same library
- [Backend-Setup](Backend-Setup): start the backend the MCP server talks to
- [mcp/README.md](https://github.com/nself-org/ntask/blob/main/mcp/README.md): full reference
