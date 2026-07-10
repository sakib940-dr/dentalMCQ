import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MASTERY_THRESHOLD = 3; // consecutive-ish correct hits before a wrong question is considered mastered

export default function PracticeRunner({ session, onExit }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(null); // null = loading
  const [sessionId, setSessionId] = useState(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [finished, setFinished] = useState(false);

  // Load questions for this session
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (session.mode === 'chapter') {
        const { data } = await supabase
          .from('questions')
          .select('*')
          .eq('chapter_id', session.chapterId)
          .eq('is_active', true);
        if (cancelled) return;
        const picked = shuffle(data || []).slice(0, session.count);
        setQuestions(picked);
      } else if (session.mode === 'wrong') {
        const { data: wrongRows } = await supabase
          .from('wrong_questions')
          .select('question_id, wrong_count')
          .eq('examinee_id', user.id)
          .eq('mastered', false)
          .order('wrong_count', { ascending: false });
        if (cancelled) return;
        const ids = (wrongRows || []).map((w) => w.question_id);
        if (ids.length === 0) { setQuestions([]); return; }
        const { data: qs } = await supabase.from('questions').select('*').in('id', ids);
        if (cancelled) return;
        // Preserve priority order (highest wrong_count first)
        const order = new Map(ids.map((id, i) => [id, i]));
        const ordered = [...(qs || [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        setQuestions(ordered);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [session, user.id]);

  // Create the practice_sessions row once we know the question count
  useEffect(() => {
    if (!questions || sessionId) return;
    if (questions.length === 0) return;

    supabase
      .from('practice_sessions')
      .insert({
        examinee_id: user.id,
        chapter_id: session.mode === 'chapter' ? session.chapterId : null,
        total_questions: questions.length,
      })
      .select()
      .single()
      .then(({ data }) => { if (data) setSessionId(data.id); });
  }, [questions, sessionId, session, user.id]);

  const current = questions?.[index];

  const recordWrong = useCallback(async (questionId) => {
    const { data: existing } = await supabase
      .from('wrong_questions')
      .select('*')
      .eq('examinee_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('wrong_questions')
        .update({ wrong_count: existing.wrong_count + 1, last_wrong_at: new Date().toISOString(), mastered: false, mastered_at: null })
        .eq('id', existing.id);
    } else {
      await supabase.from('wrong_questions').insert({ examinee_id: user.id, question_id: questionId, wrong_count: 1 });
    }
  }, [user.id]);

  const recordCorrect = useCallback(async (questionId) => {
    // If this question was in the wrong-questions list, nudge it toward mastery
    const { data: existing } = await supabase
      .from('wrong_questions')
      .select('*')
      .eq('examinee_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle();

    if (existing) {
      const newCount = Math.max(0, existing.wrong_count - 1);
      const mastered = newCount <= 0 || existing.wrong_count <= 1;
      await supabase
        .from('wrong_questions')
        .update({
          wrong_count: newCount,
          mastered,
          mastered_at: mastered ? new Date().toISOString() : null,
        })
        .eq('id', existing.id);
    }
  }, [user.id]);

  const handleAnswer = async (letter) => {
    if (revealed) return;
    setSelected(letter);
    setRevealed(true);
    const isCorrect = letter === current.correct_option;

    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      recordCorrect(current.id);
    } else {
      setWrongCount((c) => c + 1);
      recordWrong(current.id);
    }

    if (sessionId) {
      await supabase.from('practice_answers').insert({
        session_id: sessionId,
        question_id: current.id,
        selected_option: letter,
        is_correct: isCorrect,
      });
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  };

  const finish = async () => {
    setFinished(true);
    if (sessionId) {
      await supabase
        .from('practice_sessions')
        .update({ finished_at: new Date().toISOString(), correct_count: correctCount, wrong_count: wrongCount })
        .eq('id', sessionId);
    }
  };

  if (questions === null) {
    return <div className="panel"><p className="muted">Loading questions…</p></div>;
  }

  if (questions.length === 0) {
    return (
      <div className="panel">
        <h2>Nothing to practice here yet</h2>
        <p className="muted">No questions found for this selection.</p>
        <button className="btn-secondary" onClick={onExit}>Back</button>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="panel">
        <h2>Practice complete</h2>
        <div className="practice-result-summary">
          <div className="score-circle" style={{ borderColor: pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--gold)' : 'var(--red)' }}>
            <span>{pct}%</span>
          </div>
          <div className="muted">{correctCount} correct, {wrongCount} wrong out of {questions.length}</div>
        </div>
        <p className="muted small">This practice session does not affect your official results or merit list standing.</p>
        <button className="btn-primary" onClick={onExit}>Done</button>
      </div>
    );
  }

  return (
    <div className="panel practice-runner">
      <div className="practice-top">
        <button className="btn-secondary" onClick={onExit}>Exit</button>
        <span className="practice-progress">Question {index + 1} of {questions.length}</span>
        <span className="practice-score">✓ {correctCount} ✕ {wrongCount}</span>
      </div>

      <div className="q-text practice-q-text">{current.question_text}</div>

      <div className="opt-list">
        {['A', 'B', 'C', 'D'].map((letter) => {
          const isCorrectOpt = letter === current.correct_option;
          const isChosen = letter === selected;
          let cls = 'opt-btn';
          if (revealed && isCorrectOpt) cls += ' opt-correct';
          else if (revealed && isChosen && !isCorrectOpt) cls += ' opt-wrong';
          else if (isChosen) cls += ' opt-selected';

          return (
            <button key={letter} className={cls} onClick={() => handleAnswer(letter)} disabled={revealed}>
              <span className="opt-letter">{letter}</span>
              <span className="opt-text">{current[`option_${letter.toLowerCase()}`]}</span>
              {revealed && isCorrectOpt && <span className="opt-tag-correct">✓ correct</span>}
              {revealed && isChosen && !isCorrectOpt && <span className="opt-tag-wrong">your answer</span>}
            </button>
          );
        })}
      </div>

      {revealed && (
        <>
          {current.explanation && (
            <div className="expl-box"><b>Why:</b> {current.explanation}</div>
          )}
          <button className="btn-primary practice-next-btn" onClick={next}>
            {index + 1 >= questions.length ? 'Finish' : 'Next question'}
          </button>
        </>
      )}
    </div>
  );
}
