-- PostgreSQL Initialization Script
--
-- Runs inside docker-entrypoint-initdb.d against whichever database
-- POSTGRES_DB names (Postgres itself creates that DB before any init/*.sql
-- runs, and connects these scripts to it — see the official postgres image
-- entrypoint). Do NOT \c to a hardcoded db name here: on stacks where
-- POSTGRES_DB != "nself" (e.g. ntask staging uses POSTGRES_DB=ntask), a
-- hardcoded \c nself would create/populate the WRONG database, silently
-- breaking auth.uid()/RLS in the actual app database.

-- Grant all privileges on the current (connected) database
DO $$
BEGIN
  EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE %I TO postgres', current_database());
END $$;

-- Create default schema
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Always create auth schema (required for auth service)
CREATE SCHEMA IF NOT EXISTS auth;
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO postgres;

-- Always create storage schema (may be needed later)
CREATE SCHEMA IF NOT EXISTS storage;
GRANT ALL ON SCHEMA storage TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO postgres;
