-- PostgreSQL Extensions
--
-- Runs against whichever database POSTGRES_DB names (docker-entrypoint-initdb.d
-- connects init scripts to that DB already — never \c to a hardcoded name here,
-- or this runs against the wrong database when POSTGRES_DB != "nself").

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable JSONB operators (commented out - requires Python runtime)
-- CREATE EXTENSION IF NOT EXISTS "jsonb_plpython3u" CASCADE;
