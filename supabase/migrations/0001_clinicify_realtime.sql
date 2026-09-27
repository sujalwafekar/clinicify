-- Realtime migration foundation. The payload keeps the first cut compatible
-- with existing Firestore documents while the app is dual-running.

create table if not exists public.clinicify_records (
  collection_name text not null,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_name, id)
);

alter table public.clinicify_records enable row level security;
revoke all on table public.clinicify_records from anon, authenticated;

create table if not exists public.doctors (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.visits (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.queue_events (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.doctors enable row level security;
alter table public.visits enable row level security;
alter table public.queue_events enable row level security;
revoke all on table public.doctors, public.visits, public.queue_events from anon, authenticated;

-- Enable Postgres Changes without modifying the locked-down realtime schema.
do $$ begin
  alter publication supabase_realtime add table public.doctors;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.visits;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.queue_events;
exception when duplicate_object then null; end $$;
