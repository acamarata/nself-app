-- Migration 015 rollback: Remove np_todo_assignees table
DROP TABLE IF EXISTS public.np_todo_assignees CASCADE;
