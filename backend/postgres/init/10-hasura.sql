-- Hasura Initialization
--
-- Runs against whichever database POSTGRES_DB names (docker-entrypoint-initdb.d
-- connects init scripts to that DB already — never \c to a hardcoded name here,
-- or this runs against the wrong database when POSTGRES_DB != "nself").

-- Create Hasura catalog schema
CREATE SCHEMA IF NOT EXISTS hdb_catalog;

-- Create Hasura views schema
CREATE SCHEMA IF NOT EXISTS hdb_views;

-- Grant permissions
GRANT ALL ON SCHEMA hdb_catalog TO postgres;
GRANT ALL ON SCHEMA hdb_views TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA hdb_catalog TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA hdb_catalog TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA hdb_catalog TO postgres;
