-- ============================================================
-- Migration: finalize_exam_attempt (server-side authoritative scoring)
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================
--
-- WHY: exam_attempts.score/percentage/submitted_at were previously set
-- directly from client-computed values sent by the browser — the same
-- browser running the exam UI. Anyone intercepting that request (or
-- tampering with the page's JS) could submit a fabricated score or
-- backdated submission time. attempt_answers.is_correct has the same
-- problem — computed client-side against a client-side copy of the
-- question bank.
--
-- FIX: this function recomputes is_correct for every answer directly
-- from the questions table (the actual source of truth), then derives
-- score/percentage from that server-recomputed data, and uses the
-- database's own now() for submitted_at — none of these three values
-- are trusted from the client anymore. The client still uploads
-- selected_option (which option the student picked is legitimate
-- client data — there's no "server-side truth" for that), but nothing
-- about correctness or grading is taken on faith.
--
-- This only applies to official exam_attempts. Practice sessions are
-- deliberately left untouched — practice never affects official
-- results or the merit list, so there's nothing here worth protecting.

create or replace function public.finalize_exam_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_examinee_id uuid;
  v_exam_id uuid;
  v_negative_marking numeric;
  v_correct int;
  v_wrong int;
  v_total int;
  v_score numeric;
  v_percentage numeric;
begin
  select ea.examinee_id, ea.exam_id, coalesce(e.negative_marking, 0)
    into v_examinee_id, v_exam_id, v_negative_marking
  from exam_attempts ea
  join exams e on e.id = ea.exam_id
  where ea.id = p_attempt_id
    and ea.attempt_type = 'official';

  if v_examinee_id is null then
    raise exception 'Attempt not found or not an official attempt';
  end if;

  -- Only the attempt's own owner can finalize it — same boundary the
  -- rest of this app already enforces via RLS on exam_attempts.
  if v_examinee_id <> auth.uid() then
    raise exception 'Not authorized to finalize this attempt';
  end if;

  -- Recompute correctness from the actual question bank. Unanswered
  -- stays NULL, never false — matches the existing "don't count
  -- unanswered as wrong" rule used everywhere else in this app.
  update attempt_answers aa
  set is_correct = case
    when aa.selected_option is null then null
    else (aa.selected_option = q.correct_option)
  end
  from questions q
  where aa.question_id = q.id
    and aa.attempt_id = p_attempt_id;

  select
    count(*) filter (where is_correct = true),
    count(*) filter (where is_correct = false),
    count(*)
  into v_correct, v_wrong, v_total
  from attempt_answers
  where attempt_id = p_attempt_id;

  v_score := v_correct - (v_wrong * v_negative_marking);
  v_percentage := case when v_total > 0 then round((v_correct::numeric / v_total) * 1000) / 10 else 0 end;

  update exam_attempts
  set status = 'submitted',
      submitted_at = now(),
      score = v_score,
      total_marks = v_total,
      percentage = v_percentage
  where id = p_attempt_id;
end;
$$;

grant execute on function public.finalize_exam_attempt(uuid) to authenticated;
