-- Functions and triggers for HackScore.

-- Create a profile row automatically when a new auth user signs up.
-- role/full_name can be passed via auth metadata; defaults to 'judge'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'judge')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep evaluations.updated_at fresh on direct updates.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_eval_updated_at on evaluations;
create trigger trg_eval_updated_at
  before update on evaluations
  for each row execute function public.touch_updated_at();

-- Recompute an evaluation's total whenever its per-criterion scores change.
create or replace function public.recompute_evaluation_total()
returns trigger
language plpgsql
as $$
declare
  eid uuid := coalesce(new.evaluation_id, old.evaluation_id);
begin
  update evaluations
    set total_score = (
      select coalesce(sum(score), 0)
      from evaluation_scores
      where evaluation_id = eid
    )
  where id = eid;
  return null;
end;
$$;

drop trigger if exists trg_scores_recompute on evaluation_scores;
create trigger trg_scores_recompute
  after insert or update or delete on evaluation_scores
  for each row execute function public.recompute_evaluation_total();

-- Helper functions used by RLS policies. SECURITY DEFINER so they can read
-- profiles without tripping the profiles RLS policy (avoids recursion).
create or replace function public.current_user_role()
returns user_role
language sql
stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;
