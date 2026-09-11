-- Two small additions behind the participant-facing resources card and the
-- admin Teams table. Safe to run once on an existing database — every
-- statement is idempotent.

-- ===========================================================================
-- 1. Problem statement ID on teams.
-- Registrations already carry the code the participant picked (PS-001, …);
-- the team made from a registration only kept the free-text statement, so the
-- admin Teams list had no ID to show. Nullable: teams added before this, and
-- CSV rows without the column, are unaffected.
-- ===========================================================================
alter table teams add column if not exists problem_statement_code text;

-- ===========================================================================
-- 2. Storage bucket for event resources (the PPT template, mainly).
-- Public so participants can download straight from their confirmation page
-- without an account. Uploads happen server-side with the service role behind
-- requireAdmin, exactly like sponsor-logos, so no client write policy exists.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('event-resources', 'event-resources', true)
on conflict (id) do nothing;