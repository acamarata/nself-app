-- Migration 012 rollback: Remove np_tags + np_todo_tags tables
DROP TABLE IF EXISTS public.np_todo_tags CASCADE;
DROP TABLE IF EXISTS public.np_tags CASCADE;
