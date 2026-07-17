-- Row Level Security policies for HackScore.
-- Admins can do everything. Judges get read access to config data and
-- write access only to their own draft evaluations (scores lock on submit).

alter table profiles          enable row level security;
alter table hackathons        enable row level security;
alter table rounds            enable row level security;
alter table rubric_criteria   enable row level security;
alter table teams             enable row level security;
alter table team_members      enable row level security;
alter table round_judges      enable row level security;
alter table evaluations       enable row level security;
alter table evaluation_scores enable row level security;
alter table audit_logs        enable row level security;

-- profiles ---------------------------------------------------------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Config tables: any authenticated user can read; only admins write. --------
do $$
declare t text;
begin
  foreach t in array array['hackathons','rounds','rubric_criteria','teams','team_members']
  loop
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format(
      'create policy %I on %I for select using (auth.uid() is not null)',
      t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for all using (public.is_admin()) with check (public.is_admin())',
      t || '_write', t);
  end loop;
end $$;

-- round_judges -----------------------------------------------------------
drop policy if exists round_judges_select on round_judges;
create policy round_judges_select on round_judges for select
  using (public.is_admin() or judge_id = auth.uid());

drop policy if exists round_judges_write on round_judges;
create policy round_judges_write on round_judges for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluations ------------------------------------------------------------
drop policy if exists evaluations_select on evaluations;
create policy evaluations_select on evaluations for select
  using (public.is_admin() or judge_id = auth.uid());

drop policy if exists evaluations_insert on evaluations;
create policy evaluations_insert on evaluations for insert
  with check (
    public.is_admin() or (
      judge_id = auth.uid()
      and exists (
        select 1 from round_judges rj
        where rj.round_id = evaluations.round_id and rj.judge_id = auth.uid()
      )
    )
  );

-- Judges may edit only their own draft rows; submitting locks the row.
drop policy if exists evaluations_update on evaluations;
create policy evaluations_update on evaluations for update
  using (public.is_admin() or (judge_id = auth.uid() and status = 'draft'))
  with check (public.is_admin() or judge_id = auth.uid());

drop policy if exists evaluations_delete on evaluations;
create policy evaluations_delete on evaluations for delete
  using (public.is_admin());

-- evaluation_scores ------------------------------------------------------
drop policy if exists evaluation_scores_select on evaluation_scores;
create policy evaluation_scores_select on evaluation_scores for select
  using (
    public.is_admin() or exists (
      select 1 from evaluations e
      where e.id = evaluation_scores.evaluation_id and e.judge_id = auth.uid()
    )
  );

-- Scores are writable only while the parent evaluation is a draft.
drop policy if exists evaluation_scores_write on evaluation_scores;
create policy evaluation_scores_write on evaluation_scores for all
  using (
    public.is_admin() or exists (
      select 1 from evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = auth.uid() and e.status = 'draft'
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = auth.uid() and e.status = 'draft'
    )
  );

-- audit_logs -------------------------------------------------------------
drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select
  using (public.is_admin());

drop policy if exists audit_insert on audit_logs;
create policy audit_insert on audit_logs for insert
  with check (actor_id = auth.uid() or public.is_admin());
