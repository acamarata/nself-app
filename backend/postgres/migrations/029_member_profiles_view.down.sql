-- 029_member_profiles_view.down.sql
--
-- Reverses 029_member_profiles_view.sql. Untrack np_member_profiles in Hasura
-- (and remove the `profile` relationships on np_list_members / np_list_presence)
-- BEFORE running this, or metadata will be left inconsistent.

DROP VIEW IF EXISTS public.np_member_profiles;
