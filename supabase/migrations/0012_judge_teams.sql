-- Which teams a particular judge scores in a round.
--
-- Mirrors the round_teams convention: a judge with NO rows here for a round
-- scores every team in that round (what happened before this table existed),
-- and as soon as an admin ticks a subset, that judge sees only those teams.
-- So two judges can split the field between them.
--
-- The restriction is applied by the app, exactly like the round_teams
-- shortlist; RLS still lets a judge read only their own rows.
--
-- Safe to run once on an existing database.

create table if not exists judge_teams (
  round_id uuid not null references rounds (id) on delete cascade,
  judge_id uuid not null references profiles (id) on delete cascade,
  team_id  uuid not null references teams (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (round_id, judge_id, team_id)
);

create index if not exists idx_judge_teams_round_judge
  on judge_teams (round_id, judge_id);
create index if not exists idx_judge_teams_team on judge_teams (team_id);

alter table judge_teams enable row level security;

-- A judge may read their own assignments; admins read everything.
drop policy if exists judge_teams_select on judge_teams;
create policy judge_teams_select on judge_teams for select
  using (public.is_admin() or judge_id = auth.uid());

drop policy if exists judge_teams_write on judge_teams;
create policy judge_teams_write on judge_teams for all
  using (public.is_admin()) with check (public.is_admin());
