-- ============================================================
-- Migration: Super Admin can manage any notice
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================
--
-- WHY: the "Edit"/"Delete" buttons now show for Super Admin on every
-- notice, not just their own — but the UI showing a button means
-- nothing if the database still rejects the write. Postgres RLS
-- combines multiple permissive policies for the same command with OR,
-- so this ADDS a new allowed path for super_admin without touching or
-- removing whatever existing policy already lets a poster manage their
-- own notices.

drop policy if exists "notices_update_super_admin" on notices;
create policy "notices_update_super_admin" on notices
  for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'super_admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'super_admin'));

drop policy if exists "notices_delete_super_admin" on notices;
create policy "notices_delete_super_admin" on notices
  for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'super_admin'));
