-- Migration 014 rollback: Remove np_recurring_rules table and rrule_frequency type
DROP TABLE IF EXISTS public.np_recurring_rules CASCADE;
DROP TYPE IF EXISTS public.rrule_frequency CASCADE;
