import { supabase } from './supabaseClient';

// ---------- Bookmarked Questions ----------
// A persistent, cross-session saved-question list. This is deliberately
// separate from wrong_questions (auto spaced-repetition, driven by wrong
// answers) and from ExamRunner's in-session "★ Mark" (per-attempt only,
// never written to the DB). A student bookmarks a question on purpose,
// from any exam or practice session, and it stays saved until removed.

export async function loadBookmarkedIds(userId, questionIds) {
  if (!userId || !questionIds || questionIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('bookmarked_questions')
    .select('question_id')
    .eq('examinee_id', userId)
    .in('question_id', questionIds);
  if (error) {
    console.error('Failed to load bookmarks:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.question_id));
}

export async function addBookmark(userId, questionId) {
  const { error } = await supabase
    .from('bookmarked_questions')
    .upsert({ examinee_id: userId, question_id: questionId }, { onConflict: 'examinee_id,question_id' });
  if (error) console.error('Failed to add bookmark:', error.message);
  return !error;
}

export async function removeBookmark(userId, questionId) {
  const { error } = await supabase
    .from('bookmarked_questions')
    .delete()
    .eq('examinee_id', userId)
    .eq('question_id', questionId);
  if (error) console.error('Failed to remove bookmark:', error.message);
  return !error;
}
