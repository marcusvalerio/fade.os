-- The production database has objects created before supabase/migrations existed
-- (see supabase/README.md, "pré-história"). Replaying the migrations on an empty
-- local database therefore misses a few of them. These are the ones the trailer's
-- code paths touch — applied to the LOCAL demo database only, never to the repo's
-- migrations.
alter table public.professional add column if not exists updated_at timestamptz not null default now();
alter table public.attendance   add column if not exists updated_at timestamptz not null default now();
create unique index if not exists cash_register_unit_id_key on public.cash_register (unit_id);
alter table public.appointment  add column if not exists updated_at timestamptz not null default now();
alter table public.company      add column if not exists updated_at timestamptz not null default now();
alter table public.company      add column if not exists status text not null default 'active';
