-- 029_member_profiles_view.sql
--
-- Purpose: Give collaborators a way to see each other's display name and avatar
--          WITHOUT exposing anybody's email address.
--
-- The defect this closes:
--   The clients render a list's member roster from a `profile` field on
--   np_list_members / np_list_presence (backend/apps/mobile/src/lib/collabOps.ts
--   GET_LIST_MEMBERS, GET_LIST_PRESENCE, SUBSCRIBE_LIST_PRESENCE). That
--   relationship was never defined in Hasura metadata, so every one of those
--   documents failed validation outright — the members panel and the presence
--   strip could not render at all.
--
-- Why a view, and not just a relationship to np_profiles:
--   1. np_profiles carries `email`. A security fix (PR #95) had just scoped both
--      auth.users and np_profiles for role `user` to `id = X-Hasura-User-Id`
--      precisely so one user cannot read another's email. Pointing the
--      relationship at np_profiles and widening that filter to co-members would
--      re-open exactly the hole that was closed — Hasura applies the target
--      table's permission on relationship traversal, so the only way to make the
--      join resolve is to widen it.
--   2. Hasura allows ONE select permission per role per table, so np_profiles
--      cannot serve "own row incl. email" and "co-member row excl. email" at the
--      same time.
--   3. Widening np_profiles would also break the profile read path: GET_PROFILE
--      (@nself/ntask-core operations/profiles.ts) selects `np_profiles` with no
--      where clause and takes row [0], relying on the own-row filter to return
--      exactly one row. With co-members visible it could return someone else's
--      profile as the signed-in user's.
--
--   This view therefore exposes ONLY non-sensitive display fields. `email` is not
--   a column of it, so no permission mistake, relationship, or future column
--   addition on np_profiles can leak an address through this path — the guarantee
--   is structural rather than a filter that has to stay correct.
--
-- Security note on security_invoker:
--   Deliberately NOT set. np_profiles has row security disabled (see
--   PLAN-profile-dedupe.md), so there is no RLS policy for an invoker check to
--   apply; access control for this view lives entirely in the Hasura select
--   permission attached to it (see hasura/metadata/.../tables.yaml), which scopes
--   rows to the caller plus the members of lists the caller shares.
--
-- Reversible: down migration drops the view only. No data is touched.

-- display_name is NULLED OUT when it is just the email address.
--
-- Dropping the `email` column is not by itself enough: hasura-auth seeds
-- auth.users.display_name with the signup email when the client sends no
-- displayName, and np_profiles' on-signup trigger copies that straight across.
-- Verified on a freshly signed-up user: display_name = 'someone@example.com'.
-- Exposing that to co-members would hand out the address through the "safe"
-- column and defeat the whole point of this view. Clients already fall back to
-- a masked "User …<last 6 of id>" label when display_name is null
-- (apps/mobile/src/components/AssigneeSelector.tsx), so a user who has not
-- chosen a display name stays anonymous to collaborators until they pick one.
CREATE OR REPLACE VIEW public.np_member_profiles AS
SELECT
  p.id,
  CASE
    WHEN p.display_name IS NULL THEN NULL
    WHEN p.email IS NOT NULL AND lower(p.display_name) = lower(p.email) THEN NULL
    WHEN p.display_name LIKE '%@%' THEN NULL
    ELSE p.display_name
  END AS display_name,
  p.avatar_url,
  p.source_account_id,
  p.updated_at
FROM public.np_profiles p;

COMMENT ON VIEW public.np_member_profiles IS
  'Non-sensitive collaborator identity (no email) for list member/presence joins. See migration 029.';

-- Hasura connects as the database owner in every nTask environment; the explicit
-- grant keeps the view usable if that ever changes to a lower-privileged role.
GRANT SELECT ON public.np_member_profiles TO PUBLIC;
