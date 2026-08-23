#!/usr/bin/env bash
# metadata-diff.sh — Compare committed Hasura metadata against a live environment.
#
# Why this exists:
#   backend/hasura/metadata/ is the source of truth, but nothing in CI or in
#   `nself start` applies it. On 2026-08-22 production was found to be missing
#   four authorization checks committed months earlier, one of which let any user
#   read another user's GDPR export. The permissions were correct in git the
#   whole time; they had simply never been deployed.
#
#   On 2026-08-24 the same tool reported "no permission drift" on BOTH boxes
#   while 100% of the declared event triggers were absent from both — because it
#   compared permissions and nothing else. It now covers every layer the repo
#   declares: permissions, cron triggers, event triggers, actions, query
#   collections and the allowlist. A gate that measures one layer and prints
#   green is worse than no gate, because it is believed.
#
#   Exit code 1 means the deployed metadata does not match the repo. Reconcile
#   with `make metadata-reconcile HOST=<box> APPLY=1`.
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

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
META_DIR="$(cd "$HERE/.." && pwd)/hasura/metadata"
HOST="${1:-}"

[ -d "$META_DIR" ] || { echo "ERROR: metadata not found at $META_DIR" >&2; exit 2; }

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

META_DIR="$META_DIR" LIVE_JSON="$LIVE_JSON" HERE="$HERE" python3 <<'PY'
import json, os, sys
sys.path.insert(0, os.environ["HERE"])
import metadata_compare as mc

live = json.loads(os.environ["LIVE_JSON"])
if "sources" not in live.get("metadata", live):
    print(f"ERROR: unexpected metadata response: {json.dumps(live)[:200]}", file=sys.stderr)
    sys.exit(2)

repo = mc.load_repo(os.environ["META_DIR"])
drift = mc.compare(repo, live)

if not drift:
    print("Hasura metadata matches the repo across every layer:")
    print(f"  permissions      {len(repo['tables'])} table(s)")
    print(f"  cron_triggers    {len(repo['cron_triggers'])}")
    print(f"  event_triggers   {len(repo['event_triggers'])}")
    print(f"  actions          {len(repo['actions'])}")
    print(f"  query_collections {len(repo['query_collections'])} (allowlist entries: {len(repo['allowlist'])})")
    sys.exit(0)

by_cat: dict[str, list[str]] = {}
for cat, msg in drift:
    by_cat.setdefault(cat, []).append(msg)

print(f"Hasura metadata drift: {len(drift)} difference(s) between repo and environment\n")
for cat in ("permissions", "cron_triggers", "event_triggers", "actions",
            "query_collections", "allowlist"):
    if cat not in by_cat:
        continue
    print(f"{cat} ({len(by_cat[cat])}):")
    for m in by_cat[cat]:
        print(f"  - {m}")
    print("")

print("A differing row check, a missing column restriction, or a trigger that")
print("exists in git and nowhere else is a live functional gap, not a cosmetic")
print("difference. Reconcile with:")
print("  make metadata-reconcile HOST=<box>          # dry run")
print("  make metadata-reconcile HOST=<box> APPLY=1  # push it")
print("")
print("Do NOT reach for `hasura metadata apply` here: it REPLACES the whole")
print("metadata document, and this repo does not declare the tables")
print("hasura-auth owns (refresh_tokens, roles, user_providers,")
print("user_security_keys, ...). A replace untracks them and breaks MFA,")
print("OAuth and role lookups.")
sys.exit(1)
PY
