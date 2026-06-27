-- Migration 017 rollback: Remove np_device_tokens table
DROP TABLE IF EXISTS public.np_device_tokens CASCADE;
