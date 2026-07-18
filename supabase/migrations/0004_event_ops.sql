-- HackScore "event operations" migration.
-- Adds schema for: round progression/shortlisting, tie-break overrides,
-- forced password change, soft delete + recovery, results publishing +
-- private team result links. The audit_logs table already exists (0001);
-- this only adds an index for it.
--
-- Safe to run once on an existing database. All statements are idempotent.

-- ===========================================================================
-- 1. Round progression / shortlisting
-- ---------------------------------------------------------------------------
-- Explicit per-round team membership. A round with NO rows here is treated by
-- the app as "all hackathon teams participate" (backwards-compatible: existing
-- rounds keep showing every team until an admin shortlists). Once an admin
-- promotes a subset, only those teams appear for that round.
create table if not exists round_teams (
  round_id uuid not null references rounds (id) on delete cascade,
  team_id  uuid not null references teams (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (round_id, team_id)
);
create index if not exists idx_round_teams_round on round_teams (round_id);
create index if not exists idx_round_teams_team on round_teams (team_id);

-- ===========================================================================
-- 2. Tie-break manual override
-- ---------------------------------------------------------------------------
-- Automatic tie-break order (last-round score, then highest single criterion)
-- is computed in the app. When teams are still tied, an admin can set an
-- explicit priority here (lower number ranks higher). NULL = no override.
alter table teams add column if not exists tiebreak_priority int;

-- ===========================================================================
-- 3. Forced password change on first login
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists must_change_password boolean not null default false;

-- ===========================================================================
-- 4. Soft delete + 30-day recovery
-- ---------------------------------------------------------------------------
-- Danger-Zone deletes now set deleted_at instead of removing rows. The app
-- filters deleted_at IS NULL everywhere except the Trash view, and purges
-- rows older than 30 days.
alter table hackathons add column if not exists deleted_at timestamptz;
alter table rounds     add column if not exists deleted_at timestamptz;
alter table teams      add column if not exists deleted_at timestamptz;

-- Free up a team_code for reuse once its team is soft-deleted: replace the
-- plain unique constraint with a partial unique index over live rows only.
alter table teams drop constraint if exists teams_hackathon_id_team_code_key;
create unique index if not exists uniq_teams_code_live
  on teams (hackathon_id, team_code)
  where deleted_at is null;

-- ===========================================================================
-- 5. Results publishing + private per-team result links
-- ---------------------------------------------------------------------------
alter table hackathons
  add column if not exists results_published boolean not null default false;
alter table hackathons
  add column if not exists results_published_at timestamptz;

-- Each team gets a stable, unguessable token for its private results page.
-- (gen_random_uuid() is volatile, so existing rows are backfilled per-row.)
alter table teams
  add column if not exists result_token uuid not null default gen_random_uuid();
create unique index if not exists uniq_teams_result_token
  on teams (result_token);

-- ===========================================================================
-- 6. Audit log (table exists in 0001) — index for the viewer's ordering
-- ===========================================================================
create index if not exists idx_audit_created on audit_logs (created_at desc);

-- ===========================================================================
-- RLS for the new round_teams table (mirror the config-table convention:
-- any authenticated user can read; only admins write).
-- ===========================================================================
alter table round_teams enable row level security;

drop policy if exists round_teams_select on round_teams;
create policy round_teams_select on round_teams for select
  using (auth.uid() is not null);

drop policy if exists round_teams_write on round_teams;
create policy round_teams_write on round_teams for all
  using (public.is_admin()) with check (public.is_admin());
