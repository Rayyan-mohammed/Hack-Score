-- Team details captured by the public registration form.
--
-- The registrant is the team leader; `members` uses the same semicolon-
-- separated format as the admin Add-team form and the CSV import, and is
-- validated against the hackathon's min/max team size. `team_id` is set once
-- the registration has been turned into a team, and doubles as the guard that
-- stops a resubmit or a late auto-submit creating a duplicate.
--
-- Safe to run once on an existing database. All statements are idempotent.

alter table registrations add column if not exists team_name text;
alter table registrations add column if not exists members text;
alter table registrations
  add column if not exists team_id uuid references teams (id) on delete set null;

create index if not exists idx_registrations_team on registrations (team_id);
