# ntask BFF (non-Vercel hosting)

`task.nself.org` runs a thin Backend-For-Frontend: same-origin, httpOnly
cookie-session auth plus a GraphQL proxy. On **Vercel** these are the serverless
functions in [`../api`](../api) (`api/auth/*.ts`, `api/graphql.ts`). On any
**non-Vercel** host (a self-hosted nSelf box that serves the SPA with nginx and
has no Vercel runtime), the exact same handlers run here as a long-lived Node
process, and nginx proxies `/api/*` to it.

## Why this exists

The SPA never talks to Hasura/Auth directly — it calls same-origin `/api/*` so
the JWT lives in an httpOnly cookie the browser JS can't read. That BFF layer is
mandatory on **every** deploy target. Vercel gives it for free; nginx-only hosts
need this container.

## No drift by construction

- `server.cjs` is a generic Vercel-handler → Node `http` adapter. It resolves
  routes **dynamically** from the bundled tree, so adding an `api/*.ts` handler
  needs no change here.
- The `Dockerfile` **re-bundles the real `api/*.ts` with esbuild at build time**
  (multi-stage). There is no committed snapshot of the handlers. Rebuild = latest
  source, always.

## Build

Context must be `web/ntask` (so `api/` and `bff/` are both visible):

```bash
cd web/ntask
docker build -f bff/Dockerfile -t ntask-api:staging .
```

The runtime image has **no npm dependencies** — the handlers use only Node core
(`crypto`) and global `fetch`; the `@vercel/node` imports are type-only and are
erased during bundling.

## Runtime configuration (env)

| Var | Purpose | Example |
|---|---|---|
| `GRAPHQL_INTERNAL_URL` | Hasura GraphQL endpoint (in-cluster) | `http://ntask_hasura:8080/v1/graphql` |
| `AUTH_INTERNAL_URL` | hasura-auth endpoint (in-cluster) | `http://ntask_auth:4000` |
| `AUTH_HS256_KEY` | HS256 key used to verify the session JWT locally. **Must equal the key the auth container signs with.** | (matches `HASURA_GRAPHQL_JWT_SECRET.key`) |
| `NODE_ENV` | `production` sets the `Secure` cookie flag | `production` |
| `PORT` | listen port | `3080` (default) |

Provide these via an **env-file**, never literal `-e` flags. See
`bff/deploy-staging.sh` for the reference staging deploy (build on the box from
synced source + `docker compose up -d --no-deps api`).

> **Production hardening (follow-up):** the durable path is CI building this image
> and publishing to GHCR, with the compose referencing an immutable tag instead of
> building on the box. Tracked as a PCI to `nself` / `web`.
