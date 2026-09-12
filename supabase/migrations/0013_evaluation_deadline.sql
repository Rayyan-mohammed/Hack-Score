-- Scoring deadline for an event, plus a record of which evaluations were
-- closed by it rather than by the judge.
--
-- A judge who saves a draft and forgets to press Submit would otherwise leave
-- the team unscored for good — a draft counts for nothing. Once the deadline
-- passes, every remaining draft is submitted as it stands, exactly like the
-- one-hour window on the participant registration form.
--
-- `evaluation_deadline` is nullable and nothing happens while it is null, so
-- an event without one behaves exactly as before.
--
-- Safe to run once on an existing database.

alter table hackathons
  add column if not exists evaluation_deadline timestamptz;

alter table evaluations
  add column if not exists auto_submitted boolean not null default false;

-- The sweep finds drafts by round, so keep that lookup cheap.
create index if not exists idx_evaluations_status_round
  on evaluations (status, round_id);
