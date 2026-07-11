import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import ExamRunner from './ExamRunner';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// Home: category grid
// ============================================================
export function CategoryGrid({ onPick }) {
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  if (categories === null) return <div className="panel"><p className="muted">Loading categories…</p></div>;

  return (
    <div className="panel">
      <h2>Exam Categories</h2>
      <p className="muted small">Pick a category to see its live, upcoming, and archived exams.</p>
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

// ============================================================
// Exam row (shared visual for live/upcoming/archived)
// ============================================================
function ExamRow({ exam, attempt, statusLabel, statusClass, action }) {
  return (
    <div className="exam-list-row">
      <div className="exam-list-row-main">
        <div className="exam-list-row-top">
          <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
        </div>
        <div className="exam-list-title">{exam.title}</div>
        <div className="exam-list-meta">
          {exam.total_questions} questions · {exam.duration_minutes} min · {fmtDateTime(exam.start_time)}
        </div>
        {exam.syllabus && <div className="muted small" style={{ marginBottom: 10 }}>{exam.syllabus}</div>}
      </div>
      {attempt ? (
        <div className="already-taken-badge">
          Already submitted — {attempt.percentage != null ? `${attempt.percentage}%` : 'scored'}
        </div>
      ) : action}
    </div>
  );
}

// ============================================================
// Category detail: Live / Upcoming / Archived sections
// ============================================================
function CategoryDetail({ category, onBack, onStartLive, onRetakeArchived }) {
  const { user } = useAuth();
  const [exams, setExams] = useState(null);
  const [myAttempts, setMyAttempts] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('exams')
        .select('*')
        .eq('category_id', category.id)
        .eq('is_published', true)
        .in('status', ['live', 'upcoming', 'archived'])
        .order('start_time', { ascending: false });
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

  const live = exams.filter((e) => e.status === 'live');
  const upcoming = exams.filter((e) => e.status === 'upcoming');
  const archived = exams.filter((e) => e.status === 'archived');

  return (
    <div className="panel">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Categories</button>
      <h2>{category.name}</h2>

      <div className="exam-section-block">
        <div className="exam-section-title">Live</div>
        {live.length === 0 && <div className="muted small">No live exams right now.</div>}
        <div className="exam-list-wrap">
          {live.map((ex) => (
            <ExamRow
              key={ex.id}
              exam={ex}
              attempt={myAttempts[ex.id]}
              statusLabel="● LIVE"
              statusClass="status-live"
              action={<button className="btn-primary" onClick={() => onStartLive(ex)}>Start exam</button>}
            />
          ))}
        </div>
      </div>

      <div className="exam-section-block">
        <div className="exam-section-title">Upcoming</div>
        {upcoming.length === 0 && <div className="muted small">Nothing scheduled yet.</div>}
        <div className="exam-list-wrap">
          {upcoming.map((ex) => (
            <ExamRow
              key={ex.id}
              exam={ex}
              attempt={null}
              statusLabel="UPCOMING"
              statusClass="status-upcoming"
              action={<div className="already-taken-badge">Starts {fmtDateTime(ex.start_time)}</div>}
            />
          ))}
        </div>
      </div>

      <div className="exam-section-block">
        <div className="exam-section-title">Archived</div>
        {archived.length === 0 && <div className="muted small">Nothing archived yet.</div>}
        <div className="exam-list-wrap">
          {archived.map((ex) => (
            <ExamRow
              key={ex.id}
              exam={ex}
              attempt={null}
              statusLabel="ARCHIVED"
              statusClass="status-archived"
              action={<button className="btn-secondary" onClick={() => onRetakeArchived(ex)}>Retake as practice</button>}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Live exam session (official attempt)
// ============================================================
function LiveExamSession({ exam, onExit }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [blocked, setBlocked] = useState(null);

  const persistKey = `dentalmcq_liveexam_${exam.id}_${user.id}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
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

// ============================================================
// Archived exam retake — practice only, never touches official results
// ============================================================
function ArchivedRetakeSession({ exam, onExit }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
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
  }, [exam.id]);

  const handleSubmit = async (answers, result) => {
    // Record as a practice_session (source_exam_id set) — never touches
    // exam_attempts / the official merit list.
    const { data: sessionRow } = await supabase
      .from('practice_sessions')
      .insert({
        examinee_id: user.id,
        source_exam_id: exam.id,
        finished_at: new Date().toISOString(),
        total_questions: questions.length,
        correct_count: result.correct,
        wrong_count: result.wrong,
      })
      .select()
      .single();

    const sessionId = sessionRow?.id;
    if (!sessionId) return;

    for (const q of questions) {
      const chosen = answers[q.id] || null;
      await supabase.from('practice_answers').insert({
        session_id: sessionId,
        question_id: q.id,
        selected_option: chosen,
        is_correct: chosen ? chosen === q.correct_option : null,
      });
    }
  };

  if (questions === null) return <div className="panel"><p className="muted">Loading exam…</p></div>;
  if (questions.length === 0) {
    return (
      <div className="panel">
        <h2>No questions</h2>
        <p className="muted">This exam has no questions configured.</p>
        <button className="btn-secondary" onClick={onExit}>Back</button>
      </div>
    );
  }

  return (
    <ExamRunner
      questions={questions}
      durationMinutes={exam.duration_minutes}
      negativeMarking={exam.negative_marking || 0}
      title={`${exam.title} (Practice retake)`}
      allowTimeAdjust
      persistKey={null}
      onSubmit={handleSubmit}
      onExit={onExit}
    />
  );
}

// ============================================================
// Root
// ============================================================
export default function CategoryExamsPage() {
  const [category, setCategory] = useState(null);
  const [liveExam, setLiveExam] = useState(null);
  const [retakeExam, setRetakeExam] = useState(null);

  if (liveExam) return <LiveExamSession exam={liveExam} onExit={() => setLiveExam(null)} />;
  if (retakeExam) return <ArchivedRetakeSession exam={retakeExam} onExit={() => setRetakeExam(null)} />;
  if (category) {
    return (
      <CategoryDetail
        category={category}
        onBack={() => setCategory(null)}
        onStartLive={setLiveExam}
        onRetakeArchived={setRetakeExam}
      />
    );
  }
  return <CategoryGrid onPick={setCategory} />;
}
