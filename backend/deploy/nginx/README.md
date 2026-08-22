# Production nginx vhosts (task.nself.org)

These files configure **our hosted deployment**. Self-hosters do not need them —
`nself build` generates everything a self-hosted Task Bundle requires into
`backend/nginx/sites/`, including the `storage.` host that serves attachments.

## Why these live here and not in `backend/nginx/`

`api.task.nself.org` is served by the **web monorepo's** nginx
(`nself-web_nginx`, `/opt/nself-web`), not by ntask's own nginx container. The
vhost belongs to ntask conceptually, so it is version-controlled here, but it is
installed onto the web box. This mirrors `nsentry/deploy/nginx/` in the web repo.

## Why the install target is `conf.d/` and not `sites/`

`nself build` **deletes every file in `nginx/sites/` before regenerating it**
(`cli/internal/build/orchestrator.go`, "Clear nginx/sites/ before regenerating").
A hand-maintained vhost placed there is destroyed by the next build of the web
stack, which would take the whole API host down with no warning. The same code
leaves `conf.d/` alone, and `nginx.conf` includes both:

```
include /etc/nginx/conf.d/*.conf;
include /etc/nginx/sites/*.conf;
```

So `conf.d/` is the correct home for anything hand-maintained.

## Install

```bash
scp backend/deploy/nginx/api.task.nself.org.conf root@<prod>:/opt/nself-web/nginx/conf.d/
ssh root@<prod> 'docker exec nself-web_nginx nginx -t && docker exec nself-web_nginx nginx -s reload'
```

## Dependency

The `/storage/` route proxies to `ntask_minio:9000`. nginx can only resolve that
name if the MinIO container is attached to the web network as well as ntask's —
`ntask_hasura` is on both for the same reason. See
`docker-compose.production.override.yml` in this directory.

That override also *runs* MinIO, which is a documented nSelf-First exception. The
generator is not at fault: `MinioConfig.Enabled` reads the `MINIO_ENABLED` env
var, the production box's `.env` never sets it, and `nself.yaml` is not deployed
to the box at all — so `nself build` correctly emitted no MinIO service. The
durable fix is to set `MINIO_ENABLED=true` there and rebuild, after which the
service block can be dropped and only the network attachment kept.

Presigned URLs are signed over `/{bucket}/{key}` with only the *host* taken from
the endpoint, so the `/storage` prefix is absent from the signature and the
trailing-slash `proxy_pass` strips it before MinIO verifies the request.
