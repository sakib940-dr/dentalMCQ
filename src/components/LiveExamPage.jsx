import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import ExamRunner from './ExamRunner';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function CategoryPicker({ onPick }) {
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  if (categories === null) return <div className="panel"><p className="muted">Loading categories…</p></div>;

  return (
    <div className="panel">
      <h2>Live Exams</h2>
      <p className="muted small">Pick a category to see its live exams.</p>
      {categories.length === 0 && <div className="muted">No categories available yet.</div>}
      <div className="category-pick-grid">
        {categories.map((c) => (
          <button key={c.id} className="category-pick-card" onClick={() => onPick(c)}>
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExamList({ category, onBack, onStart }) {
  const { user } = useAuth();
  const [exams, setExams] = useState(null);
  const [myAttempts, setMyAttempts] = useState({}); // exam_id -> attempt

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('exams')
        .select('*')
        .eq('category_id', category.id)
        .eq('status', 'live')
        .eq('is_published', true)
        .order('start_time', { ascending: true });
      if (cancelled) return;
      setExams(data || []);

      if (data && data.length > 0) {
        const { data: attempts } = await supabase
          .from('exam_attempts')
          .select('*')
          .eq('examinee_id', user.id)
          .eq('attempt_type', 'official')
          .in('exam_id', data.map((e) => e.id));
        if (cancelled) return;
        const map = {};
        (attempts || []).forEach((a) => { map[a.exam_id] = a; });
        setMyAttempts(map);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [category.id, user.id]);

  if (exams === null) return <div className="panel"><p className="muted">Loading exams…</p></div>;

  return (
    <div className="panel">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Categories</button>
      <h2>{category.name} — Live Exams</h2>

      {exams.length === 0 && <div className="muted">No live exams in this category right now.</div>}

      <div className="exam-list-wrap">
        {exams.map((ex) => {
          const attempt = myAttempts[ex.id];
          const alreadyTaken = !!attempt;
          return (
            <div key={ex.id} className="exam-list-row">
              <div className="exam-list-row-main">
                <div className="exam-list-row-top">
                  <span className="status-pill status-live">● LIVE</span>
                </div>
                <div className="exam-list-title">{ex.title}</div>
                <div className="exam-list-meta">
                  {ex.total_questions} questions · {ex.duration_minutes} min · started {fmtDateTime(ex.start_time)}
                </div>
                {ex.syllabus && <div className="muted small" style={{ marginBottom: 10 }}>{ex.syllabus}</div>}
              </div>
              {alreadyTaken ? (
                <div className="already-taken-badge">
                  Already submitted — {attempt.percentage != null ? `${attempt.percentage}%` : 'scored'}
                </div>
              ) : (
                <button className="btn-primary" onClick={() => onStart(ex)}>Start exam</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveExamSession({ exam, onExit }) {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [blocked, setBlocked] = useState(null); // error message if attempt can't proceed

  const persistKey = `dentalmcq_liveexam_${exam.id}_${user.id}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Guard against duplicate official attempts
      const { data: existing } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('exam_id', exam.id)
        .eq('examinee_id', user.id)
        .eq('attempt_type', 'official')
        .maybeSingle();

      if (existing && existing.status !== 'in_progress') {
        if (cancelled) return;
        setBlocked('You have already submitted this exam. Duplicate official attempts are not allowed.');
        return;
      }

      const { data: eqRows } = await supabase
        .from('exam_questions')
        .select('question_id, display_order')
        .eq('exam_id', exam.id)
        .order('display_order');
      if (cancelled) return;

      const ids = (eqRows || []).map((r) => r.question_id);
      if (ids.length === 0) { setQuestions([]); return; }

      const { data: qs } = await supabase.from('questions').select('*').in('id', ids);
      if (cancelled) return;
      const order = new Map(ids.map((id, i) => [id, i]));
      setQuestions([...(qs || [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
    }
    load();
    return () => { cancelled = true; };
  }, [exam.id, user.id]);

  const handleSubmit = async (answers, result) => {
    // Create (or reuse an in-progress) attempt row, then finalize it.
    const { data: existing } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('exam_id', exam.id)
      .eq('examinee_id', user.id)
      .eq('attempt_type', 'official')
      .maybeSingle();

    let attemptId = existing?.id;
    if (!attemptId) {
      const { data: created, error: createError } = await supabase
        .from('exam_attempts')
        .insert({ exam_id: exam.id, examinee_id: user.id, attempt_type: 'official', status: 'in_progress' })
        .select()
        .single();
      if (createError) {
        console.error('Failed to create attempt (likely a duplicate):', createError.message);
        return;
      }
      attemptId = created.id;
    }

    // Save every answer WHILE the attempt is still 'in_progress' — the RLS
    // policy on attempt_answers requires that. Only mark the attempt
    // 'submitted' after all answers are safely written.
    for (const q of questions) {
      const chosen = answers[q.id] || null;
      await supabase.from('attempt_answers').upsert({
        attempt_id: attemptId,
        question_id: q.id,
        selected_option: chosen,
        is_correct: chosen ? chosen === q.correct_option : null,
      }, { onConflict: 'attempt_id,question_id' });
    }

    await supabase
      .from('exam_attempts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score: result.score,
        total_marks: result.total,
        percentage: result.percentage,
      })
      .eq('id', attemptId);
  };

  if (blocked) {
    return (
      <div className="panel">
        <h2>Exam unavailable</h2>
        <p className="muted">{blocked}</p>
        <button className="btn-secondary" onClick={onExit}>Back</button>
      </div>
    );
  }

  if (questions === null) return <div className="panel"><p className="muted">Loading exam…</p></div>;
  if (questions.length === 0) {
    return (
      <div className="panel">
        <h2>No questions</h2>
        <p className="muted">This exam has no questions configured yet. Contact your administrator.</p>
        <button className="btn-secondary" onClick={onExit}>Back</button>
      </div>
    );
  }

  return (
    <ExamRunner
      questions={questions}
      durationMinutes={exam.duration_minutes}
      negativeMarking={exam.negative_marking || 0}
      title={exam.title}
      allowTimeAdjust={!!exam.allow_student_time_adjust}
      persistKey={persistKey}
      onSubmit={handleSubmit}
      onExit={onExit}
    />
  );
}

export default function LiveExamPage() {
  const [category, setCategory] = useState(null);
  const [activeExam, setActiveExam] = useState(null);

  if (activeExam) {
    return <LiveExamSession exam={activeExam} onExit={() => setActiveExam(null)} />;
  }
  if (category) {
    return <ExamList category={category} onBack={() => setCategory(null)} onStart={setActiveExam} />;
  }
  return <CategoryPicker onPick={setCategory} />;
}
