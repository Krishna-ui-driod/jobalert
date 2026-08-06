-- Add link_url and description columns to public.notifications table
alter table public.notifications add column if not exists link_url text;
alter table public.notifications add column if not exists description text;
