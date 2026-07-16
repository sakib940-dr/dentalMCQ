-- ============================================================
-- Migration: bookmarked_questions
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================
--
-- Powers the new "Bookmarked Questions" feature on the Student Dashboard.
-- This is deliberately a separate table from wrong_questions (which is
-- auto-populated from wrong answers, for spaced-repetition) and from
-- ExamRunner's in-session "★ Mark" (which is per-attempt only and never
-- written to the database). A bookmark is a student's own deliberate,
-- persistent "save this for later" action, available from any exam or
-- practice session, until they remove it.

create table if not exists bookmarked_questions (
  id uuid primary key default gen_random_uuid(),
  examinee_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (examinee_id, question_id)
);

create index if not exists idx_bookmarked_questions_examinee on bookmarked_questions(examinee_id);
create index if not exists idx_bookmarked_questions_question on bookmarked_questions(question_id);

alter table bookmarked_questions enable row level security;

-- Students manage only their own bookmarks — same access shape as
-- wrong_questions, which also has no staff-read policy.
drop policy if exists "bookmarked_questions_select_own" on bookmarked_questions;
create policy "bookmarked_questions_select_own" on bookmarked_questions
  for select
  to authenticated
  using (examinee_id = auth.uid());

drop policy if exists "bookmarked_questions_insert_own" on bookmarked_questions;
create policy "bookmarked_questions_insert_own" on bookmarked_questions
  for insert
  to authenticated
  with check (examinee_id = auth.uid());

drop policy if exists "bookmarked_questions_delete_own" on bookmarked_questions;
create policy "bookmarked_questions_delete_own" on bookmarked_questions
  for delete
  to authenticated
  using (examinee_id = auth.uid());
