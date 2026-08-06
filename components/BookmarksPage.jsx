import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { removeBookmark } from '../lib/bookmarks';

function BookmarkCard({ question, onRemove }) {
  return (
    <div className="panel answer-sheet-card">
      <div className="bookmark-card-head">
        <button className="icon-btn-danger" onClick={onRemove} aria-label="Remove bookmark">❤️ Remove</button>
      </div>
      <div className="q-text">{question.question_text}</div>
      <div className="opt-list">
        {['A', 'B', 'C', 'D'].map((letter) => {
          const isCorrectOpt = letter === question.correct_option;
          return (
            <div key={letter} className={isCorrectOpt ? 'opt-btn opt-static opt-correct' : 'opt-btn opt-static'}>
              <span className="opt-letter">{letter}</span>
              <span className="opt-text">{question[`option_${letter.toLowerCase()}`]}</span>
              {isCorrectOpt && <span className="opt-tag-correct">✓ correct</span>}
            </div>
          );
        })}
      </div>
      {question.explanation && <div className="expl-box"><b>Why:</b> {question.explanation}</div>}
    </div>
  );
}

export default function BookmarksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState(null);

  const load = async () => {
    const { data: bookmarkRows } = await supabase
      .from('bookmarked_questions')
      .select('question_id, created_at')
      .eq('examinee_id', user.id)
      .order('created_at', { ascending: false });
    const ids = (bookmarkRows || []).map((b) => b.question_id);
    if (ids.length === 0) { setQuestions([]); return; }
    const { data: qs } = await supabase.from('questions').select('*').in('id', ids);
    const order = new Map(ids.map((id, i) => [id, i]));
    setQuestions([...(qs || [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
  };

  useEffect(() => { load(); }, [user.id]);

  const handleRemove = async (questionId) => {
    setQuestions((qs) => qs.filter((q) => q.id !== questionId));
    await removeBookmark(user.id, questionId);
  };

  const startPractice = () => {
    navigate('/dashboard/practice-session', { state: { session: { mode: 'bookmarked' } } });
  };

  if (questions === null) return <div className="panel"><p className="muted">Loading bookmarks…</p></div>;

  return (
    <>
      <div className="panel">
        <h2>Bookmarked Questions</h2>
        <p className="muted small">Questions you've saved for later, from any exam or practice session.</p>
        {questions.length > 0 && (
          <button className="btn-primary" style={{ marginTop: 10 }} onClick={startPractice}>
            Practice these ({questions.length})
          </button>
        )}
      </div>
      {questions.length === 0 && (
        <div className="panel"><p className="muted">No bookmarks yet — tap 🔖 Save on any question while practicing or taking an exam.</p></div>
      )}
      <div className="answer-sheet-list">
        {questions.map((q) => (
          <BookmarkCard key={q.id} question={q} onRemove={() => handleRemove(q.id)} />
        ))}
      </div>
    </>
  );
}
