-- Run this in the Supabase SQL editor to create/update tables and lock down access.
-- After this, only your app (using SUPABASE_SERVICE_ROLE_KEY in API routes) can access data.
-- The anon key has no RLS policies, so direct client access to the DB is blocked.
--
-- Required env (in .env.local; keep SUPABASE_SERVICE_ROLE_KEY server-only):
--   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   (used if you add client-side Supabase later)
--   SUPABASE_SERVICE_ROLE_KEY=eyJ...     (required for API; Dashboard → Settings → API)

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

alter table public.saved_routes enable row level security;

-- Remove permissive anon policies so anon key cannot access data
drop policy if exists "Allow insert" on public.saved_routes;
drop policy if exists "Allow select" on public.saved_routes;
drop policy if exists "Allow delete" on public.saved_routes;

-- Route feedback: thumbs and tags per (saved_route_id, route_option_id)
create table if not exists public.route_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  saved_route_id uuid not null references public.saved_routes(id) on delete cascade,
  route_option_id text not null,
  thumbs smallint not null check (thumbs in (1, -1, 0)),
  tag text
);

alter table public.route_feedback enable row level security;

drop policy if exists "Allow insert feedback" on public.route_feedback;
drop policy if exists "Allow select feedback" on public.route_feedback;

-- No policies for anon: only service role (used by your API) can read/write.
-- Service role bypasses RLS by default in Supabase.
