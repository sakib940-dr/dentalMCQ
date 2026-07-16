import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import ExamRunner from './ExamRunner';
import PracticePage from './PracticePage';
import { fmtDateTime } from '../lib/formatters';
import { loadBookmarkedIds, addBookmark, removeBookmark } from '../lib/bookmarks';


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
function ExamRow({ exam, attempt, statusLabel, statusClass, action, forceShowAction }) {
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
      {attempt && !forceShowAction ? (
        <div className="already-taken-badge">
          Already submitted — {attempt.percentage != null ? `${attempt.percentage}%` : 'scored'}
        </div>
      ) : action}
    </div>
  );
}

// ============================================================
// Result view: a student's own answer sheet for a past attempt
// ============================================================
function ExamResultView({ exam, onBack }) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [details, setDetails] = useState(null); // [{ question, chosen, correct }]

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: a } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('exam_id', exam.id)
        .eq('examinee_id', user.id)
        .eq('attempt_type', 'official')
        .maybeSingle();
      if (cancelled || !a) return;
      setAttempt(a);

      const { data: answers } = await supabase.from('attempt_answers').select('*').eq('attempt_id', a.id);
      const { data: eqRows } = await supabase.from('exam_questions').select('question_id, display_order').eq('exam_id', exam.id).order('display_order');
      const ids = (eqRows || []).map((r) => r.question_id);
      const { data: qs } = await supabase.from('questions').select('*').in('id', ids);
      if (cancelled) return;

      const order = new Map(ids.map((id, i) => [id, i]));
      const sortedQs = [...(qs || [])].sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
      const answerMap = new Map((answers || []).map((ans) => [ans.question_id, ans]));

      setDetails(sortedQs.map((q) => ({ question: q, answer: answerMap.get(q.id) || null })));
    }
    load();
    return () => { cancelled = true; };
  }, [exam.id, user.id]);

  if (!attempt || details === null) return <div className="panel"><p className="muted">Loading result…</p></div>;

  const pct = attempt.percentage;

  return (
    <div className="answer-sheet-page">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Back</button>
      <div className="panel answer-sheet-summary">
        <h2>{exam.title}</h2>
        <div className="result-stat-row">
          <div className="result-stat">
            <span className="result-stat-value result-stat-correct">{details.filter((d) => d.answer?.is_correct).length}</span>
            <span className="result-stat-label">Correct</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value result-stat-wrong">{details.filter((d) => d.answer && !d.answer.is_correct).length}</span>
            <span className="result-stat-label">Wrong</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value result-stat-unanswered">{details.filter((d) => !d.answer).length}</span>
            <span className="result-stat-label">Unanswered</span>
          </div>
        </div>
        <div className="result-big-row">
          <div className="result-big-pct">{pct}%</div>
          {attempt.total_marks != null && <div className="result-big-mark">{attempt.score} / {attempt.total_marks} marks</div>}
        </div>
      </div>

      <div className="answer-sheet-list">
        {details.map(({ question: q, answer }, i) => {
          const chosen = answer?.selected_option || null;
          const isCorrect = !!answer?.is_correct;
          let cardClass = 'panel answer-sheet-card';
          if (!chosen) cardClass += ' answer-sheet-unanswered';
          else if (isCorrect) cardClass += ' answer-sheet-correct';
          else cardClass += ' answer-sheet-wrong';

          return (
            <div key={q.id} className={cardClass}>
              <div className="q-num-row">
                <span className="q-num-label">Question {i + 1}</span>
                {!chosen && <span className="sheet-tag sheet-tag-unanswered">Unanswered</span>}
                {chosen && isCorrect && <span className="sheet-tag sheet-tag-correct">Correct</span>}
                {chosen && !isCorrect && <span className="sheet-tag sheet-tag-wrong">Wrong</span>}
              </div>
              <div className="q-text">{q.question_text}</div>
              <div className="opt-list">
                {['A', 'B', 'C', 'D'].map((letter) => {
                  const isCorrectOpt = letter === q.correct_option;
                  const isChosenWrong = letter === chosen && !isCorrect;
                  let cls = 'opt-btn opt-static';
                  if (isCorrectOpt) cls += ' opt-correct';
                  else if (isChosenWrong) cls += ' opt-wrong';
                  return (
                    <div key={letter} className={cls}>
                      <span className="opt-letter">{letter}</span>
                      <span className="opt-text">{q[`option_${letter.toLowerCase()}`]}</span>
                      {isCorrectOpt && <span className="opt-tag-correct">✓ correct</span>}
                      {isChosenWrong && <span className="opt-tag-wrong">your answer</span>}
                    </div>
                  );
                })}
              </div>
              {q.explanation && <div className="expl-box"><b>Why:</b> {q.explanation}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Merit list view: ranked table for a specific closed exam
// ============================================================
function ExamMeritView({ exam, onBack }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await supabase.rpc('compute_exam_ranks', { target_exam_id: exam.id });
      const { data } = await supabase
        .from('exam_attempts')
        .select('*, profiles(full_name)')
        .eq('exam_id', exam.id)
        .eq('attempt_type', 'official')
        .eq('status', 'submitted')
        .order('rank', { ascending: true, nullsFirst: false });
      if (cancelled) return;
      setRows(data || []);
    }
    load();
    return () => { cancelled = true; };
  }, [exam.id]);

  if (rows === null) return <div className="panel"><p className="muted">Loading merit list…</p></div>;

  return (
    <div className="panel">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Back</button>
      <h2>{exam.title} — Merit List</h2>
      <p className="muted small">{rows.length} student{rows.length !== 1 ? 's' : ''} attempted this exam.</p>
      <div className="merit-table-wrap">
        {rows.map((r) => {
          const isMe = r.examinee_id === user.id;
          return (
            <div key={r.id} className={isMe ? 'merit-row merit-row-mine' : 'merit-row'}>
              <div className="merit-rank">#{r.rank ?? '—'}</div>
              <div className="merit-name">
                {r.profiles?.full_name || 'Student'}
                {isMe && <span className="merit-you-tag">You</span>}
              </div>
              <div className="merit-score">{r.percentage}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Archived exam actions: View Result / Merit List / Retake
// ============================================================
function ArchivedExamActions({ exam, attempt, onRetake, onViewResult, onViewMerit }) {
  return (
    <div className="archived-actions-row">
      {attempt && <button className="btn-secondary" onClick={() => onViewResult(exam)}>View Result</button>}
      <button className="btn-secondary" onClick={() => onViewMerit(exam)}>Merit List</button>
      <button className="btn-primary" onClick={() => onRetake(exam)}>Retake as practice</button>
    </div>
  );
}


function fmtScheduleDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function ExamSchedulePanel({ categoryId }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('exam_schedule_entries')
      .select('*')
      .eq('category_id', categoryId)
      .order('scheduled_date', { ascending: true })
      .then(({ data }) => { if (!cancelled) setEntries(data || []); });
    return () => { cancelled = true; };
  }, [categoryId]);

  if (entries === null) return <div className="muted small">Loading schedule…</div>;
  if (entries.length === 0) return <div className="muted small">No schedule published yet.</div>;

  return (
    <div className="schedule-list">
      {entries.map((e) => (
        <div key={e.id} className="schedule-row">
          <div className="schedule-date">{fmtScheduleDate(e.scheduled_date)}</div>
          <div className="schedule-syllabus">{e.subject_syllabus}</div>
          {e.notes && <div className="muted small">{e.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Category detail: 4-tab layout — Exam Schedule / Upcoming / Live / Archive
// ============================================================
function computeEffectiveStatus(ex) {
  const now = new Date();
  const start = new Date(ex.start_time);
  const end = new Date(ex.end_time);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'live';
  return 'archived';
}

function CategoryDetail({ category, onBack, onStartLive, onRetakeArchived, onViewResult, onViewMerit }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState(null);
  const [myAttempts, setMyAttempts] = useState({});
  const [tab, setTab] = useState('schedule'); // schedule | upcoming | live | archive | practice
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      // The ONLY question that matters: is there an active subscription
      // record for this student + this category? No default access, no
      // trial window, no "requires_payment" flag — access exists if and
      // only if an active category_access_grants row exists (and isn't
      // overridden by a manual lock), checked server-side via
      // has_active_access() so the rule lives in exactly one place.
      const { data, error } = await supabase.rpc('has_active_access', {
        target_examinee_id: user.id,
        target_category_id: category.id,
        target_resource_type: 'category',
      });
      if (cancelled) return;
      if (error) {
        console.error('Access check failed:', error.message);
        setHasAccess(false); // fail closed, never fail open
      } else {
        setHasAccess(!!data);
      }
      setAccessChecked(true);
    }
    checkAccess();
    return () => { cancelled = true; };
  }, [category.id, user.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('exams')
        .select('*')
        .eq('category_id', category.id)
        .eq('is_published', true)
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

  if (!accessChecked || exams === null) return <div className="panel"><p className="muted">Loading exams…</p></div>;

  const live = exams.filter((e) => computeEffectiveStatus(e) === 'live');
  const upcoming = exams.filter((e) => computeEffectiveStatus(e) === 'upcoming');
  const archived = exams.filter((e) => computeEffectiveStatus(e) === 'archived');

  if (!hasAccess && tab !== 'schedule') {
    return (
      <div className="panel">
        <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Categories</button>
        <h2>{category.name}</h2>
        <div className="mode-tabs">
          <button className={tab === 'schedule' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setTab('schedule')}>Exam Schedule</button>
          <button className="mode-tab" disabled>Upcoming</button>
          <button className="mode-tab" disabled>Live</button>
          <button className="mode-tab" disabled>Archive</button>
          <button className="mode-tab" disabled>Practice</button>
        </div>
        <div className="locked-feature">
          <div className="locked-feature-icon">🔒</div>
          <h2>This category requires an active subscription.</h2>
          <p className="muted">Claim or purchase a package that includes this category to unlock it.</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard/package')}>View packages</button>
        </div>
      </div>
    );
  }

  const goToTab = (t) => setTab(t);

  return (
    <div className="panel">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Categories</button>
      <h2>{category.name}</h2>

      <div className="mode-tabs">
        <button className={tab === 'schedule' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => goToTab('schedule')}>Exam Schedule</button>
        <button className={tab === 'upcoming' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => goToTab('upcoming')}>Upcoming ({upcoming.length})</button>
        <button className={tab === 'live' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => goToTab('live')}>Live ({live.length})</button>
        <button className={tab === 'archive' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => goToTab('archive')}>Archive ({archived.length})</button>
        <button className={tab === 'practice' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => goToTab('practice')}>Practice</button>
      </div>

      {tab === 'schedule' && <ExamSchedulePanel categoryId={category.id} />}
      {tab === 'practice' && <PracticePage categoryId={category.id} />}

      {tab === 'live' && (
        <>
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
        </>
      )}

      {tab === 'upcoming' && (
        <>
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
        </>
      )}

      {tab === 'archive' && (
        <>
          {archived.length === 0 && <div className="muted small">Nothing archived yet.</div>}
          <div className="exam-list-wrap">
            {archived.map((ex) => (
              <ExamRow
                key={ex.id}
                exam={ex}
                attempt={myAttempts[ex.id]}
                forceShowAction
                statusLabel="ARCHIVED"
                statusClass="status-archived"
                action={
                  <ArchivedExamActions
                    exam={ex}
                    attempt={myAttempts[ex.id]}
                    onRetake={onRetakeArchived}
                    onViewResult={onViewResult}
                    onViewMerit={onViewMerit}
                  />
                }
              />
            ))}
          </div>
        </>
      )}
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
  const [effectiveDuration, setEffectiveDuration] = useState(exam.duration_minutes);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  const persistKey = `dentalmcq_liveexam_${exam.id}_${user.id}`;

  const toggleBookmark = async (questionId) => {
    const isBookmarked = bookmarkedIds.has(questionId);
    setBookmarkedIds((s) => {
      const next = new Set(s);
      isBookmarked ? next.delete(questionId) : next.add(questionId);
      return next;
    });
    if (isBookmarked) await removeBookmark(user.id, questionId);
    else await addBookmark(user.id, questionId);
  };

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

      // Cap the student's timer against the exam's official closing
      // time, computed server-side so a manipulated device clock can't
      // extend it — starting near end_time now yields a shorter timer
      // instead of the full duration_minutes.
      const nowIso = new Date().toISOString();
      const { data: effectiveEnd } = await supabase.rpc('get_effective_exam_end', {
        exam_id: exam.id,
        attempt_started_at: nowIso,
      });
      if (!cancelled && effectiveEnd) {
        const capMinutes = Math.max(1, Math.round((new Date(effectiveEnd) - new Date(nowIso)) / 60000));
        setEffectiveDuration(Math.min(exam.duration_minutes, capMinutes));
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
      setBookmarkedIds(await loadBookmarkedIds(user.id, ids));
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

    // Write all answers in a single batched request instead of one
    // round-trip per question — critical for keeping submit fast when
    // hundreds of students submit around the same time.
    const answerRows = questions.map((q) => {
      const chosen = answers[q.id] || null;
      return {
        attempt_id: attemptId,
        question_id: q.id,
        selected_option: chosen,
        is_correct: chosen ? chosen === q.correct_option : null,
      };
    });
    const { error: answersError } = await supabase
      .from('attempt_answers')
      .upsert(answerRows, { onConflict: 'attempt_id,question_id' });
    if (answersError) {
      console.error('Failed to save answers:', answersError.message);
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

  const windowIsBinding = effectiveDuration < exam.duration_minutes;

  return (
    <ExamRunner
      questions={questions}
      durationMinutes={effectiveDuration}
      negativeMarking={exam.negative_marking || 0}
      title={exam.title}
      allowTimeAdjust={!!exam.allow_student_time_adjust && !windowIsBinding}
      persistKey={persistKey}
      onSubmit={handleSubmit}
      onExit={onExit}
      bookmarkedIds={bookmarkedIds}
      onToggleBookmark={toggleBookmark}
    />
  );
}

// ============================================================
// Archived exam retake — practice only, never touches official results
// ============================================================
function ArchivedRetakeSession({ exam, onExit }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  const toggleBookmark = async (questionId) => {
    const isBookmarked = bookmarkedIds.has(questionId);
    setBookmarkedIds((s) => {
      const next = new Set(s);
      isBookmarked ? next.delete(questionId) : next.add(questionId);
      return next;
    });
    if (isBookmarked) await removeBookmark(user.id, questionId);
    else await addBookmark(user.id, questionId);
  };

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
      setBookmarkedIds(await loadBookmarkedIds(user.id, ids));
    }
    load();
    return () => { cancelled = true; };
  }, [exam.id, user.id]);

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

    const answerRows = questions.map((q) => {
      const chosen = answers[q.id] || null;
      return {
        session_id: sessionId,
        question_id: q.id,
        selected_option: chosen,
        is_correct: chosen ? chosen === q.correct_option : null,
      };
    });
    const { error: answersError } = await supabase.from('practice_answers').insert(answerRows);
    if (answersError) {
      console.error('Failed to save practice answers:', answersError.message);
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
      bookmarkedIds={bookmarkedIds}
      onToggleBookmark={toggleBookmark}
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
  const [resultExam, setResultExam] = useState(null);
  const [meritExam, setMeritExam] = useState(null);

  if (liveExam) return <LiveExamSession exam={liveExam} onExit={() => setLiveExam(null)} />;
  if (retakeExam) return <ArchivedRetakeSession exam={retakeExam} onExit={() => setRetakeExam(null)} />;
  if (resultExam) return <ExamResultView exam={resultExam} onBack={() => setResultExam(null)} />;
  if (meritExam) return <ExamMeritView exam={meritExam} onBack={() => setMeritExam(null)} />;
  if (category) {
    return (
      <CategoryDetail
        category={category}
        onBack={() => setCategory(null)}
        onStartLive={setLiveExam}
        onRetakeArchived={setRetakeExam}
        onViewResult={setResultExam}
        onViewMerit={setMeritExam}
      />
    );
  }
  return <CategoryGrid onPick={setCategory} />;
}
