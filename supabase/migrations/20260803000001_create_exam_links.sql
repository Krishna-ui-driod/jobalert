-- Create exam_links table for multiple custom links per exam
create table if not exists public.exam_links (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  label text not null,
  url text not null,
  display_order integer not null default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.exam_links enable row level security;

-- Public read access
create policy "exam_links_public_read"
  on public.exam_links for select
  using (true);

-- Authenticated write access
create policy "exam_links_auth_write"
  on public.exam_links for all
  using (auth.role() = 'authenticated');
