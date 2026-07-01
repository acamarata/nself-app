-- Database Schemas
--
-- Runs against whichever database POSTGRES_DB names (docker-entrypoint-initdb.d
-- connects init scripts to that DB already — never \c to a hardcoded name here,
-- or this runs against the wrong database when POSTGRES_DB != "nself").

-- Create auth schema if auth is enabled
CREATE SCHEMA IF NOT EXISTS auth;

-- Create storage schema if storage is enabled
CREATE SCHEMA IF NOT EXISTS storage;

-- Create Hasura schema
CREATE SCHEMA IF NOT EXISTS hdb_catalog;

-- Grant permissions
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON SCHEMA storage TO postgres;
GRANT ALL ON SCHEMA hdb_catalog TO postgres;
