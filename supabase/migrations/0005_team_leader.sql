-- Team leader contact fields, used for result/notification emails.
-- Nullable so existing teams are unaffected; the Add-team form requires them
-- for new teams. Apply before deploying the code that reads these columns.

alter table teams add column if not exists team_leader_name text;
alter table teams add column if not exists team_leader_email text;
