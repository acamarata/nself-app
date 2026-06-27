-- Migration 011 rollback: Remove np_attachments table
DROP TABLE IF EXISTS public.np_attachments CASCADE;
