import { supabase } from './supabaseClient';

// ---------- Question Read Marks (Study Mode) ----------
// Tracks which questions a student has marked "read" while browsing the
// Question Bank in study mode. Independent of bookmarks (intentional
// saves) and wrong_questions (auto spaced-repetition) — this is purely
// "have I looked at this one yet".

export async function loadReadIds(userId, questionIds) {
  if (!userId || !questionIds || questionIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('question_read_marks')
    .select('question_id')
    .eq('examinee_id', userId)
    .in('question_id', questionIds);
  if (error) {
    console.error('Failed to load read marks:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.question_id));
}

export async function markRead(userId, questionId) {
  const { error } = await supabase
    .from('question_read_marks')
    .upsert({ examinee_id: userId, question_id: questionId }, { onConflict: 'examinee_id,question_id' });
  if (error) console.error('Failed to mark read:', error.message);
  return !error;
}

export async function markUnread(userId, questionId) {
  const { error } = await supabase
    .from('question_read_marks')
    .delete()
    .eq('examinee_id', userId)
    .eq('question_id', questionId);
  if (error) console.error('Failed to mark unread:', error.message);
  return !error;
}

export async function markManyRead(userId, questionIds) {
  if (!questionIds || questionIds.length === 0) return true;
  const rows = questionIds.map((question_id) => ({ examinee_id: userId, question_id }));
  const { error } = await supabase.from('question_read_marks').upsert(rows, { onConflict: 'examinee_id,question_id' });
  if (error) console.error('Failed to bulk mark read:', error.message);
  return !error;
}

export async function markManyUnread(userId, questionIds) {
  if (!questionIds || questionIds.length === 0) return true;
  const { error } = await supabase
    .from('question_read_marks')
    .delete()
    .eq('examinee_id', userId)
    .in('question_id', questionIds);
  if (error) console.error('Failed to bulk mark unread:', error.message);
  return !error;
}

// Count of read marks among a set of question ids — used for the
// progress ring on each subject card.
export async function countRead(userId, questionIds) {
  if (!userId || !questionIds || questionIds.length === 0) return 0;
  const { count } = await supabase
    .from('question_read_marks')
    .select('id', { count: 'exact', head: true })
    .eq('examinee_id', userId)
    .in('question_id', questionIds);
  return count || 0;
}
