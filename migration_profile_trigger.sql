-- ============================================================
-- Migration: profile auto-creation via trigger
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================
--
-- WHY: profiles used to be inserted directly from the browser, right
-- after calling supabase.auth.signUp(). That worked fine while Confirm
-- Email was OFF, because signUp() returns an active session immediately,
-- so auth.uid() is populated and the profiles RLS insert policy
-- (WITH CHECK auth.uid() = id) passes.
--
-- With Confirm Email ON, signUp() does NOT return a session until the
-- user clicks the confirmation link — so the browser is still
-- unauthenticated at that moment, auth.uid() is null, and the insert
-- fails with "new row violates row-level security policy for table
-- profiles".
--
-- FIX: create the profiles row via a database trigger on auth.users
-- instead, running as SECURITY DEFINER (bypasses RLS). This works
-- identically whether or not Confirm Email is enabled, since it fires
-- at the moment auth.users gets the new row, independent of any
-- client-side session state.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, role, full_name, username, mobile_number, email)
    values (
      new.id,
      'examinee',
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      coalesce(new.raw_user_meta_data->>'username', ''),
      new.raw_user_meta_data->>'mobile_number',
      new.email
    );
  exception
    when unique_violation then
      raise exception 'That username or email is already registered.';
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
