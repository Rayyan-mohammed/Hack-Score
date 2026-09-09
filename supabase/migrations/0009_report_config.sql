-- Institution / letterhead / signatory settings for the official evaluation
-- report (PDF + Excel).
--
-- One jsonb blob rather than fifteen columns: it is presentation metadata for
-- the report header, footer and signature block — never queried or joined on.
-- The app fills missing keys with defaults, so an empty object is valid.
--
-- Safe to run once on an existing database.

alter table hackathons
  add column if not exists report_config jsonb not null default '{}'::jsonb;
