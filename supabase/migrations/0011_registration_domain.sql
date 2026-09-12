-- The problem statement's domain, asked for on the public registration form
-- underneath the statement itself (SIH teams pick a domain such as "Smart
-- Automation" or "MedTech").
--
-- Nullable, so registrations taken before this are unaffected. When the
-- registration becomes a team the domain is carried into `teams.track`, which
-- is the same idea under the name the rest of the app already uses.
--
-- Safe to run once on an existing database.

alter table registrations add column if not exists domain text;
