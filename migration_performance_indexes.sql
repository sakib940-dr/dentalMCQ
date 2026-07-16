-- ============================================================
-- Migration: performance indexes for exam-day scale (1000+ concurrent)
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================
--
-- Every index below was chosen from an actual .eq()/.in() filter found
-- in the frontend codebase (not a generic "index everything" pass) —
-- see PROJECT_SUMMARY.md for the audit this came from. All use
-- IF NOT EXISTS, so this is safe to run even if some of these already
-- exist — it's a no-op for anything already indexed.
--
-- Deliberately a LEAN set: an index speeds up reads but slows down
-- every write to that table, and exam submission during a live exam is
-- exactly the write-heavy moment this whole migration is for. Composite
-- indexes are used where multiple columns are consistently filtered
-- together, instead of one index per column.

-- exam_attempts: covers the "does this attempt already exist" check
-- (exam_id + examinee_id + attempt_type, checked on every exam page
-- load and every submit) and the student's own attempt history lookup.
create index if not exists idx_exam_attempts_exam_examinee_type on exam_attempts(exam_id, examinee_id, attempt_type);
create index if not exists idx_exam_attempts_examinee_type_status on exam_attempts(examinee_id, attempt_type, status);

-- attempt_answers: the hottest write path during exam submission
-- (per-attempt upsert), plus the reverse lookup by question used by
-- dashboard aggregate stats.
create index if not exists idx_attempt_answers_attempt on attempt_answers(attempt_id);
create index if not exists idx_attempt_answers_question on attempt_answers(question_id);

-- exam_questions: loading an exam's question list — happens once per
-- student per exam, but that's 1000 reads in the same few minutes.
create index if not exists idx_exam_questions_exam on exam_questions(exam_id);

-- practice_sessions / practice_answers: same shape as above, for practice.
create index if not exists idx_practice_sessions_examinee on practice_sessions(examinee_id);
create index if not exists idx_practice_answers_session on practice_answers(session_id);

-- questions: the single hottest READ in the whole app — every practice
-- mode, every category drill-down, and Smart Search all filter by
-- chapter_id, almost always combined with is_active.
create index if not exists idx_questions_chapter_active on questions(chapter_id, is_active);

-- wrong_questions: revision count on the dashboard + per-category
-- "to review" mapping in Question Bank Practice.
create index if not exists idx_wrong_questions_examinee_mastered on wrong_questions(examinee_id, mastered);

-- Category hierarchy drill-down (subjects -> subcategories -> chapters)
-- — walked on nearly every practice/dashboard/search page load.
create index if not exists idx_subjects_category on subjects(category_id);
create index if not exists idx_subcategories_subject on subcategories(subject_id);
create index if not exists idx_chapters_subcategory on chapters(subcategory_id);

-- category_access_grants: checked on every practice/exam access gate
-- and on the dashboard's "questions available" calculation.
create index if not exists idx_category_access_grants_examinee on category_access_grants(examinee_id);

-- Chat + notifications (unread badge, staff inbox sort).
create index if not exists idx_chat_messages_thread on chat_messages(thread_id);
create index if not exists idx_notifications_user_unread on notifications(user_id, is_read);
