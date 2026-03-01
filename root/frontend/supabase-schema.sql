-- Run this in the Supabase SQL editor to create the saved_routes table.
-- Then in Table Editor > saved_routes > RLS: enable "Enable read access for all users" and
-- "Enable insert for all users" (or add policies as needed).

create table if not exists public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  name text,
  start_lat double precision not null,
  start_lng double precision not null,
  target_distance_km double precision not null,
  distance_unit text default 'km',
  metrics jsonb default '{}',
  routes jsonb not null
);

-- Optional: allow anyone to insert and read (for anonymous save/share)
alter table public.saved_routes enable row level security;

create policy "Allow insert" on public.saved_routes for insert with check (true);
create policy "Allow select" on public.saved_routes for select using (true);
