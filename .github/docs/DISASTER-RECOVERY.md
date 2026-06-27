# ɳTasks Disaster Recovery Runbook

**RTO (Recovery Time Objective):** 4 hours
**RPO (Recovery Point Objective):** 24 hours (daily backup at 02:00 UTC)
**Last drill:** Not yet completed (K-AUX-05)
**Backup storage:** Cloudflare R2 (`ntask-backups` bucket)

---

## Failure Scenarios

| Scenario | Recovery path | Expected time |
|---|---|---|
| Hetzner server failure (hard) | Full DR sequence below | ~3-4h |
| Database corruption | Restore from latest R2 backup | ~1h |
| Accidental data deletion | Restore from R2 to scratch, extract rows | ~2h |
| Vercel deploy regression | `vercel rollback` (see SELF-HOSTING.md) | <5min |

---

## Make Targets

| Command | Purpose |
|---|---|
| `make backup-remote` | Trigger manual off-machine backup to R2 |
| `make restore-remote FILE=<key>` | Restore specific backup from R2 |
| `make list-backups` | List most recent 20 backups in R2 |
| `make dr-test` | Non-destructive DR drill against scratch DB |

---

## Backup Schedule

Daily cron at 02:00 UTC (configured in Hasura cron triggers + pg_cron as fallback).
Retention: 30 days (cleanup runs automatically inside `backup-remote.sh`).
Failure alert: Sentry event created if backup exits non-zero (requires `SENTRY_DSN_BACKEND`).

---

## Full DR Sequence (Hetzner server failure)

### Prerequisites

- Cloudflare R2 credentials available (see `~/.claude/vault.env` or your secrets manager)
- Hetzner Cloud API token (`HCLOUD_TOKEN`)
- Cloudflare DNS write access (wrangler or dashboard)
- `nself` CLI installed locally
- `aws` CLI installed locally (AWS CLI v2; used as R2 client)

### Step 1 — Provision new server (~20 min)

```bash
# Using Hetzner Cloud CLI
hcloud server create \
  --name ntask-prod-dr \
  --type cx22 \
  --image ubuntu-24.04 \
  --location fsn1 \
  --ssh-key <your-key-name>

# Note the new server IP
hcloud server describe ntask-prod-dr | grep "Public Net"
```

### Step 2 — Install nSelf (~15 min)

```bash
ssh root@<new-ip>
curl -fsSL https://nself.org/install.sh | bash
nself install --app ntask
```

### Step 3 — Restore database from latest backup (~20 min)

```bash
# From local machine — requires BACKUP_* vars
source ~/.claude/vault.env   # or export vars manually

# List available backups
make list-backups

# Restore to new server's Postgres
FILE=ntask/backup-YYYYMMDD-HHMMSS.sql.gz \
DATABASE_URL=postgresql://postgres:<pass>@<new-ip>:5432/ntask \
bash backend/scripts/restore-remote.sh
```

### Step 4 — Verify restore

```bash
psql postgresql://postgres:<pass>@<new-ip>:5432/ntask -c "
  SELECT 'np_todos'    AS tbl, COUNT(*) FROM np_todos
  UNION ALL SELECT 'np_lists',    COUNT(*) FROM np_lists
  UNION ALL SELECT 'np_profiles', COUNT(*) FROM np_profiles;
"
```

Row counts should be non-zero and consistent with the last known state.

### Step 5 — DNS cutover (~2 min)

```bash
# Update Cloudflare A record to new server IP
# DNS TTL should be 300s — lower this BEFORE a DR event if possible
wrangler dns update <zone-id> <record-id> --content <new-ip>

# Verify propagation
dig api.nself.org +short
```

### Step 6 — Verify services (~5 min)

```bash
curl https://api.nself.org/healthz
curl https://auth.nself.org/healthz
make health
```

All endpoints should return HTTP 200 before calling the DR complete.

---

## DR Drill Log

| Date | Trigger | RTO Achieved | Notes |
|---|---|---|---|
| — | Not yet run | — | K-AUX-05 pending |

Update this table after every drill or real DR event.

---

## External Dependencies

| Service | Use in DR | Credentials |
|---|---|---|
| Hetzner Cloud | Provision replacement server | `HCLOUD_TOKEN` in vault |
| Cloudflare R2 | Backup storage | `BACKUP_ACCESS_KEY` / `BACKUP_SECRET_KEY` in vault |
| Cloudflare DNS | Cutover A records | Cloudflare dashboard or wrangler |
| nself CLI | Install and start all services | `curl -fsSL https://nself.org/install.sh` |
| AWS CLI v2 | R2 client (S3-compatible) | Uses `BACKUP_ACCESS_KEY` / `BACKUP_SECRET_KEY` |
