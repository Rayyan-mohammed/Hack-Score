-- Hackathon sponsors: name, logo, display label and ordering.
-- Scoped per hackathon (a sponsor of one event doesn't appear in another).

create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references hackathons (id) on delete cascade,
  name text not null,
  logo_url text not null,
  label text not null,              -- "Powered by", "Sponsored by", …
  sort_order int not null,          -- 1 = title sponsor (shown largest/first)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Two sponsors can't share a slot in the same hackathon (guards against two
  -- admins adding at once); the app defaults new sponsors to max+1.
  unique (hackathon_id, sort_order)
);

create index if not exists idx_sponsors_hackathon on sponsors (hackathon_id, sort_order);

-- Keep updated_at fresh (reuses the trigger fn from 0002).
drop trigger if exists trg_sponsors_updated_at on sponsors;
create trigger trg_sponsors_updated_at
  before update on sponsors
  for each row execute function public.touch_updated_at();

-- RLS: any authenticated user can read; only admins write (matches the other
-- config tables like teams/rounds).
alter table sponsors enable row level security;

drop policy if exists sponsors_select on sponsors;
create policy sponsors_select on sponsors for select
  using (auth.uid() is not null);

drop policy if exists sponsors_write on sponsors;
create policy sponsors_write on sponsors for all
  using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- Storage bucket for sponsor logos.
-- Public so the logo URLs render on the leaderboard (and later in the PDF
-- report / projector view). Uploads happen server-side with the service role,
-- so no client-facing write policy is needed.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do nothing;
