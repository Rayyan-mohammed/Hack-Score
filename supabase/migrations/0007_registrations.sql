-- Participant registration / submission forms.
--
-- Adds: a per-hackathon problem-statement catalogue, the participant
-- registration table (draft -> auto-submit after one hour -> locked), and the
-- hackathon-level settings the confirmation page needs (WhatsApp group, PPT
-- template, resources) plus a switch to open/close registrations.
--
-- Safe to run once on an existing database. All statements are idempotent.

-- ===========================================================================
-- 1. Problem statements
-- ---------------------------------------------------------------------------
-- Predefined list a participant picks from. Choosing a ps_code auto-fills the
-- statement text on the form; participants may also type their own.
create table if not exists problem_statements (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references hackathons (id) on delete cascade,
  ps_code text not null,            -- "PS-001"
  title text not null,              -- "AI-Based Healthcare Assistant"
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (hackathon_id, ps_code)
);

create index if not exists idx_ps_hackathon
  on problem_statements (hackathon_id, sort_order);

-- ===========================================================================
-- 2. Registrations
-- ---------------------------------------------------------------------------
-- A registration starts life as a draft the moment the participant begins
-- filling the form. It stays editable for one hour (draft_expires_at); after
-- that it is auto-submitted and locked. `token` is the participant's private
-- link — it reopens their draft and, once submitted, their confirmation page.
do $$ begin
  create type registration_status as enum ('draft', 'submitted');
exception when duplicate_object then null; end $$;

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references hackathons (id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  full_name text,
  sap_id text,
  mobile text,
  college_email text,
  problem_statement_id uuid references problem_statements (id) on delete set null,
  problem_statement_code text,
  problem_statement text,
  status registration_status not null default 'draft',
  -- true when the one-hour window closed before the participant pressed Submit.
  auto_submitted boolean not null default false,
  draft_expires_at timestamptz not null default now() + interval '1 hour',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_registrations_token
  on registrations (token);
create index if not exists idx_registrations_hackathon
  on registrations (hackathon_id, created_at desc);
-- Drafts that are past due are finalised lazily on read; this index keeps that
-- sweep cheap.
create index if not exists idx_registrations_due
  on registrations (draft_expires_at)
  where status = 'draft';

-- Lookup for the duplicate-SAP-ID check the submit action runs. Deliberately
-- NOT a unique index: the one-hour auto-submit must never fail on a constraint
-- and leave a participant's draft stuck open.
create index if not exists idx_registrations_sap
  on registrations (hackathon_id, lower(sap_id));

drop trigger if exists trg_registrations_updated_at on registrations;
create trigger trg_registrations_updated_at
  before update on registrations
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 3. Hackathon settings for the public form + confirmation page
-- ===========================================================================
alter table hackathons
  add column if not exists registration_open boolean not null default true;
alter table hackathons add column if not exists whatsapp_group_url text;
alter table hackathons add column if not exists ppt_template_url text;
alter table hackathons add column if not exists resources_url text;

-- ===========================================================================
-- 4. RLS
-- ---------------------------------------------------------------------------
-- The public form is unauthenticated and writes through the service role
-- (which bypasses RLS), so no anon policy is needed here — only admins get
-- direct access to the rows. Judges have no business reading registrations.
-- ===========================================================================
alter table problem_statements enable row level security;
alter table registrations      enable row level security;

-- Problem statements are config data: any authenticated user can read them,
-- only admins write (matches rounds/teams).
drop policy if exists problem_statements_select on problem_statements;
create policy problem_statements_select on problem_statements for select
  using (auth.uid() is not null);

drop policy if exists problem_statements_write on problem_statements;
create policy problem_statements_write on problem_statements for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists registrations_admin on registrations;
create policy registrations_admin on registrations for all
  using (public.is_admin()) with check (public.is_admin());
