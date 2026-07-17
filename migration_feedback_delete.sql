-- ============================================================
-- Migration: staff can delete feedback entries
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================
-- The original feedback table (migration_feedback.sql) only granted
-- staff select + update — there was no way to actually remove a spam
-- or test entry. This adds that.

drop policy if exists "feedback_delete_staff" on feedback;
create policy "feedback_delete_staff" on feedback
  for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));
