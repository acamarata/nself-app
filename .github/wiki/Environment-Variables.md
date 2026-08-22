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
| `AUTH_SMTP_HOST` / `AUTH_SMTP_PORT` / `AUTH_SMTP_SECURE` / `AUTH_SMTP_AUTH_METHOD` / `AUTH_SMTP_USER` / `AUTH_SMTP_PASS` / `AUTH_SMTP_SENDER` | auth | Outbound mail for verification and password reset, sent via Postmark over SMTP (`smtp.postmarkapp.com:587`). Both `AUTH_SMTP_USER` and `AUTH_SMTP_PASS` are the same Postmark server token. Do not set `AUTH_SMTP_HOST` to the literal string `postmark` — that switches hasura-auth into API mode, which looks up server-side templates by alias and ignores `AUTH_EMAIL_TEMPLATES_PATH`. |
| `AUTH_EMAIL_TEMPLATES_PATH` | auth | Path hasura-auth reads local email templates from (`backend/email-templates/{locale}/{template-id}/{body.html,subject.txt}`), rendered with fasttemplate syntax (`${link}`, `${email}`), not Go templates. Only takes effect in SMTP mode. |

## Object storage (attachments)

| Variable | Used by | Notes |
|---|---|---|
| `MINIO_ENABLED` | nself build | **Required for attachments.** Gates the entire MinIO service. Without it `nself build` generates no object store, `getUploadUrl` has nothing to sign against, and file attachments silently do not work. The other `MINIO_*` values below do **not** imply it, which makes it easy to miss: the env file looks fully configured for storage while producing none. |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | minio | MinIO's own credentials. |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | functions | What `lib/s3-presign.ts` signs presigned URLs with. Normally the same values as the root pair. |
| `MINIO_BUCKET` | functions | Bucket presigned URLs are issued against (`ntask`). Clients cannot choose a bucket — see below. |
| `MINIO_ENDPOINT` | functions | Internal address (`http://minio:9000`). Used for server-to-MinIO calls only. |
| `MINIO_ENDPOINT_PUBLIC` | functions | Address the **browser** uses. Both upload and download URLs are signed against this. Setting it to the internal endpoint makes uploads fail, because the PUT is issued by the user's browser, which cannot resolve a Docker service name. |
| `MINIO_REGION` | functions | SigV4 signing region (`us-east-1`). |

Only the *host* of `MINIO_ENDPOINT_PUBLIC` enters the signature — `presignS3Url`
signs the canonical URI `/{bucket}/{key}`. So a path prefix is invisible to the
signature and must be stripped by the proxy. Our hosted deployment uses
`https://api.task.nself.org/storage` with a trailing-slash `proxy_pass`;
a self-hosted install uses `https://storage.<domain>` at the root. Both work.

`uploader_id` and `bucket` are not client-settable: Hasura presets `uploader_id`
to the caller, and `bucket` was removed from the role's insertable columns
because `getDownloadUrl` honours it, so a client-chosen bucket allowed
cross-bucket traversal.

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
