-- Migration 013 rollback: Remove np_reminders table
DROP TABLE IF EXISTS public.np_reminders CASCADE;
