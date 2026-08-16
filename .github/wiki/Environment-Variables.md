# Environment variables

Reference for the environment variables the ɳTask backend reads. Set them in
`backend/.env.dev` for local work (copy from `backend/.env.example`), and as real
secrets in staging and production. Nothing here belongs in git: `.env*` is
gitignored, and `docker-compose.yml` reads values through `${VAR}` interpolation
rather than embedding them.

## Core services

| Variable | Used by | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | postgres, hasura, auth, functions | Database password. Every service builds its connection string from it. |
| `HASURA_ADMIN_SECRET` | hasura, functions | Admin access to Hasura. Never ship this to a client. |
| `AUTH_JWT_SECRET` / `HASURA_GRAPHQL_JWT_SECRET` | auth, hasura | Must match, or auth issues tokens Hasura refuses to verify. A mismatch shows up as `JWSInvalidSignature` on every request. |
| `AUTH_SMTP_*` | auth | Outbound mail for verification and password reset. |

## Action handlers

| Variable | Used by | Notes |
|---|---|---|
| `NHOST_WEBHOOK_SECRET` | functions, hasura | Shared secret proving an action request really came from Hasura. See below. |
| `ACTION_HANDLER_URL` | hasura | Where Hasura sends action requests, e.g. `http://ntask_functions:3001`. |
| `DATABASE_URL` | functions | Direct Postgres access for handlers that need it. |
| `HASURA_GRAPHQL_ENDPOINT` | functions | GraphQL endpoint the handlers call with the admin secret. |
| `SENTRY_DSN_BACKEND` | functions | Optional. Absent means Sentry is a no-op. |

### `NHOST_WEBHOOK_SECRET`

Hasura sends this as a header on every action call, and the handler compares it
in constant time before doing any work. Without it, anything that can reach the
handler can claim to be any user by setting `session_variables` in the request
body, because the handlers trust that field.

Generate one with:

```bash
openssl rand -hex 32
```

Set the same value on both the `hasura` and `functions` services. If it is empty
the handler logs a loud warning at boot and continues serving, so that adding
this check cannot take a running deployment offline. **Staging and production
should both have a real value set** — an empty secret means the check is off.

## Backups

| Variable | Used by | Notes |
|---|---|---|
| `BACKUP_S3_*` | backup scripts | Cloudflare R2 credentials for `make backup-remote`. |
| `DR_DATABASE_URL` | `make dr-test` | Scratch database for restore drills. Never point this at production. |

## Where values come from

- **Local**: `backend/.env.dev`, copied from `backend/.env.example`.
- **Staging and production**: set on the server, read by `docker-compose.yml`
  through `${VAR}` interpolation. The generated compose file is gitignored
  because it would otherwise contain resolved secrets.
- **CI**: GitHub Actions secrets on `nself-org/ntask`.
