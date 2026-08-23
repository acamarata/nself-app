# API Reference — ɳTasks GraphQL

> **Status: Stub — pending Epic B codegen completion.** Full typed operation reference will be generated from codegen output. This page covers the essential endpoint and auth contract.

## GraphQL Endpoint

| Environment | URL |
|---|---|
| Local dev | `http://localhost:8080/v1/graphql` |
| Staging | `https://hasura.<staging-domain>/v1/graphql` |
| Production (web SaaS, `web/`) | Configured via `VITE_HASURA_URL` / `EXPO_PUBLIC_HASURA_URL` |

## Authentication

All requests require a JWT `Authorization` header:

```
Authorization: Bearer <JWT>
```

Obtain a JWT via the Auth service (port 4000 local):

```graphql
mutation SignIn($email: String!, $password: String!) {
  signInEmailPassword(email: $email, password: $password) {
    session {
      accessToken
      refreshToken
    }
  }
}
```

## Schema

Table prefix: `np_*` (per ADR pending P0-3 ratification).

Core tables (see [Database-Schema](Database-Schema) for full detail):
- `np_lists` — task lists
- `np_todos` — individual tasks
- `np_shares` — list sharing (permissions: owner/editor/viewer)
- `np_presence` — real-time presence data
- `np_attachments` — file attachments
- `np_comments` — task comments
- `np_subtasks` — task subtasks

## Explore the API

The Hasura Console provides a live GraphQL explorer and schema browser:

```
http://localhost:8080/console
```

Requires `HASURA_GRAPHQL_ADMIN_SECRET` (from `backend/.env.dev`).

## Operations (Stub)

Full typed operation reference will be added post-Epic B codegen. Key operations:

**Queries:** `np_lists`, `np_todos`, today view, overdue view, calendar view, notification center

**Mutations:** create/update/delete list, create/update/delete task, share list, create attachment, create comment, create subtask

**Subscriptions:** live list updates, presence changes, notification feed

See `apps/mobile/src/lib/graphql/` or `web/src/lib/graphql/` for current operation definitions. Both live in this repo.

## Related

- [Backend-Architecture](Backend-Architecture): service diagram
- [Database-Schema](Database-Schema): full table reference
- [Backend-Setup](Backend-Setup): environment setup
