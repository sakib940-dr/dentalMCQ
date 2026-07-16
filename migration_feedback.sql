-- ============================================================
-- Migration: feedback
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('bug', 'feature', 'general', 'rating')),
  message text,
  rating int check (rating between 1 and 5),
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_user on feedback(user_id);
create index if not exists idx_feedback_created on feedback(created_at desc);

alter table feedback enable row level security;

-- Students can submit and read their own feedback, not anyone else's.
drop policy if exists "feedback_select_own" on feedback;
create policy "feedback_select_own" on feedback
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "feedback_insert_own" on feedback;
create policy "feedback_insert_own" on feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- Staff (admin/moderator/super_admin) can read and triage all feedback.
drop policy if exists "feedback_select_staff" on feedback;
create policy "feedback_select_staff" on feedback
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));

drop policy if exists "feedback_update_staff" on feedback;
create policy "feedback_update_staff" on feedback
  for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));
