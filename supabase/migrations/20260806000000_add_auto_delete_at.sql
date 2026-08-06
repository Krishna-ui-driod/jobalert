-- Add auto_delete_at column to public.exams table for automatic post expiration
alter table public.exams add column if not exists auto_delete_at text;
