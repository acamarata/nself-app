# Plan: np_profiles / np_user_preferences / task_users dedupe

Status: DOCUMENTED, NOT IMPLEMENTED (no zero-risk mechanical step found — see
"Recommendation" below).

## Current schema (side by side)

| Column                 | np_profiles                  | np_user_preferences | task_users             |
|------------------------|-------------------------------|----------------------|-------------------------|
| primary key             | id (uuid, = auth.users.id)    | id (uuid, own pk)    | user_id (uuid, pk)      |
| user FK                 | id -> auth.users(id)          | user_id -> auth.users | user_id -> users(id)  |
| email                   | email                          | -                     | - (not stored)          |
| display_name            | display_name                   | -                     | display_name             |
| bio                     | bio                             | -                     | -                        |
| avatar_url              | avatar_url                     | -                     | avatar_url               |
| time_format             | time_format                    | time_format           | time_format              |
| auto_hide_completed     | auto_hide_completed            | auto_hide_completed   | auto_hide_completed      |
| default_list_id         | default_list_id                | default_list_id       | default_list_id          |
| notification_settings   | notification_settings (jsonb)  | notification_settings (jsonb, different default shape) | notification_settings (jsonb) |
| theme_preference        | theme_preference                | theme_preference      | theme_preference         |
| tos_accepted_at         | tos_accepted_at                 | -                     | tos_accepted_at          |
| tos_version             | tos_version                     | -                     | tos_version              |
| onboarding_done         | -                                | -                     | onboarding_done (bool)   |
| timezone                | -                                | -                     | timezone                 |
| prefs (jsonb catch-all) | -                                | -                     | prefs                    |
| source_account_id       | source_account_id               | source_account_id     | source_account_id        |
| created_at/updated_at   | yes                             | yes                   | yes                      |
| RLS                     | **none** (row security disabled)| yes (owner-only)      | yes (owner-only)         |
| Row count (dev, verified 2026-07-01) | 8                  | 0                     | 9                        |

Overlapping columns (present in 2+ tables): `time_format`, `auto_hide_completed`,
`default_list_id`, `notification_settings`, `theme_preference`,
`source_account_id`, `created_at`, `updated_at`. `display_name`/`avatar_url`
overlap between np_profiles and task_users. `tos_accepted_at`/`tos_version`
overlap between np_profiles and task_users only.

## How we got here

Migration `023_identity_rbac.sql` (already committed) created `task_users` as
"per-app user profile (migrated from np_profiles)" and states explicitly:
*"np_profiles data is copied to task_users; np_profiles stays as-is (no
drop)."* Migration `024_rbac_backfill.sql` completes that one-time COPY for
any np_profiles rows that missed the initial backfill. **Neither migration
sets up an ongoing sync** (no trigger, no view) — it is a single COPY at
migration time. `np_user_preferences` is not touched by either migration and
appears to be an earlier, now-superseded settings table (0 rows in dev,
suggesting no production traffic has hit its write path since task_users was
introduced, OR its write path was already broken before this — see risk below).

Frontend (`@nself/ntask-core/src/operations/profiles.ts`) still reads/writes
`np_profiles` (GET_PROFILE, UPDATE_PROFILE) and `np_user_preferences`
(GET_USER_PREFERENCES, UPDATE_PREFERENCES) exclusively. Nothing in the current
client code queries `task_users`. So today: **task_users silently drifts out
of sync** with every profile/preference edit a user makes, because writes go
to the old tables and task_users only got its one-time COPY.

## Zero-risk path (views / generated-column aliases)

Not available as a today action. A "convert np_profiles/np_user_preferences to
views over task_users" approach requires:
1. `np_profiles` has 3 columns (`email`, `bio`, `tos_*`) that `task_users`
   lacks entirely (no `email` or `bio` column on task_users) — a view can't
   backfill columns the base table doesn't store. Would need task_users
   schema additions first (non-zero-risk: alters a table already read by RBAC
   code, needs its own migration + review).
2. `np_profiles` has **RLS disabled** (`Policies (row security enabled):
   (none)` per `\d np_profiles`) while its Hasura permission columns already
   scope by session filter; task_users has RLS `user_id = auth.uid()`. A view
   over task_users would inherit view-owner permissions unless declared
   `WITH (security_invoker = true)` (PG 15+) — needs explicit verification
   this DB's PG version supports it correctly for Hasura's connection role.
3. `np_user_preferences`' `notification_settings` default JSON shape
   (`{"push","email","inApp"}`) differs from `np_profiles`'/`task_users`'
   default shape (`{"push","email","new_todo","shared_lists","due_reminders",
   "evening_reminder","evening_reminder_time"}`) — call sites may depend on
   fields the other default omits; a view can't reconcile divergent existing
   row *data* (only 0 rows currently, but that's an assumption, not a
   guarantee for staging/prod).
4. Hasura tracks np_profiles/np_user_preferences as **tables** with existing
   insert/update/delete permissions (np_profiles: none currently — see
   below; np_user_preferences: full CRUD for role user). Converting to a
   view changes them to **select-only** by default in Hasura unless
   Hasura's "views as tables" + instead-of triggers are set up — that is
   itself a non-trivial migration requiring INSTEAD OF triggers per view
   per operation (insert/update/delete), which is exactly as much surface
   area as fixing the write path directly. Not a shortcut.

Given all four blockers require either a schema change to task_users, a
security-definer decision, or per-operation INSTEAD OF triggers, there is no
mechanical zero-risk step available today. **No code was implemented for
this task; this remains documentation-only per the task's own instruction.**

## Full-risk path (recommended target, staged)

1. **Add missing columns to `task_users`:** `email` (nullable initially,
   backfill from `auth.users.email` via the same trigger pattern migration
   023 already uses for `public.users`), `bio`. (Small, additive, low-risk
   migration — does not touch existing consumers.)
2. **Cut the frontend over:** update `@nself/ntask-core/src/operations/
   profiles.ts` to read/write `task_users` instead of `np_profiles`/
   `np_user_preferences` (single `task_users` row per user replaces both
   GET_PROFILE + GET_USER_PREFERENCES with one query). This is the real
   unblocking step — until client code stops writing the old tables, any
   view/alias strategy just chases a moving target.
3. **Add Hasura permissions for `task_users` matching np_profiles/
   np_user_preferences' current column-level access** (task_users is
   already tracked per this task's DB inspection but its permission set
   should be audited/extended to match the old tables' select/update column
   lists before cutover).
4. **Reconcile any drifted data:** for any user whose np_profiles/
   np_user_preferences row was edited after their one-time task_users COPY,
   run a one-time reconciliation UPDATE (COALESCE-merge, prefer the more
   recently `updated_at` source per column) before considering task_users
   authoritative.
5. **Deprecate, do not drop, np_profiles/np_user_preferences**: turn them
   into thin read-only views over task_users (now safe, since task_users has
   every column and is the only write target) for any external code/reports
   still joining on the old names, with a removal date once zero real
   traffic hits them (verify via query logs, not assumption).
6. Never DROP TABLE without a separate, explicitly authorized follow-up —
   per repo destructive-operation guardrails.

## Recommendation

Proceed with the full-risk path above as its own planned epic/ticket (not a
side-effect of this task), starting with step 1 (additive columns) and step 2
(frontend cutover) since those are independently low-risk and unblock
everything else. Do NOT attempt the "convert to views now" shortcut — the
column gaps (`email`/`bio` missing from task_users) and default-shape
divergence in `notification_settings` make it unsafe without the additive
migration first.
