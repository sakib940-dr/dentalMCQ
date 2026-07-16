import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import ExamRunner from './ExamRunner';
import { useAppSetting, LockedFeature } from './FeatureLock';
import { loadBookmarkedIds, addBookmark, removeBookmark } from '../lib/bookmarks';

const NEGATIVE_MARKING = 0.5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// Practice setup: Single / Mixed / By chapter
// ============================================================
function useSubjects(categoryId) {
  const [subjects, setSubjects] = useState([]);
  useEffect(() => {
    if (!categoryId) { setSubjects([]); return; }
    supabase.from('subjects').select('*').eq('category_id', categoryId).order('display_order')
      .then(({ data }) => setSubjects(data || []));
  }, [categoryId]);
  return subjects;
}

// Fetches every chapter under a subject (flattened across all its
// sub-categories), with a live question count for each.
function useChaptersWithCounts(subjectId) {
  const [chapters, setChapters] = useState(null); // null = loading, [] = loaded empty

  useEffect(() => {
    let cancelled = false;
    if (!subjectId) { setChapters(null); return; }
    async function load() {
      const { data: subcats } = await supabase.from('subcategories').select('id, name').eq('subject_id', subjectId);
      const subcatIds = (subcats || []).map((s) => s.id);
      if (subcatIds.length === 0) { if (!cancelled) setChapters([]); return; }
      const { data: chaps } = await supabase.from('chapters').select('id, name, subcategory_id').in('subcategory_id', subcatIds).order('display_order');
      if (!chaps || chaps.length === 0) { if (!cancelled) setChapters([]); return; }

      const withCounts = await Promise.all(chaps.map(async (ch) => {
        const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('chapter_id', ch.id).eq('is_active', true);
        return { ...ch, available: count || 0 };
      }));
      if (!cancelled) setChapters(withCounts);
    }
    load();
    return () => { cancelled = true; };
  }, [subjectId]);

  return chapters;
}

function SingleMode({ categoryId, onPick }) {
  const subjects = useSubjects(categoryId);
  const [subjectId, setSubjectId] = useState('');
  const [available, setAvailable] = useState(0);
  const [numQuestions, setNumQuestions] = useState(10);
  const [minutes, setMinutes] = useState(6);
  const [minutesTouched, setMinutesTouched] = useState(false);

  useEffect(() => {
    if (!subjectId) { setAvailable(0); return; }
    async function count() {
      const { data: subcats } = await supabase.from('subcategories').select('id').eq('subject_id', subjectId);
      const subcatIds = (subcats || []).map((s) => s.id);
      if (subcatIds.length === 0) { setAvailable(0); return; }
      const { data: chaps } = await supabase.from('chapters').select('id').in('subcategory_id', subcatIds);
      const chapIds = (chaps || []).map((c) => c.id);
      if (chapIds.length === 0) { setAvailable(0); return; }
      const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).in('chapter_id', chapIds).eq('is_active', true);
      setAvailable(count || 0);
    }
    count();
  }, [subjectId]);

  useEffect(() => {
    if (minutesTouched) return;
    setMinutes(Math.max(1, Math.round(numQuestions * 0.6)));
  }, [numQuestions, minutesTouched]);

  return (
    <div>
      <label className="field-block">
        <span>Subject</span>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      {subjectId && <div className="muted small">{available} question{available !== 1 ? 's' : ''} available</div>}

      <div className="option-grid" style={{ marginTop: 12 }}>
        <label className="field-block">
          <span>Number of questions</span>
          <input type="number" min={1} max={Math.max(1, available)} value={numQuestions}
            onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))} />
        </label>
        <label className="field-block">
          <span>Duration (minutes)</span>
          <input type="number" min={1} value={minutes}
            onChange={(e) => { setMinutesTouched(true); setMinutes(Math.max(1, parseInt(e.target.value) || 1)); }} />
        </label>
      </div>

      <button
        className="btn-primary"
        style={{ marginTop: 14, width: '100%' }}
        disabled={!subjectId || available === 0}
        onClick={() => onPick({ mode: 'single', subjectId, count: Math.min(numQuestions, available), minutes })}
      >
        Start practice
      </button>
    </div>
  );
}

function MixedMode({ categoryId, onPick }) {
  const subjects = useSubjects(categoryId);
  const [availableBySubject, setAvailableBySubject] = useState({});
  const [counts, setCounts] = useState({}); // subjectId -> number typed
  const [minutes, setMinutes] = useState(10);
  const [minutesTouched, setMinutesTouched] = useState(false);

  useEffect(() => {
    async function loadCounts() {
      if (subjects.length === 0) { setAvailableBySubject({}); return; }
      const subjectIds = subjects.map((s) => s.id);

      const { data: allSubcats } = await supabase.from('subcategories').select('id, subject_id').in('subject_id', subjectIds);
      const subcatIds = (allSubcats || []).map((sc) => sc.id);
      const subcatToSubject = new Map((allSubcats || []).map((sc) => [sc.id, sc.subject_id]));

      const { data: allChapters } = subcatIds.length
        ? await supabase.from('chapters').select('id, subcategory_id').in('subcategory_id', subcatIds)
        : { data: [] };
      const chapterToSubject = new Map((allChapters || []).map((ch) => [ch.id, subcatToSubject.get(ch.subcategory_id)]));
      const allChapterIds = (allChapters || []).map((ch) => ch.id);

      const { data: allQuestions } = allChapterIds.length
        ? await supabase.from('questions').select('chapter_id').in('chapter_id', allChapterIds).eq('is_active', true)
        : { data: [] };

      const results = {};
      subjects.forEach((s) => { results[s.id] = 0; });
      (allQuestions || []).forEach((q) => {
        const subjId = chapterToSubject.get(q.chapter_id);
        if (subjId != null) results[subjId] = (results[subjId] || 0) + 1;
      });
      setAvailableBySubject(results);
    }
    if (subjects.length > 0) loadCounts();
  }, [subjects]);

  const totalSelected = Object.values(counts).reduce((sum, n) => sum + (parseInt(n) || 0), 0);

  useEffect(() => {
    if (minutesTouched || totalSelected === 0) return;
    setMinutes(Math.max(1, Math.round(totalSelected * 0.6)));
  }, [totalSelected, minutesTouched]);

  const setCount = (subjectId, value) => {
    const n = Math.max(0, parseInt(value) || 0);
    setCounts((c) => ({ ...c, [subjectId]: n }));
  };

  const start = () => {
    const picks = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([subjectId, n]) => ({ subjectId, count: Math.min(n, availableBySubject[subjectId] || 0) }));
    onPick({ mode: 'mixed', subjectPicks: picks, minutes });
  };

  return (
    <div>
      <p className="muted small">Select subjects and how many questions to draw from each.</p>
      <div className="mixed-subject-list">
        {subjects.map((s) => {
          const avail = availableBySubject[s.id] ?? '…';
          const val = counts[s.id] || '';
          return (
            <div key={s.id} className="mixed-subject-row">
              <div>
                <div className="mixed-subject-name">{s.name}</div>
                <div className="muted small">{avail} available</div>
              </div>
              <input
                type="number"
                min={0}
                max={typeof avail === 'number' ? avail : undefined}
                value={val}
                placeholder="0"
                onChange={(e) => setCount(s.id, e.target.value)}
              />
            </div>
          );
        })}
      </div>

      <label className="field-block" style={{ marginTop: 14 }}>
        <span>Duration (minutes)</span>
        <input type="number" min={1} value={minutes}
          onChange={(e) => { setMinutesTouched(true); setMinutes(Math.max(1, parseInt(e.target.value) || 1)); }} />
      </label>

      <div className="muted small" style={{ marginTop: 8 }}>{totalSelected} question{totalSelected !== 1 ? 's' : ''} selected total</div>

      <button className="btn-primary" style={{ marginTop: 10, width: '100%' }} disabled={totalSelected === 0} onClick={start}>
        Start practice
      </button>
    </div>
  );
}

function ByChapterMode({ categoryId, onPick }) {
  const subjects = useSubjects(categoryId);
  const [subjectId, setSubjectId] = useState('');
  const chapters = useChaptersWithCounts(subjectId);
  const [counts, setCounts] = useState({}); // chapterId -> number typed
  const [minutes, setMinutes] = useState(10);
  const [minutesTouched, setMinutesTouched] = useState(false);

  useEffect(() => { setCounts({}); }, [subjectId]);

  const totalSelected = Object.values(counts).reduce((sum, n) => sum + (parseInt(n) || 0), 0);

  useEffect(() => {
    if (minutesTouched || totalSelected === 0) return;
    setMinutes(Math.max(1, Math.round(totalSelected * 0.6)));
  }, [totalSelected, minutesTouched]);

  const setCount = (chapterId, value, max) => {
    const n = Math.max(0, Math.min(max, parseInt(value) || 0));
    setCounts((c) => ({ ...c, [chapterId]: n }));
  };

  const start = () => {
    const picks = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([chapterId, n]) => ({ chapterId, count: n }));
    onPick({ mode: 'bychapter', chapterPicks: picks, minutes });
  };

  return (
    <div>
      <label className="field-block">
        <span>Subject</span>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      {subjectId && chapters === null && <div className="muted small" style={{ marginTop: 10 }}>Loading chapters…</div>}
      {subjectId && chapters && chapters.length === 0 && <div className="muted small" style={{ marginTop: 10 }}>No chapters found.</div>}

      {subjectId && chapters && chapters.length > 0 && (
        <div className="mixed-subject-list" style={{ marginTop: 12 }}>
          {chapters.map((ch) => (
            <div key={ch.id} className="mixed-subject-row">
              <div>
                <div className="mixed-subject-name">{ch.name}</div>
                <div className="muted small">{ch.available} available</div>
              </div>
              <input
                type="number"
                min={0}
                max={ch.available}
                value={counts[ch.id] || ''}
                placeholder="0"
                onChange={(e) => setCount(ch.id, e.target.value, ch.available)}
              />
            </div>
          ))}
        </div>
      )}

      {subjectId && chapters && chapters.length > 0 && (
        <>
          <label className="field-block" style={{ marginTop: 14 }}>
            <span>Duration (minutes)</span>
            <input type="number" min={1} value={minutes}
              onChange={(e) => { setMinutesTouched(true); setMinutes(Math.max(1, parseInt(e.target.value) || 1)); }} />
          </label>
          <div className="muted small" style={{ marginTop: 8 }}>{totalSelected} question{totalSelected !== 1 ? 's' : ''} selected total</div>
          <button className="btn-primary" style={{ marginTop: 10, width: '100%' }} disabled={totalSelected === 0} onClick={start}>
            Start practice
          </button>
        </>
      )}
    </div>
  );
}

export function PracticeSetup({ categoryId, onPick }) {
  const [mode, setMode] = useState('single'); // single | mixed | bychapter | random

  return (
    <div className="panel">
      <h2>Start practice</h2>
      <p className="muted small">Practice sessions never affect your official results or merit list.</p>

      <div className="mode-tabs">
        <button className={mode === 'single' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('single')}>Subject</button>
        <button className={mode === 'mixed' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('mixed')}>Mixed</button>
        <button className={mode === 'bychapter' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('bychapter')}>By chapter</button>
        <button className={mode === 'random' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('random')}>Random</button>
      </div>

      {mode === 'single' && <SingleMode categoryId={categoryId} onPick={onPick} />}
      {mode === 'mixed' && <MixedMode categoryId={categoryId} onPick={onPick} />}
      {mode === 'bychapter' && <ByChapterMode categoryId={categoryId} onPick={onPick} />}
      {mode === 'random' && <RandomMode categoryId={categoryId} onPick={onPick} />}
    </div>
  );
}

function RandomMode({ categoryId, onPick }) {
  const [count, setCount] = useState(30);
  return (
    <div className="random-selector">
      <p className="muted small">Pulls random questions from across this entire category, regardless of subject or chapter.</p>
      <label className="exam-setup-timer">
        <span>Number of questions</span>
        <input
          type="number"
          min={5}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.max(5, Math.min(100, parseInt(e.target.value) || 5)))}
        />
      </label>
      <button className="btn-primary" onClick={() => onPick({ mode: 'randomCategory', categoryId, count })}>
        Start random practice
      </button>
    </div>
  );
}

export function WrongQuestionsEntry({ onStart }) {
  const { user } = useAuth();
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('wrong_questions')
      .select('id', { count: 'exact', head: true })
      .eq('examinee_id', user.id)
      .eq('mastered', false)
      .then(({ count }) => setCount(count || 0));
  }, [user]);

  if (count === null) return null;

  return (
    <div className="panel wrong-q-panel">
      <h2>Wrong questions</h2>
      <p className="muted small">
        Questions you've previously answered incorrectly, prioritized for review. They drop off
        automatically once you answer them correctly enough times.
      </p>
      <div className="wrong-q-count">{count} question{count !== 1 ? 's' : ''} to review</div>
      <button className="btn-primary" disabled={count === 0} onClick={() => onStart({ mode: 'wrong' })}>
        Practice wrong questions
      </button>
    </div>
  );
}

export function PracticeSession({ session, onExit }) {
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

  // Stable key for this practice attempt — survives refresh, but a fresh
  // "Start practice" click always gets a new key (new Date.now()) so it
  // never resumes a stale/previous session.
  const sessionKeyRef = useRef(session.resumeKey || `practice_${Date.now()}`);
  const persistKey = `dentalmcq_practice_${sessionKeyRef.current}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // If a resume payload already picked the exact question set/order, reuse it.
      try {
        const saved = JSON.parse(localStorage.getItem(persistKey) || 'null');
        if (saved && saved.questionIds && saved.questionIds.length > 0) {
          const { data } = await supabase.from('questions').select('*').in('id', saved.questionIds);
          if (cancelled || !data) return;
          const order = new Map(saved.questionIds.map((id, i) => [id, i]));
          setQuestions([...data].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
          return;
        }
      } catch {
        // fall through to fresh load
      }

      if (session.mode === 'single') {
        const { data: subcats } = await supabase.from('subcategories').select('id').eq('subject_id', session.subjectId);
        const subcatIds = (subcats || []).map((s) => s.id);
        if (subcatIds.length === 0) { if (!cancelled) setQuestions([]); return; }
        const { data: chaps } = await supabase.from('chapters').select('id').in('subcategory_id', subcatIds);
        const chapIds = (chaps || []).map((c) => c.id);
        if (chapIds.length === 0) { if (!cancelled) setQuestions([]); return; }
        const { data } = await supabase.from('questions').select('*').in('chapter_id', chapIds).eq('is_active', true);
        if (cancelled) return;
        setQuestions(shuffle(data || []).slice(0, session.count));
      } else if (session.mode === 'mixed') {
        const picked = [];
        for (const p of session.subjectPicks) {
          const { data: subcats } = await supabase.from('subcategories').select('id').eq('subject_id', p.subjectId);
          const subcatIds = (subcats || []).map((s) => s.id);
          if (subcatIds.length === 0) continue;
          const { data: chaps } = await supabase.from('chapters').select('id').in('subcategory_id', subcatIds);
          const chapIds = (chaps || []).map((c) => c.id);
          if (chapIds.length === 0) continue;
          const { data } = await supabase.from('questions').select('*').in('chapter_id', chapIds).eq('is_active', true);
          picked.push(...shuffle(data || []).slice(0, p.count));
        }
        if (cancelled) return;
        setQuestions(shuffle(picked));
      } else if (session.mode === 'bychapter') {
        const picked = [];
        for (const p of session.chapterPicks) {
          const { data } = await supabase.from('questions').select('*').eq('chapter_id', p.chapterId).eq('is_active', true);
          picked.push(...shuffle(data || []).slice(0, p.count));
        }
        if (cancelled) return;
        setQuestions(shuffle(picked));
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
        const order = new Map(ids.map((id, i) => [id, i]));
        setQuestions([...(qs || [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
      } else if (session.mode === 'randomCategory') {
        const { data: subjects } = await supabase.from('subjects').select('id').eq('category_id', session.categoryId);
        const subjectIds = (subjects || []).map((s) => s.id);
        if (subjectIds.length === 0) { setQuestions([]); return; }
        const { data: subcats } = await supabase.from('subcategories').select('id').in('subject_id', subjectIds);
        const subcatIds = (subcats || []).map((s) => s.id);
        if (subcatIds.length === 0) { setQuestions([]); return; }
        const { data: chaps } = await supabase.from('chapters').select('id').in('subcategory_id', subcatIds);
        const chapIds = (chaps || []).map((c) => c.id);
        if (chapIds.length === 0) { setQuestions([]); return; }

        // Sample from a random window instead of pulling the whole
        // category: a plain .select() is silently capped at Supabase's
        // default 1000-row limit on large categories, and even under that
        // cap it would always shuffle the same "first N" slice every time.
        const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).in('chapter_id', chapIds).eq('is_active', true);
        const total = count || 0;
        if (total === 0) { setQuestions([]); return; }
        const windowSize = Math.min(total, Math.max(session.count * 5, 100));
        const offset = Math.floor(Math.random() * (total - windowSize + 1));
        const { data } = await supabase.from('questions').select('*').in('chapter_id', chapIds).eq('is_active', true).range(offset, offset + windowSize - 1);
        if (cancelled) return;
        setQuestions(shuffle(data || []).slice(0, session.count));
      } else if (session.mode === 'bookmarked') {
        const { data: bookmarkRows } = await supabase
          .from('bookmarked_questions')
          .select('question_id')
          .eq('examinee_id', user.id)
          .order('created_at', { ascending: false });
        if (cancelled) return;
        const ids = (bookmarkRows || []).map((b) => b.question_id);
        if (ids.length === 0) { setQuestions([]); return; }
        const { data: qs } = await supabase.from('questions').select('*').in('id', ids);
        if (cancelled) return;
        const order = new Map(ids.map((id, i) => [id, i]));
        setQuestions([...(qs || [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session, user.id, persistKey]);

  // Load which of these questions are already bookmarked, once we know
  // the resolved question set — used for the in-runner bookmark toggle.
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    let cancelled = false;
    loadBookmarkedIds(user.id, questions.map((q) => q.id)).then((ids) => { if (!cancelled) setBookmarkedIds(ids); });
    return () => { cancelled = true; };
  }, [questions, user.id]);

  // Once we know the resolved question order, save it so a refresh reuses
  // the exact same set/order instead of re-randomizing.
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    try {
      const saved = JSON.parse(localStorage.getItem(persistKey) || 'null') || {};
      if (!saved.questionIds) {
        localStorage.setItem(persistKey, JSON.stringify({ ...saved, questionIds: questions.map((q) => q.id) }));
      }
    } catch {
      localStorage.setItem(persistKey, JSON.stringify({ questionIds: questions.map((q) => q.id) }));
    }
  }, [questions, persistKey]);

  const handleSubmit = async (answers, result) => {
    // Create the practice_sessions row now that we know the outcome
    const { data: sessionRow } = await supabase
      .from('practice_sessions')
      .insert({
        examinee_id: user.id,
        chapter_id: session.mode === 'bychapter' && session.chapterPicks.length === 1 ? session.chapterPicks[0].chapterId : null,
        finished_at: new Date().toISOString(),
        total_questions: questions.length,
        correct_count: result.correct,
        wrong_count: result.wrong,
      })
      .select()
      .single();

    const sessionId = sessionRow?.id;

    // 1) Write all practice_answers in one batched insert.
    if (sessionId) {
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
      if (answersError) console.error('Failed to save practice answers:', answersError.message);
    }

    // 2) Fetch every existing wrong_questions row for this batch in one
    // query, instead of one SELECT per question.
    const questionIds = questions.map((q) => q.id);
    const { data: existingRows } = await supabase
      .from('wrong_questions')
      .select('*')
      .eq('examinee_id', user.id)
      .in('question_id', questionIds);
    const existingByQuestion = new Map((existingRows || []).map((r) => [r.question_id, r]));

    // 3) Build one upsert batch covering both "now wrong" and "now
    // mastered-toward" updates, instead of per-question update/insert calls.
    const upsertRows = [];
    for (const q of questions) {
      const chosen = answers[q.id] || null;
      const isCorrect = chosen === q.correct_option;
      const existing = existingByQuestion.get(q.id);

      if (!chosen || !isCorrect) {
        upsertRows.push({
          examinee_id: user.id,
          question_id: q.id,
          wrong_count: (existing?.wrong_count || 0) + 1,
          last_wrong_at: new Date().toISOString(),
          mastered: false,
          mastered_at: null,
        });
      } else if (existing) {
        const newCount = Math.max(0, existing.wrong_count - 1);
        const mastered = newCount <= 0;
        upsertRows.push({
          examinee_id: user.id,
          question_id: q.id,
          wrong_count: newCount,
          last_wrong_at: existing.last_wrong_at,
          mastered,
          mastered_at: mastered ? new Date().toISOString() : null,
        });
      }
    }
    if (upsertRows.length > 0) {
      const { error: wrongError } = await supabase
        .from('wrong_questions')
        .upsert(upsertRows, { onConflict: 'examinee_id,question_id' });
      if (wrongError) console.error('Failed to update wrong_questions:', wrongError.message);
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

  const durationMinutes = session.minutes || Math.round(questions.length * 0.6);

  return (
    <ExamRunner
      questions={questions}
      durationMinutes={durationMinutes}
      negativeMarking={NEGATIVE_MARKING}
      title="Practice session"
      allowTimeAdjust
      persistKey={persistKey}
      onSubmit={handleSubmit}
      onExit={onExit}
      bookmarkedIds={bookmarkedIds}
      onToggleBookmark={toggleBookmark}
    />
  );
}

export function findResumablePracticeSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('dentalmcq_practice_')) continue;
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && saved.phase === 'running' && saved.endAt && saved.endAt > Date.now() && saved.questionIds?.length) {
        const resumeKey = key.replace('dentalmcq_practice_', '');
        return { resumeKey, mode: 'resume', minutes: saved.customMinutes };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export default function PracticePage({ categoryId }) {
  const { profile } = useAuth();
  const [session, setSession] = useState(null);
  const [checkedResume, setCheckedResume] = useState(false);
  const { value: globalPracticeOn, loading: globalLoading } = useAppSetting('practice_enabled_global', true);

  useEffect(() => {
    if (checkedResume) return;
    const resumable = findResumablePracticeSession();
    if (resumable) setSession(resumable);
    setCheckedResume(true);
  }, [checkedResume]);

  if (globalLoading) return null;

  if (!globalPracticeOn) {
    return <LockedFeature />;
  }

  if (profile && profile.practice_enabled === false) {
    return (
      <div className="panel">
        <h2>Practice mode</h2>
        <p className="muted">
          Practice mode has been disabled for your account by an administrator. Contact them via
          the Notice Board or your exam coordinator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  if (!checkedResume) return null;

  if (session) {
    return <PracticeSession session={session} onExit={() => setSession(null)} />;
  }

  return (
    <>
      <PracticeSetup categoryId={categoryId} onPick={setSession} />
      <WrongQuestionsEntry onStart={setSession} />
    </>
  );
}
