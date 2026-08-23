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
# Three buckets, concatenated in this order at the end. A relationship cannot be
# created before BOTH of its tables are tracked, and a permission may traverse a
# relationship, so per-table interleaving fails the moment a fresh install needs
# to track anything: Hasura answered
#   Inconsistent object: table "np_todos" is not tracked
# for np_activity's `todo` relationship, because np_todos came later in the
# alphabet. Order the whole plan by kind instead.
track_ops, rel_ops, ops = [], [], []
# Cron triggers, event triggers, actions and the allowlist are applied ONE AT A
# TIME after the bulk, not inside it. Each is independently idempotent, and
# Hasura rejects `create` for an object that exists and `replace` for one that
# does not — inside an atomic bulk either mistake discards the whole plan, which
# is how a first install lost 454 successful operations to op 455.
solo_ops = []
notes = []

for key in sorted(rtab):
    schema, name = key
    tbl = {"schema": schema, "name": name}
    if key not in ltab:
        # A fresh install has the schema (migrations ran) and an empty Hasura
        # metadata, so every repo table is untracked and the GraphQL API has no
        # np_* fields at all. Tracking here is what makes `make metadata-reconcile`
        # sufficient on a first install; the alternative, `hasura metadata apply`,
        # is a full replace that untracks hasura-auth's own tables.
        track_ops.append({"type": "pg_track_table", "args": {"source": "default", "table": tbl}})
        notes.append(f"{schema}.{name}: track (declared in repo, not tracked live)")
        lt = {}
    else:
        lt = ltab[key]
    rt = rtab[key]

    # Relationships first: permissions may traverse them.
    for relkind, api in (("object_relationships", "pg_create_object_relationship"),
                         ("array_relationships", "pg_create_array_relationship")):
        have = {r["name"] for r in (lt.get(relkind) or [])}
        for r in (rt.get(relkind) or []):
            if r["name"] not in have:
                rel_ops.append({"type": api, "args": {"source": "default", "table": tbl,
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
    solo_ops.append({"type": "create_cron_trigger", "args": args})
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
    solo_ops.append({"type": "pg_create_event_trigger", "args": args})
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
missing_actions: set[str] = set()
for name in sorted(ract):
    r = ract[name]
    if name not in lact:
        missing_actions.add(name)
        notes.append("action %s: create (signature compiled from actions.graphql)" % name)
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
    solo_ops.append({"type": "update_action", "args": args})
    notes.append("action %s: update (handler/headers/timeout from repo, "
                 "signature preserved)" % name)
for name in sorted(set(lact) - set(ract)):
    notes.append("action %s: live but not in repo - left alone" % name)

# Creating an action needs its signature, which lives in the SDL rather than in
# actions.yaml. set_custom_types goes first: an action's output_type must exist
# before the action referencing it can be created.
if missing_actions:
    import actions_sdl
    sdl_path = os.path.join(os.environ["META_DIR"], "actions.graphql")
    with open(sdl_path) as fh:
        set_types, action_ops = actions_sdl.build_action_payloads(
            fh.read(), repo.get("actions") or [], missing_actions)
    if set_types:
        solo_ops.append(set_types)
        notes.append("custom_types: set %d object type(s) from actions.graphql"
                     % len(set_types["args"]["objects"]))
    solo_ops.extend(action_ops)

# -- query collections -------------------------------------------------------
# The allowlist entry references a collection by name, so on a first install the
# collection has to exist before it can be allow-listed. Only MISSING collections
# are created; an existing one is left alone, because its contents are generated
# work (codegen) that this script has no business rewriting.
lqc = {c["name"] for c in (live.get("query_collections") or [])}
for coll in (repo.get("query_collections") or []):
    if coll["name"] in lqc:
        continue
    solo_ops.append({"type": "create_query_collection",
                     "args": {"name": coll["name"], "definition": coll["definition"]}})
    notes.append("query_collection %s: create (%d operation(s))"
                 % (coll["name"], len((coll.get("definition") or {}).get("queries") or [])))

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
    solo_ops.append({"type": "add_collection_to_allowlist", "args": dict(entry)})
    notes.append("allowlist %s: add (inert until HASURA_GRAPHQL_ENABLE_ALLOWLIST is set)"
                 % entry["collection"])

print(json.dumps({"ops": {"type": "bulk", "args": track_ops + rel_ops + ops},
                  "solo": solo_ops, "notes": notes}))
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

CHANGES="$(python3 -c 'import json,sys; p=json.loads(sys.argv[1]); print(len(p["ops"]["args"]) + len(p["solo"]))' "$PLAN")"
[ "$CHANGES" -eq 0 ] && exit 0

if [ "$APPLY" -ne 1 ]; then
  echo
  echo "Dry run. Re-run with --apply to push these to the environment."
  exit 0
fi

POST_CMD='
  ADMIN=$(docker inspect ntask_hasura --format "{{range .Config.Env}}{{println .}}{{end}}" \
    | grep "^HASURA_GRAPHQL_ADMIN_SECRET=" | cut -d= -f2-)
  docker exec -i ntask_hasura sh -c "curl -s -X POST http://127.0.0.1:8080/v1/metadata \
    -H \"x-hasura-admin-secret: $ADMIN\" -H \"Content-Type: application/json\" --data-binary @-"
'

QUERY_CMD='
  ADMIN=$(docker inspect ntask_hasura --format "{{range .Config.Env}}{{println .}}{{end}}" \
    | grep "^HASURA_GRAPHQL_ADMIN_SECRET=" | cut -d= -f2-)
  docker exec -i ntask_hasura sh -c "curl -s -X POST http://127.0.0.1:8080/v2/query \
    -H \"x-hasura-admin-secret: $ADMIN\" -H \"Content-Type: application/json\" --data-binary @-"
'

# Phase 1 — tables, relationships and permissions, as ONE bulk. Atomicity matters
# here: a failure must not leave a table with a dropped-but-not-recreated
# permission. On a first install this is several hundred operations and Hasura
# rebuilds its schema as it goes, so it can take minutes.
BULK_N="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["ops"]["args"]))' "$PLAN")"
if [ "$BULK_N" -gt 0 ]; then
  echo "Applying $BULK_N table/relationship/permission change(s) as one transaction..."
  RESP="$(python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["ops"]))' "$PLAN" \
    | run_remote "$POST_CMD")"
  if printf '%s' "$RESP" | grep -q '"error"'; then
    echo "FAILED: $(printf '%s' "$RESP" | head -c 500)" >&2
    exit 1
  fi
  echo "  ok"
fi

# Phase 2 — one call per trigger/action/allowlist entry. Independently
# idempotent, so a single failure neither rolls back the others nor hides them.
SOLO_N="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["solo"]))' "$PLAN")"
i=0
while [ "$i" -lt "$SOLO_N" ]; do
  OP="$(python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["solo"][int(sys.argv[2])]))' "$PLAN" "$i")"
  NAME="$(python3 -c 'import json,sys; o=json.loads(sys.argv[1]); print(o["type"], o["args"].get("name") or o["args"].get("collection",""))' "$OP")"
  RESP="$(printf '%s' "$OP" | run_remote "$POST_CMD")"
  if printf '%s' "$RESP" | grep -q '"error"'; then
    # Hasura rejects `create` for an object that exists and `replace` for one
    # that does not. The plan plays the odds from the exported metadata; when it
    # guesses wrong, flip the flag and try once more rather than fail the run.
    FLIPPED="$(python3 -c '
import json, sys
o = json.loads(sys.argv[1])
if o["args"].get("replace"):
    o["args"].pop("replace")
else:
    o["args"]["replace"] = True
print(json.dumps(o))' "$OP")"
    RESP="$(printf '%s' "$FLIPPED" | run_remote "$POST_CMD")"
  fi
  # Third attempt, event triggers only: Hasura creates Postgres triggers named
  # notify_hasura_<trigger>_<OP> alongside the metadata entry. If a previous run
  # rolled the metadata back after those were created (which is what an atomic
  # bulk containing an event trigger does), Hasura is left saying "already
  # exists" to create and "does not exist" to replace and to delete, and the
  # orphaned Postgres triggers are unreachable garbage. Drop exactly those and
  # retry. Nothing else is touched.
  if printf '%s' "$RESP" | grep -q '"error"' \
     && printf '%s' "$OP" | grep -q 'pg_create_event_trigger'; then
    TRIG="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["args"]["name"])' "$OP")"
    echo "  recovering orphaned Postgres triggers for $TRIG"
    SQL_OP="$(python3 -c '
import json, sys
name = sys.argv[1]
table = json.loads(sys.argv[2])["args"]["table"]
stmts = "".join(
    f"DROP TRIGGER IF EXISTS \"notify_hasura_{name}_{op}\" ON \"{table["schema"]}\".\"{table["name"]}\";"
    for op in ("INSERT", "UPDATE", "DELETE")
)
print(json.dumps({"type": "run_sql", "args": {"source": "default", "sql": stmts}}))' "$TRIG" "$OP")"
    # run_sql is a QUERY, not a metadata operation: it lives at /v2/query.
    # Posting it to /v1/metadata is accepted and does nothing, which is how this
    # recovery silently failed the first time it was written.
    SQL_RESP="$(printf '%s' "$SQL_OP" | run_remote "$QUERY_CMD")"
    printf '%s' "$SQL_RESP" | grep -q '"error"' \
      && echo "  (cleanup SQL failed: $(printf '%s' "$SQL_RESP" | head -c 200))" >&2
    RESP="$(printf '%s' "$OP" | run_remote "$POST_CMD")"
  fi
  if printf '%s' "$RESP" | grep -q '"error"'; then
    echo "  FAILED $NAME: $(printf '%s' "$RESP" | head -c 300)" >&2
    exit 1
  fi
  echo "  ok $NAME"
  i=$((i + 1))
done
echo "Reconcile complete."
