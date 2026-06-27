-- Migration 010 rollback: Remove np_comments table
DROP TABLE IF EXISTS public.np_comments CASCADE;
