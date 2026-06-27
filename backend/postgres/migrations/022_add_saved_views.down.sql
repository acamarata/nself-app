-- Rollback Migration 022: np_saved_views
DROP TABLE IF EXISTS public.np_saved_views CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at_saved_views() CASCADE;
