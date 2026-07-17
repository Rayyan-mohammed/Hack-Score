-- Seed 1 admin + 5 evaluators (judges) for local/dev testing.
-- Run this in the Supabase SQL Editor AFTER applying the migrations
-- (0001, 0002, 0003). It creates real accounts you can log in with.
--
-- These are throwaway dev passwords — change them for anything real.

-- Helper: create an auth user (+ email identity) and set their profile role.
-- Idempotent: if the email already exists it just returns that user's id.
create or replace function public.seed_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role user_role
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = lower(p_email);
  if uid is not null then
    update public.profiles
      set role = p_role, full_name = p_full_name
      where id = uid;
    return uid;
  end if;

  uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role::text),
    '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    uid, uid,
    jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  -- The on_auth_user_created trigger inserts the profile; make sure the
  -- role/name are what we asked for.
  update public.profiles
    set role = p_role, full_name = p_full_name
    where id = uid;

  return uid;
end;
$$;

-- 1 admin
select public.seed_user('admin@hackscore.test',  'Admin@123',  'Admin User',    'admin');

-- 5 evaluators (judges)
select public.seed_user('judge1@hackscore.test', 'Judge@123',  'Evaluator One',   'judge');
select public.seed_user('judge2@hackscore.test', 'Judge@123',  'Evaluator Two',   'judge');
select public.seed_user('judge3@hackscore.test', 'Judge@123',  'Evaluator Three', 'judge');
select public.seed_user('judge4@hackscore.test', 'Judge@123',  'Evaluator Four',  'judge');
select public.seed_user('judge5@hackscore.test', 'Judge@123',  'Evaluator Five',  'judge');

-- Confirm what was created:
select p.email, p.full_name, p.role
from public.profiles p
order by p.role, p.email;
