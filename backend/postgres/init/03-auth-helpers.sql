-- auth.uid() helper for nSelf/Hasura RLS
--
-- Hasura Auth does NOT define auth.uid() in PostgreSQL (unlike Supabase, which
-- does). All RLS policies in this stack use auth.uid() as the correct pattern
-- for reading the JWT-authenticated user ID from the Hasura session variable
-- 'hasura.user'. This function makes those policies work.
--
-- Reads: current_setting('hasura.user', true) → JSON → 'x-hasura-user-id' → UUID
-- Falls back to NULL when called outside a Hasura session (e.g., direct psql
-- admin connections), so superuser admin queries bypass RLS as expected.
--
-- Must run AFTER 01-init.sql (auth schema exists) and BEFORE any schema that
-- contains RLS policies referencing auth.uid(). File ordering: 03-*.sql.
--
-- Runs against whichever database POSTGRES_DB names (docker-entrypoint-initdb.d
-- connects init scripts to that DB already — never \c to a hardcoded name here,
-- or this function gets created in the wrong database when POSTGRES_DB !=
-- "nself", which is exactly what broke auth.uid()/RLS on staging).

CREATE SCHEMA IF NOT EXISTS auth;

-- auth.uid(): returns the UUID of the currently authenticated Hasura user.
-- Returns NULL when hasura.user is not set (non-Hasura sessions bypass RLS).
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('hasura.user', true)::json ->> 'x-hasura-user-id',
    ''
  )::uuid
$$;

-- Grant execute to all roles so RLS policies can call it
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
