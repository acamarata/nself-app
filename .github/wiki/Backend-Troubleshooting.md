# Backend Troubleshooting

Common backend issues and fixes. The backend is a Docker Compose stack driven by `backend/Makefile` (see [Backend Setup](Backend-Setup)).

## `make up` fails or services exit immediately

**Symptom:** `make up` returns errors; `make status` shows containers in `Exit` state.
**Cause:** `.env` not present, missing required vars, or required ports already in use.
**Fix:**
1. `cd backend && cp .env.example .env` if the file is missing.
2. Edit `.env` and set `POSTGRES_PASSWORD` and `HASURA_GRAPHQL_ADMIN_SECRET` and `HASURA_GRAPHQL_JWT_SECRET`.
3. Free the required ports: `lsof -i :5432,8080,4000,8484,9000,9001,8025` and stop conflicting processes.
4. `make down && make up`.

## Health check shows DOWN

**Symptom:** `make health` reports DOWN for one or more services.
**Cause:** Service crashed during boot, missing env var, or downstream dependency not ready yet.
**Fix:**
1. `make logs-hasura`, `make logs-auth`: read the failing service's log.
2. For Hasura: confirm `HASURA_GRAPHQL_DATABASE_URL` matches your Postgres password.
3. For Auth: confirm `HASURA_GRAPHQL_JWT_SECRET` is valid JSON.
4. Wait 10-20 seconds and run `make health` again: Postgres takes a moment on first boot.
5. If still down, `make down && docker compose down -v && make up` (this wipes volumes: local dev only).

## Postgres data lost after `make clean`

**Symptom:** All lists, todos, and users are gone after running `make clean`.
**Cause:** `make clean` is intentionally destructive. It removes named volumes including `postgres_data`.
**Fix:** Restore from a backup: `make restore FILE=backups/backup-<timestamp>.sql`. Always `make backup` before `make clean`.

## Hasura migrations not applied

**Symptom:** Tables missing from the schema, or new app fields not visible.
**Cause:** `make up` only runs `init.sql` on first boot; subsequent schema changes need explicit migration.
**Fix:**
1. `cd backend && make migrate-status`: see which migrations are pending.
2. `make migrate`: apply pending migrations.
3. `make metadata-apply`: apply tracked tables and permissions.
4. Reload the Hasura console (`http://localhost:8080/console`) and verify the changes.

## App can't reach Hasura

**Symptom:** Client app (mobile/web/desktop/TV) GraphQL calls fail with network or CORS errors.
**Cause:** Backend not running, wrong endpoint, or simulator/emulator can't see `localhost`.
**Fix:**
1. `cd backend && make health`: confirm the backend is up.
2. Check the app's GraphQL endpoint matches the platform:
   - Web / desktop: `http://localhost:8080/v1/graphql`
   - iOS simulator: `http://127.0.0.1:8080/v1/graphql`
   - Android emulator: `http://10.0.2.2:8080/v1/graphql`
   - Physical device: host machine's LAN IP at `:8080`
3. If CORS is the issue, check `HASURA_GRAPHQL_CORS_DOMAIN` in `backend/.env`.

## File uploads fail

**Symptom:** App calls to the storage service return 5xx errors; uploads never appear.
**Cause:** MinIO not reachable, bucket missing, or credentials misconfigured.
**Fix:**
1. `make status`: confirm `minio` and `storage` are both running.
2. Open the MinIO console at `http://localhost:9001` (credentials in `backend/.env`).
3. Confirm the configured bucket exists. If not, create it via the MinIO console.
4. Restart storage: `docker compose restart storage`.

## Hasura console asks for an admin secret every load

**Symptom:** Console at `http://localhost:8080/console` keeps prompting for the secret.
**Cause:** `HASURA_GRAPHQL_ADMIN_SECRET` mismatch between `.env` and the running container, or browser local storage cleared.
**Fix:**
1. Confirm `.env` has the secret set, then `make restart`.
2. Paste the exact secret value into the console prompt; the console caches it in browser storage.

## Password reset or verification email never arrives

**Symptom:** `POST /user/password/reset` returns HTTP 500, or returns 200 but nothing
appears in the mail catcher at `http://localhost:8025`.

There are three distinct causes and they look alike, so check the auth log first:
`docker compose logs auth | grep "problem sending email"`. The error text tells you
which one you have.

**1. No mail catcher is running.**
Log shows `dial tcp: lookup <host>: no such host`.
`nself.yaml` declares `mailhog: dev_only: true`, but `nself build` does not emit that
container, so nothing is listening. It is supplied by `backend/docker-compose.override.yml`
instead. Confirm with `docker ps | grep mailhog`, then `docker compose up -d mailhog`.

**2. The catcher is Mailpit rather than MailHog.**
Log shows `502 5.5.1 Command not implemented`. The connection succeeded, so this looks
like a different problem than it is. hasura-auth 0.36 calls `c.Auth()` unconditionally
in `sendMail()` and issues SMTP `AUTH PLAIN` even when no credentials are configured.
Mailpit's default listener rejects AUTH; MailHog accepts it with any credentials.
Use `mailhog/mailhog:v1.0.1`. (Mailpit can be forced to work with
`MP_SMTP_AUTH_ACCEPT_ANY=1` and `MP_SMTP_AUTH_ALLOW_INSECURE=1`, but the stack
standardises on MailHog so there is one answer.)

**3. The SMTP host is not on hasura-auth's allowlist.**
Log shows `unencrypted connection`. Over a non-TLS connection hasura-auth only trusts
the hostnames `mailhog`, `localhost`, `127.0.0.1`, and `::1`. Any other name is refused
even with `AUTH_SMTP_SECURE=false` and no credentials set. This is why the service is
named `mailhog` rather than relabelled. Set `AUTH_SMTP_HOST=mailhog`.

## Email arrives but is not the template we ship

**Symptom:** The subject reads "Reset your password" rather than "Reset your ɳTask password".
**Cause:** `AUTH_EMAIL_TEMPLATES_PATH` is unset, so hasura-auth renders its stock templates.
The environment is then validating a different email than the one users receive.
**Fix:** Set `AUTH_EMAIL_TEMPLATES_PATH=/app/email-templates` and mount
`backend/email-templates` at that path. Templates are `{locale}/{template-id}/{body.html,subject.txt}`
and substitution is fasttemplate syntax (`${link}`, `${email}`), not Go template syntax.

## "address already in use" on staging or production

**Symptom:** `make staging-up` or `make prod-up` fails with port 80 or 443 already in use.
**Cause:** Another reverse proxy (nginx, Apache, another Traefik) is bound to those ports.
**Fix:** Stop the other service or have it forward to Traefik. The Compose files cannot share ports.

## Where to find more help

- [Backend Setup](Backend-Setup): original setup walkthrough
- [Backend Architecture](Backend-Architecture): services, ports, data flow
- [Database Schema](Database-Schema): schema reference
- [Deployment](Deployment): staging and production deployment
- [github.com/nself-org/task/issues](https://github.com/nself-org/task/issues): open an issue
