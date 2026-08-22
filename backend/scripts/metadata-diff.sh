#!/usr/bin/env bash
# metadata-diff.sh — Compare committed Hasura metadata against a live environment.
#
# Why this exists:
#   backend/hasura/metadata/ is the source of truth for table permissions, but
#   nothing in CI or in `nself start` applies it. On 2026-08-22 production was
#   found to be missing four authorization checks that had been committed months
#   earlier, one of which allowed any user to read another user's GDPR export by
#   registering an attachment row pointing at their storage key. The permissions
#   were correct in git the whole time; they had simply never been deployed.
#
#   Exit code 1 means the deployed permissions do not match the repo. Run
#   `make metadata-apply` against that environment to reconcile.
#
# Usage:
#   backend/scripts/metadata-diff.sh                  # local stack
#   backend/scripts/metadata-diff.sh <ssh-host>       # remote nSelf box
#
# Reads the admin secret from the running container rather than .env on purpose:
# the two drift, and a stale secret silently downgrades the request to the
# anonymous role, which returns confusing "not found in type: 'query_root'"
# errors instead of an auth failure.
set -euo pipefail

REPO_META="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/hasura/metadata/databases/default/tables/tables.yaml"
HOST="${1:-}"

[ -f "$REPO_META" ] || { echo "ERROR: metadata not found at $REPO_META" >&2; exit 2; }

fetch_live() {
  local script='
    ADMIN=$(docker inspect ntask_hasura --format "{{range .Config.Env}}{{println .}}{{end}}" \
      | grep "^HASURA_GRAPHQL_ADMIN_SECRET=" | cut -d= -f2-)
    docker exec ntask_hasura curl -s -X POST http://127.0.0.1:8080/v1/metadata \
      -H "x-hasura-admin-secret: $ADMIN" -H "Content-Type: application/json" \
      -d "{\"type\":\"export_metadata\",\"args\":{}}"
  '
  if [ -n "$HOST" ]; then ssh -o ConnectTimeout=30 "root@$HOST" "$script"
  else bash -c "$script"; fi
}

LIVE_JSON="$(fetch_live)"

REPO_META="$REPO_META" LIVE_JSON="$LIVE_JSON" python3 <<'PY'
import json, os, sys, yaml

live = json.loads(os.environ["LIVE_JSON"])
live = live.get("metadata", live)
if "sources" not in live:
    print(f"ERROR: unexpected metadata response: {json.dumps(live)[:200]}", file=sys.stderr)
    sys.exit(2)

ltab = {t["table"]["name"]: t for s in live.get("sources", []) for t in s.get("tables", [])}
rtab = {t["table"]["name"]: t for t in yaml.safe_load(open(os.environ["REPO_META"]))}

KINDS = ("insert_permissions", "select_permissions", "update_permissions", "delete_permissions")
drift = []

# Tables present only in the live environment are ignored: hasura-auth owns
# users/roles/refresh_tokens/... and they are legitimately not in this file.
for name in sorted(set(rtab) - set(ltab)):
    drift.append(f"{name}: in repo, NOT tracked in the environment")

for name in sorted(set(rtab) & set(ltab)):
    for kind in KINDS:
        r = {p["role"]: p["permission"] for p in rtab[name].get(kind, [])}
        l = {p["role"]: p["permission"] for p in ltab[name].get(kind, [])}
        for role in sorted(set(r) - set(l)):
            drift.append(f"{name}.{kind}[{role}]: defined in repo, MISSING in the environment")
        for role in sorted(set(l) - set(r)):
            drift.append(f"{name}.{kind}[{role}]: present in the environment, not in repo")
        for role in sorted(set(r) & set(l)):
            if json.dumps(r[role], sort_keys=True) != json.dumps(l[role], sort_keys=True):
                rc, lc = set(r[role].get("columns", [])), set(l[role].get("columns", []))
                detail = []
                if rc - lc: detail.append(f"columns missing live: {sorted(rc - lc)}")
                if lc - rc: detail.append(f"extra columns live: {sorted(lc - rc)}")
                if json.dumps(r[role].get("check"), sort_keys=True) != json.dumps(l[role].get("check"), sort_keys=True):
                    detail.append("row check DIFFERS")
                if json.dumps(r[role].get("filter"), sort_keys=True) != json.dumps(l[role].get("filter"), sort_keys=True):
                    detail.append("row filter DIFFERS")
                if r[role].get("set") != l[role].get("set"):
                    detail.append("column presets DIFFER")
                drift.append(f"{name}.{kind}[{role}]: " + "; ".join(detail or ["differs"]))

if drift:
    print(f"Hasura metadata drift: {len(drift)} difference(s) between repo and environment\n")
    for d in drift:
        print(f"  - {d}")
    print("\nA differing row check or a missing column restriction is a live")
    print("authorization gap, not a cosmetic difference. Reconcile with:")
    print("  cd backend && make metadata-apply")
    sys.exit(1)

print("Hasura metadata matches the repo: no permission drift.")
PY
