"""
Purpose: Turn backend/hasura/metadata/actions.graphql into the metadata-API
  payloads needed to CREATE actions on an environment that has none.

Why this module exists:
  actions.yaml declares the operational half of each action (handler, headers,
  timeout, permissions); the SIGNATURE — arguments, output type, and the object
  types those outputs refer to — lives only in the SDL, which the Hasura CLI
  normally compiles. metadata-reconcile could therefore keep existing actions in
  sync but could not create a missing one, so a fresh install came up with 26
  tracked tables, 4 cron triggers, 2 event triggers and ZERO of the 22 actions
  (found by the 2026-08-24 fork drill). The only documented alternative,
  `hasura metadata apply`, is the full replace this repo forbids because it
  untracks hasura-auth's own tables.

Inputs:  the SDL text and the parsed actions.yaml entries.
Outputs: `set_custom_types` args, and one create_action payload per action.

Constraints:
  - Deliberately narrow. This project's SDL contains object types plus a
    Mutation and a Query block, and nothing else. Encountering `input`, `enum`,
    `scalar`, interfaces or unions raises rather than silently dropping them,
    because a silently missing type is a broken action at runtime.
  - Descriptions (triple-quoted strings) and # comments are stripped; Hasura
    does not need them and they complicate nothing else.

SPORT: F08 backend — Hasura action creation.
"""

from __future__ import annotations

import re
from typing import Any

_TRIPLE = re.compile(r'"""(?:.|\n)*?"""')
_COMMENT = re.compile(r'^\s*#.*$', re.M)
_BLOCK = re.compile(r'^(type|input|enum|scalar|interface|union)\s+(\w+)[^{]*\{([^}]*)\}', re.M)

UNSUPPORTED = ("input", "enum", "scalar", "interface", "union")


def _strip(sdl: str) -> str:
    return _COMMENT.sub("", _TRIPLE.sub("", sdl))


def _split_fields(body: str) -> list[str]:
    """One field per entry, tolerating arguments that contain commas."""
    fields, depth, current = [], 0, ""
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "\n" and depth == 0:
            if current.strip():
                fields.append(current.strip())
            current = ""
        else:
            current += ch
    if current.strip():
        fields.append(current.strip())
    return fields


_FIELD = re.compile(r'^(\w+)\s*(?:\(([^)]*)\))?\s*:\s*(.+?)\s*$')


def _parse_args(arg_text: str | None) -> list[dict[str, str]]:
    if not arg_text or not arg_text.strip():
        return []
    args = []
    for chunk in arg_text.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        name, _, typ = chunk.partition(":")
        args.append({"name": name.strip(), "type": typ.strip()})
    return args


def parse_sdl(sdl: str) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Return (custom object types, {action name: {arguments, output_type, type}})."""
    text = _strip(sdl)
    objects: list[dict[str, Any]] = []
    operations: dict[str, dict[str, Any]] = {}

    for kind, name, body in _BLOCK.findall(text):
        if kind in UNSUPPORTED:
            raise ValueError(
                f"actions.graphql declares `{kind} {name}`, which this parser does not "
                f"handle. Extend actions_sdl.py rather than letting it be dropped."
            )
        if name in ("Mutation", "Query"):
            op_type = "mutation" if name == "Mutation" else "query"
            for field in _split_fields(body):
                m = _FIELD.match(field)
                if not m:
                    continue
                fname, fargs, fout = m.groups()
                operations[fname] = {
                    "type": op_type,
                    "arguments": _parse_args(fargs),
                    "output_type": fout.strip(),
                }
            continue

        fields = []
        for field in _split_fields(body):
            m = _FIELD.match(field)
            if m:
                fields.append({"name": m.group(1), "type": m.group(3).strip()})
        objects.append({"name": name, "fields": fields})

    return objects, operations


def build_action_payloads(
    sdl: str, repo_actions: list[dict[str, Any]], missing: set[str]
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """
    Returns (set_custom_types op, [create_action + permission ops]) for `missing`.

    set_custom_types REPLACES the custom-type document, so every object type the
    SDL declares is sent, not just the ones the missing actions reference.
    """
    objects, operations = parse_sdl(sdl)
    if not missing:
        return None, []

    ops: list[dict[str, Any]] = []
    for action in repo_actions:
        name = action["name"]
        if name not in missing:
            continue
        sig = operations.get(name)
        if sig is None:
            raise ValueError(
                f"action {name} is declared in actions.yaml but has no field in "
                f"actions.graphql, so its signature is unknown."
            )
        definition = dict(action.get("definition") or {})
        definition.update({
            "type": sig["type"],
            "arguments": sig["arguments"],
            "output_type": sig["output_type"],
            "kind": definition.get("kind") or "synchronous",
        })
        args: dict[str, Any] = {"name": name, "definition": definition}
        if action.get("comment"):
            args["comment"] = action["comment"]
        ops.append({"type": "create_action", "args": args})
        for perm in action.get("permissions") or []:
            ops.append({"type": "create_action_permission",
                        "args": {"action": name, "role": perm["role"]}})

    return {"type": "set_custom_types", "args": {"objects": objects}}, ops
