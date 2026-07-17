-- HackScore initial schema
-- Entities: profiles (users), hackathons, rounds, rubric_criteria,
-- teams, team_members, round_judges, evaluations, evaluation_scores, audit_logs.

create extension if not exists "pgcrypto";

-- Roles for access control.
do $$ begin
  create type user_role as enum ('admin', 'judge');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evaluation_status as enum ('draft', 'submitted');
exception when duplicate_object then null; end $$;

-- One profile per auth user. role drives RBAC across the app.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role user_role not null default 'judge',
  created_at timestamptz not null default now()
);

create table if not exists hackathons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  venue text,
  start_date date,
  end_date date,
  banner_url text,
  min_team_size int not null default 1,
  max_team_size int not null default 6,
  is_active boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references hackathons (id) on delete cascade,
  name text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Normalized rubric: one row per criterion, tied to a round.
create table if not exists rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  name text not null,
  max_marks numeric(6,2) not null check (max_marks > 0),
  weight numeric(6,2) not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references hackathons (id) on delete cascade,
  team_code text not null,
  name text not null,
  college text,
  track text,
  mentor text,
  problem_statement text,
  created_at timestamptz not null default now(),
  unique (hackathon_id, team_code)
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  name text not null,
  email text,
  role text
);

-- Which judges are assigned to which round.
create table if not exists round_judges (
  round_id uuid not null references rounds (id) on delete cascade,
  judge_id uuid not null references profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (round_id, judge_id)
);

-- One evaluation per (round, team, judge).
create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  judge_id uuid not null references profiles (id) on delete cascade,
  status evaluation_status not null default 'draft',
  comments text,
  total_score numeric(8,2) not null default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, team_id, judge_id)
);

-- Per-criterion score inside an evaluation.
create table if not exists evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations (id) on delete cascade,
  criterion_id uuid not null references rubric_criteria (id) on delete cascade,
  score numeric(6,2) not null default 0 check (score >= 0),
  unique (evaluation_id, criterion_id)
);

-- Append-only audit trail for score changes and other admin actions.
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rounds_hackathon on rounds (hackathon_id);
create index if not exists idx_rubric_round on rubric_criteria (round_id);
create index if not exists idx_teams_hackathon on teams (hackathon_id);
create index if not exists idx_members_team on team_members (team_id);
create index if not exists idx_eval_round on evaluations (round_id);
create index if not exists idx_eval_team on evaluations (team_id);
create index if not exists idx_eval_judge on evaluations (judge_id);
create index if not exists idx_scores_eval on evaluation_scores (evaluation_id);
