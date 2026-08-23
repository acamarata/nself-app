"""
Purpose: Compare committed Hasura metadata against a live environment across
  EVERY layer the repo declares — table permissions, cron triggers, event
  triggers, actions, and the allowlist query collection.

Why this module exists:
  metadata-diff.sh compared table/role permissions and nothing else. It reported
  "no permission drift" on staging and production throughout the period when
  100% of the declared event triggers were absent from both (2026-08-24 review).
  A drift signal that measures one layer and prints green is worse than no
  signal, because it is believed.

Inputs:  the repo's backend/hasura/metadata directory and a live export_metadata
         JSON document.
Outputs: a list of (category, message) drift entries. Empty means clean.

Constraints:
  - Objects that exist only in the live environment are IGNORED for tables
    (hasura-auth owns refresh_tokens, roles, user_providers, ... — the repo does
    not declare them and a "replace" would untrack them). For cron triggers,
    event triggers and actions the repo IS the whole story, so live-only objects
    are reported: an unowned trigger firing at a webhook nobody declared is
    exactly the drift worth knowing about.
  - Comparison is on the fields the repo actually controls. Hasura fills in
    defaults (retry_interval_seconds, cleanup_config, ...) and comparing those
    raw produces noise, and a noisy tool gets ignored.
  - Webhook templates ({{ACTION_HANDLER_URL}}) are compared literally: Hasura
    stores the template, not the resolved URL, so the strings must match.

SPORT: F08 backend — metadata drift detection.
"""

from __future__ import annotations

import json
import os
from typing import Any

DRIFT = list[tuple[str, str]]

# ── permissions (unchanged behaviour, moved here) ────────────────────────────

PERM_DEFAULTS = {
    "allow_aggregations": False, "computed_fields": [], "columns": [],
    "set": {}, "backend_only": False, "filter": {}, "check": {},
}
PERM_KINDS = ("insert_permissions", "select_permissions",
              "update_permissions", "delete_permissions")


def _norm_perm(p: dict[str, Any] | None) -> str | None:
    if p is None:
        return None
    out = dict(p)
    for k, v in PERM_DEFAULTS.items():
        if out.get(k) is None:
            out[k] = v
    out.pop("comment", None)
    if isinstance(out.get("columns"), list):
        out["columns"] = sorted(out["columns"])
    return json.dumps(out, sort_keys=True)


def compare_permissions(repo_tables: list[dict], live_tables: list[dict]) -> DRIFT:
    drift: DRIFT = []
    ltab = {t["table"]["name"]: t for t in live_tables}
    rtab = {t["table"]["name"]: t for t in repo_tables}

    for name in sorted(set(rtab) - set(ltab)):
        drift.append(("permissions", f"{name}: in repo, NOT tracked in the environment"))

    for name in sorted(set(rtab) & set(ltab)):
        for kind in PERM_KINDS:
            r = {p["role"]: p["permission"] for p in rtab[name].get(kind, [])}
            l = {p["role"]: p["permission"] for p in ltab[name].get(kind, [])}
            for role in sorted(set(r) - set(l)):
                drift.append(("permissions",
                              f"{name}.{kind}[{role}]: defined in repo, MISSING in the environment"))
            for role in sorted(set(l) - set(r)):
                drift.append(("permissions",
                              f"{name}.{kind}[{role}]: present in the environment, not in repo"))
            for role in sorted(set(r) & set(l)):
                if _norm_perm(r[role]) == _norm_perm(l[role]):
                    continue
                rc, lc = set(r[role].get("columns") or []), set(l[role].get("columns") or [])
                detail = []
                if rc - lc:
                    detail.append(f"columns missing live: {sorted(rc - lc)}")
                if lc - rc:
                    detail.append(f"extra columns live: {sorted(lc - rc)}")
                for field in ("check", "filter"):
                    if json.dumps(r[role].get(field) or {}, sort_keys=True) != \
                       json.dumps(l[role].get(field) or {}, sort_keys=True):
                        detail.append(f"row {field} DIFFERS")
                if (r[role].get("set") or {}) != (l[role].get("set") or {}):
                    detail.append("column presets DIFFER")
                drift.append(("permissions",
                              f"{name}.{kind}[{role}]: " + "; ".join(detail or ["differs"])))
    return drift


# ── cron triggers ────────────────────────────────────────────────────────────

def _norm_headers(headers: list[dict] | None) -> str:
    """Header identity is (name, env-var-or-literal). Order is not meaningful."""
    items = []
    for h in headers or []:
        items.append((h.get("name"), h.get("value_from_env") or h.get("value")))
    return json.dumps(sorted(items), sort_keys=True)


def _norm_cron(c: dict[str, Any]) -> dict[str, Any]:
    return {
        "webhook": c.get("webhook"),
        "schedule": c.get("schedule"),
        "payload": c.get("payload") or {},
        "headers": _norm_headers(c.get("headers")),
        "include_in_metadata": c.get("include_in_metadata", True),
    }


def compare_cron(repo: list[dict], live: list[dict]) -> DRIFT:
    drift: DRIFT = []
    r = {c["name"]: c for c in repo}
    l = {c["name"]: c for c in live}
    for name in sorted(set(r) - set(l)):
        drift.append(("cron_triggers", f"{name}: declared in repo, MISSING in the environment"))
    for name in sorted(set(l) - set(r)):
        drift.append(("cron_triggers", f"{name}: live in the environment, not declared in repo"))
    for name in sorted(set(r) & set(l)):
        rn, ln = _norm_cron(r[name]), _norm_cron(l[name])
        for field in sorted(rn):
            if rn[field] != ln[field]:
                drift.append(("cron_triggers",
                              f"{name}.{field}: repo={rn[field]!r} live={ln[field]!r}"))
    return drift


# ── event triggers ───────────────────────────────────────────────────────────

def _norm_op(op: Any) -> Any:
    """An operation is either absent, columns:'*', or a sorted column list."""
    if op is None:
        return None
    cols = op.get("columns") if isinstance(op, dict) else op
    if cols == "*":
        return "*"
    return sorted(cols or [])


def _norm_event(e: dict[str, Any]) -> dict[str, Any]:
    defn = e.get("definition", e)
    return {
        "webhook": e.get("webhook") or e.get("webhook_from_env"),
        "insert": _norm_op(defn.get("insert")),
        "update": _norm_op(defn.get("update")),
        "delete": _norm_op(defn.get("delete")),
        "headers": _norm_headers(e.get("headers")),
        "num_retries": (e.get("retry_conf") or {}).get("num_retries"),
    }


def compare_event_triggers(repo: list[dict], live_tables: list[dict]) -> DRIFT:
    """repo entries are the flat event_triggers.yaml shape; live ones hang off tables."""
    drift: DRIFT = []
    r = {e["name"]: (f'{e["table"].get("schema","public")}.{e["table"]["name"]}', e)
         for e in repo}
    l: dict[str, tuple[str, dict]] = {}
    for t in live_tables:
        for e in t.get("event_triggers") or []:
            l[e["name"]] = (f'{t["table"].get("schema","public")}.{t["table"]["name"]}', e)

    for name in sorted(set(r) - set(l)):
        drift.append(("event_triggers",
                      f"{name} (on {r[name][0]}): declared in repo, MISSING in the environment"))
    for name in sorted(set(l) - set(r)):
        drift.append(("event_triggers",
                      f"{name} (on {l[name][0]}): live in the environment, not declared in repo"))
    for name in sorted(set(r) & set(l)):
        if r[name][0] != l[name][0]:
            drift.append(("event_triggers",
                          f"{name}.table: repo={r[name][0]} live={l[name][0]}"))
        rn, ln = _norm_event(r[name][1]), _norm_event(l[name][1])
        for field in sorted(rn):
            if rn[field] != ln[field]:
                drift.append(("event_triggers",
                              f"{name}.{field}: repo={rn[field]!r} live={ln[field]!r}"))
    return drift


# ── actions ──────────────────────────────────────────────────────────────────

def _norm_action(a: dict[str, Any]) -> dict[str, Any]:
    d = a.get("definition") or {}
    return {
        "handler": d.get("handler"),
        "kind": d.get("kind") or "synchronous",
        "type": d.get("type") or "mutation",
        "forward_client_headers": bool(d.get("forward_client_headers")),
        # Headers are the action's authentication. Every live action carried an
        # EMPTY header list while the repo declared the shared webhook secret on
        # all 22 (found 2026-08-24 the moment the secret was actually set: every
        # action answered 401 INVALID_WEBHOOK_SECRET). Comparing only the handler
        # made that invisible.
        "headers": _norm_headers(d.get("headers")),
        # Hasura omits timeout from the export when it equals the default (30),
        # exactly like the permission defaults above. Comparing raw would report
        # every default-timeout action as drift forever.
        "timeout": d.get("timeout") if d.get("timeout") is not None else 30,
    }


def compare_actions(repo: list[dict], live: list[dict]) -> DRIFT:
    drift: DRIFT = []
    r = {a["name"]: a for a in repo}
    l = {a["name"]: a for a in live}
    for name in sorted(set(r) - set(l)):
        drift.append(("actions", f"{name}: declared in repo, MISSING in the environment"))
    for name in sorted(set(l) - set(r)):
        drift.append(("actions", f"{name}: live in the environment, not declared in repo"))
    for name in sorted(set(r) & set(l)):
        rn, ln = _norm_action(r[name]), _norm_action(l[name])
        for field in sorted(rn):
            if rn[field] != ln[field]:
                drift.append(("actions", f"{name}.{field}: repo={rn[field]!r} live={ln[field]!r}"))
    return drift


# ── query collections / allowlist ────────────────────────────────────────────

def compare_collections(repo: list[dict], live: list[dict],
                        repo_allowlist: list[dict], live_allowlist: list[dict] | None) -> DRIFT:
    drift: DRIFT = []
    r = {c["name"]: {q["name"] for q in (c.get("definition") or {}).get("queries") or []}
         for c in repo}
    l = {c["name"]: {q["name"] for q in (c.get("definition") or {}).get("queries") or []}
         for c in live}
    for name in sorted(set(r) - set(l)):
        drift.append(("query_collections", f"{name}: declared in repo, MISSING in the environment"))
    for name in sorted(set(l) - set(r)):
        drift.append(("query_collections", f"{name}: live in the environment, not declared in repo"))
    for name in sorted(set(r) & set(l)):
        missing, extra = sorted(r[name] - l[name]), sorted(l[name] - r[name])
        if missing:
            drift.append(("query_collections", f"{name}: {len(missing)} operation(s) missing live: {missing[:5]}"))
        if extra:
            drift.append(("query_collections", f"{name}: {len(extra)} operation(s) live but not in repo: {extra[:5]}"))

    ra = {c["collection"] for c in repo_allowlist or []}
    la = {c["collection"] for c in live_allowlist or []}
    for name in sorted(ra - la):
        drift.append(("allowlist", f"{name}: in repo allowlist, NOT in the environment allowlist"))
    for name in sorted(la - ra):
        drift.append(("allowlist", f"{name}: in the environment allowlist, not in repo"))
    return drift


# ── entry point ──────────────────────────────────────────────────────────────

def load_repo(meta_dir: str) -> dict[str, Any]:
    import yaml

    def read(rel: str, default: Any) -> Any:
        path = os.path.join(meta_dir, rel)
        if not os.path.exists(path):
            return default
        with open(path) as fh:
            return yaml.safe_load(fh) or default

    return {
        "tables": read("databases/default/tables/tables.yaml", []),
        "cron_triggers": read("cron_triggers.yaml", []),
        "event_triggers": read("event_triggers.yaml", []),
        "actions": (read("actions.yaml", {}) or {}).get("actions", []),
        "query_collections": read("query_collections.yaml", []),
        "allowlist": read("allowlist.yaml", []),
    }


def compare(repo: dict[str, Any], live: dict[str, Any]) -> DRIFT:
    live = live.get("metadata", live)
    sources = live.get("sources") or []
    live_tables = [t for s in sources for t in s.get("tables") or []]
    return (
        compare_permissions(repo["tables"], live_tables)
        + compare_cron(repo["cron_triggers"], live.get("cron_triggers") or [])
        + compare_event_triggers(repo["event_triggers"], live_tables)
        + compare_actions(repo["actions"], live.get("actions") or [])
        + compare_collections(repo["query_collections"], live.get("query_collections") or [],
                              repo["allowlist"], live.get("allowlist"))
    )
