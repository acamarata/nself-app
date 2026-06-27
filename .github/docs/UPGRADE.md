# Upgrade Guide

## General Upgrade Procedure

```bash
make upgrade
```

This runs: backup → stop → git pull → nself build → nself start → migrate → health check.

### Manual steps if needed

```bash
make backup                    # always backup first
make down                      # stop the stack
git pull --ff-only             # pull latest code
make build                     # rebuild compose from nself.yaml
make up                        # start updated stack
make migrate                   # apply pending Hasura migrations
make health                    # verify all services are green
```

### Rollback

If health fails after upgrade:

```bash
make down
make restore FILE=backend/backups/backup-<timestamp>.sql
git checkout <previous-commit>
make build && make up
make health
```

### Checking your version

```bash
nself version
node -e "console.log(require('./apps/mobile/package.json').version)"
```

### Data safety

Migrations are append-only in v1.x. `make upgrade` will never drop data.

### Version-specific notes

| Version range | Notes |
|---|---|
| v1.0.x → v1.1.x | All v1.1.x upgrades are backward-compatible. Run `make upgrade`. |
| v1.1.x → v1.1.4 | Schema additions only (subtasks, comments, attachments, tags, reminders, assignees). No breaking changes. |

---

For the full narrative guide, see [SELF-HOSTING.md](SELF-HOSTING.md) § Upgrading.
