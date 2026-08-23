#!/usr/bin/env bash
# metadata-reconcile.sh — Push the repo's permissions to a live environment.
#
# Why not `hasura metadata apply`:
#   That performs a REPLACE of the entire metadata document. This repo's
#   tables.yaml covers schema `public` plus `auth.users` only, while a running
#   environment also tracks the tables hasura-auth owns — refresh_tokens, roles,
#   providers, user_providers, user_roles, user_security_keys, provider_requests,
#   refresh_token_types. A replace would UNTRACK all of them, breaking MFA,
#   OAuth logins and role lookups. Verified against production 2026-08-22:
#   repo declares 28 tables, production tracks 35.
#
#   So this script issues targeted per-object calls instead. It only ever
#   touches objects the repo declares, and never removes anything the repo does
#   not mention.
#
#   Scope extended 2026-08-24: it now reconciles cron triggers, event triggers
#   and the allowlist collection as well as permissions. Those layers had no
#   owner at all - the declared event triggers existed in git and on no
#   environment, and staging's cron triggers had lost their webhook-secret
#   headers, so every cron call reached the functions service unauthenticated.
#   Each is applied with the per-object API and `replace: true`, which updates
#   one object and leaves the rest of the metadata document alone.
#
# Order matters: permissions can reference relationships (np_member_profiles'
# select filter traverses `list_memberships`). Creating the permission before
# the relationship fails with "Inconsistent object", and if the old permission
# was dropped first the table is left with none — an outage, not a no-op. So
# relationships are reconciled first, and each permission is replaced only after
# its dependencies exist.
#
# Usage:
#   backend/scripts/metadata-reconcile.sh            [--apply]   # local
#   backend/scripts/metadata-reconcile.sh <host>     [--apply]   # remote
#
# Without --apply it prints what it would change and exits 0 (dry run).
set -euo pipefail

HERE_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
META_DIR="$HERE/hasura/metadata"
REPO_META="$META_DIR/databases/default/tables/tables.yaml"

HOST=""; APPLY=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    *) HOST="$a" ;;
  esac
done

[ -f "$REPO_META" ] || { echo "ERROR: no metadata at $REPO_META" >&2; exit 2; }

# Admin secret comes from the running container: .env has drifted from it, and a
# stale secret silently downgrades to the anonymous role instead of erroring.
run_remote() {
  if [ -n "$HOST" ]; then ssh -o ConnectTimeout=30 "root@$HOST" "$1"; else bash -c "$1"; fi
}

EXPORT_CMD='
  ADMIN=$(docker inspect ntask_hasura --format "{{range .Config.Env}}{{println .}}{{end}}" \
    | grep "^HASURA_GRAPHQL_ADMIN_SECRET=" | cut -d= -f2-)
  docker exec ntask_hasura curl -s -X POST http://127.0.0.1:8080/v1/metadata \
    -H "x-hasura-admin-secret: $ADMIN" -H "Content-Type: application/json" \
    -d "{\"type\":\"export_metadata\",\"args\":{}}"
'
LIVE_JSON="$(run_remote "$EXPORT_CMD")"

PLAN="$(REPO_META="$REPO_META" LIVE_JSON="$LIVE_JSON" HERE_SCRIPTS="$HERE_SCRIPTS" META_DIR="$META_DIR" python3 <<'PY'
import json, os, sys, yaml

sys.path.insert(0, os.environ["HERE_SCRIPTS"])
import metadata_compare as mc

live = json.loads(os.environ["LIVE_JSON"]); live = live.get("metadata", live)
if "sources" not in live:
    print(f"ERROR: unexpected export_metadata response: {json.dumps(live)[:200]}", file=sys.stderr); sys.exit(2)

repo = mc.load_repo(os.environ["META_DIR"])
live_tables = [t for s in live.get("sources", []) for t in s.get("tables") or []]

ltab = {(t["table"].get("schema","public"), t["table"]["name"]): t
        for s in live.get("sources", []) for t in s.get("tables", [])}
rtab = {(t["table"].get("schema","public"), t["table"]["name"]): t
        for t in yaml.safe_load(open(os.environ["REPO_META"]))}

# Hasura omits keys that hold their default value, while the repo YAML often
# states them explicitly. Comparing raw dicts therefore reports differences that
# do not exist (allow_aggregations: false vs absent). A drift tool that cries
# wolf gets ignored, which is exactly how the real drift stayed invisible, so
# both sides are normalized to the same defaults before comparing.
DEFAULTS = {"allow_aggregations": False, "computed_fields": [], "columns": [],
            "set": {}, "backend_only": False, "filter": {}, "check": {}}

def norm(p):
    if p is None:
        return None
    out = dict(p)
    for k, v in DEFAULTS.items():
        if out.get(k) in (None, ):
            out[k] = v
    out.pop("comment", None)
    if isinstance(out.get("columns"), list):
        out["columns"] = sorted(out["columns"])
    return json.dumps(out, sort_keys=True)

KINDS = {
    "insert_permissions": "insert",
    "select_permissions": "select",
    "update_permissions": "update",
    "delete_permissions": "delete",
}
ops, notes = [], []

for key in sorted(rtab):
    schema, name = key
    if key not in ltab:
        notes.append(f"{schema}.{name}: declared in repo but not tracked live - track it first, skipping")
        continue
    tbl = {"schema": schema, "name": name}
    rt, lt = rtab[key], ltab[key]

    # Relationships first: permissions may traverse them.
    for relkind, api in (("object_relationships", "pg_create_object_relationship"),
                         ("array_relationships", "pg_create_array_relationship")):
        have = {r["name"] for r in (lt.get(relkind) or [])}
        for r in (rt.get(relkind) or []):
            if r["name"] not in have:
                ops.append({"type": api, "args": {"source": "default", "table": tbl,
                                                  "name": r["name"], "using": r["using"]}})
                notes.append(f"{schema}.{name}: create {relkind[:-1]} '{r['name']}'")

    for kind, short in KINDS.items():
        rperm = {p["role"]: p["permission"] for p in (rt.get(kind) or [])}
        lperm = {p["role"]: p["permission"] for p in (lt.get(kind) or [])}
        for role, perm in sorted(rperm.items()):
            if role in lperm and norm(lperm[role]) == norm(perm):
                continue
            if role in lperm:
                ops.append({"type": f"pg_drop_{short}_permission",
                            "args": {"source": "default", "table": tbl, "role": role}})
            ops.append({"type": f"pg_create_{short}_permission",
                        "args": {"source": "default", "table": tbl, "role": role, "permission": perm}})
            notes.append(f"{schema}.{name}.{kind}[{role}]: {'replace' if role in lperm else 'create'}")

# -- cron triggers -----------------------------------------------------------
# create_cron_trigger with replace:true updates one trigger in place. Hasura
# fills defaults (retry_interval_seconds, ...), so only the fields the repo
# controls are compared - a planner that cries wolf gets ignored.
rcron = {c["name"]: c for c in (repo.get("cron_triggers") or [])}
lcron = {c["name"]: c for c in (live.get("cron_triggers") or [])}
for name in sorted(rcron):
    r = rcron[name]
    if name in lcron and mc._norm_cron(r) == mc._norm_cron(lcron[name]):
        continue
    args = {k: v for k, v in r.items() if k != "name"}
    args["name"] = name
    if name in lcron:
        args["replace"] = True
    ops.append({"type": "create_cron_trigger", "args": args})
    notes.append("cron_trigger %s: %s" % (name, "replace" if name in lcron else "create"))
for name in sorted(set(lcron) - set(rcron)):
    notes.append("cron_trigger %s: live but not in repo - left alone" % name)

# -- event triggers ----------------------------------------------------------
revt = {e["name"]: e for e in (repo.get("event_triggers") or [])}
levt = {}
for t in live_tables:
    for e in t.get("event_triggers") or []:
        levt[e["name"]] = (t["table"], e)
for name in sorted(revt):
    r = revt[name]
    same_table = name in levt and levt[name][0].get("name") == r["table"]["name"]
    if same_table and mc._norm_event(r) == mc._norm_event(levt[name][1]):
        continue
    args = {k: v for k, v in r.items() if k not in ("name", "table")}
    args.update({"name": name, "source": "default", "table": r["table"]})
    # replace:true on a trigger that does not exist yet is an error, not a create.
    if name in levt:
        args["replace"] = True
    ops.append({"type": "pg_create_event_trigger", "args": args})
    notes.append("event_trigger %s on %s.%s: %s" % (
        name, r["table"]["schema"], r["table"]["name"],
        "replace" if name in levt else "create"))
for name in sorted(set(levt) - set(revt)):
    notes.append("event_trigger %s: live but not in repo - left alone" % name)

# -- actions -----------------------------------------------------------------
# update_action REPLACES the whole definition, and the repo's actions.yaml
# declares only the operational half (handler, headers, timeout, kind) - the
# signature (arguments, output_type) lives in actions.graphql and is compiled
# into the live definition by the Hasura CLI. Sending the repo half alone would
# erase every argument. So the live definition is the base and the repo's
# declared fields are overlaid on top; anything the repo does not mention is
# preserved exactly as deployed.
REPO_ACTION_FIELDS = ("handler", "headers", "timeout", "kind",
                      "forward_client_headers", "request_transform",
                      "response_transform")
ract = {a["name"]: a for a in (repo.get("actions") or [])}
lact = {a["name"]: a for a in (live.get("actions") or [])}
for name in sorted(ract):
    r = ract[name]
    if name not in lact:
        notes.append("action %s: declared in repo but not live - it needs its "
                     "SDL signature from actions.graphql, apply with the Hasura "
                     "CLI once, then this script keeps it in sync" % name)
        continue
    if mc._norm_action(r) == mc._norm_action(lact[name]):
        continue
    live_def = dict(lact[name].get("definition") or {})
    # Derived, not settable: Hasura recomputes it from forward_client_headers.
    live_def.pop("ignored_client_headers", None)
    repo_def = r.get("definition") or {}
    for field in REPO_ACTION_FIELDS:
        if field in repo_def:
            live_def[field] = repo_def[field]
    args = {"name": name, "definition": live_def}
    if r.get("comment"):
        args["comment"] = r["comment"]
    ops.append({"type": "update_action", "args": args})
    notes.append("action %s: update (handler/headers/timeout from repo, "
                 "signature preserved)" % name)
for name in sorted(set(lact) - set(ract)):
    notes.append("action %s: live but not in repo - left alone" % name)

# -- allowlist ---------------------------------------------------------------
# Registering the collection does NOT enable enforcement: Hasura consults the
# allowlist only when HASURA_GRAPHQL_ENABLE_ALLOWLIST is true, which is
# deliberately unset on both boxes (14 registered operations vs 78 the clients
# actually send - enabling it today is an outage). This only makes live match
# repo so the drift gate can be believed.
lallow = {c["collection"] for c in (live.get("allowlist") or [])}
for entry in (repo.get("allowlist") or []):
    if entry["collection"] in lallow:
        continue
    ops.append({"type": "add_collection_to_allowlist", "args": dict(entry)})
    notes.append("allowlist %s: add (inert until HASURA_GRAPHQL_ENABLE_ALLOWLIST is set)"
                 % entry["collection"])

print(json.dumps({"ops": {"type": "bulk", "args": ops}, "notes": notes}))
PY
)"

python3 - "$PLAN" <<'PY'
import json, sys
p = json.loads(sys.argv[1])
if not p["notes"]:
    print("Nothing to reconcile: live permissions already match the repo.")
else:
    print(f"{len(p['notes'])} change(s):")
    for n in p["notes"]:
        print(f"  - {n}")
PY

CHANGES="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["ops"]["args"]))' "$PLAN")"
[ "$CHANGES" -eq 0 ] && exit 0

if [ "$APPLY" -ne 1 ]; then
  echo
  echo "Dry run. Re-run with --apply to push these to the environment."
  exit 0
fi

# Sent as one bulk call so a failure rolls the whole set back rather than
# leaving a table with a dropped-but-not-recreated permission.
python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["ops"]))' "$PLAN" \
  | run_remote '
      ADMIN=$(docker inspect ntask_hasura --format "{{range .Config.Env}}{{println .}}{{end}}" \
        | grep "^HASURA_GRAPHQL_ADMIN_SECRET=" | cut -d= -f2-)
      docker exec -i ntask_hasura sh -c "curl -s -X POST http://127.0.0.1:8080/v1/metadata \
        -H \"x-hasura-admin-secret: $ADMIN\" -H \"Content-Type: application/json\" --data-binary @-"
    ' | head -c 600
echo
