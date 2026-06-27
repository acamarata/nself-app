-- Migration 009 rollback: Remove np_subtasks table
DROP TABLE IF EXISTS public.np_subtasks CASCADE;
