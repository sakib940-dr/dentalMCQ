import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import ExamRunner from './ExamRunner';

const DEFAULT_MINUTES_PER_10 = 6;
const NEGATIVE_MARKING = 0.5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ChapterPicker({ onPick }) {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryId, setSubcategoryId] = useState('');
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [numQuestions, setNumQuestions] = useState(20);

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);
  useEffect(() => {
    setSubjectId(''); setSubcategoryId(''); setChapterId('');
    if (!categoryId) { setSubjects([]); return; }
    supabase.from('subjects').select('*').eq('category_id', categoryId).order('display_order')
      .then(({ data }) => setSubjects(data || []));
  }, [categoryId]);
  useEffect(() => {
    setSubcategoryId(''); setChapterId('');
    if (!subjectId) { setSubcategories([]); return; }
    supabase.from('subcategories').select('*').eq('subject_id', subjectId).order('display_order')
      .then(({ data }) => setSubcategories(data || []));
  }, [subjectId]);
  useEffect(() => {
    setChapterId('');
    if (!subcategoryId) { setChapters([]); return; }
    supabase.from('chapters').select('*').eq('subcategory_id', subcategoryId).order('display_order')
      .then(({ data }) => setChapters(data || []));
  }, [subcategoryId]);
  useEffect(() => {
    if (!chapterId) { setQuestionCount(0); return; }
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('chapter_id', chapterId).eq('is_active', true)
      .then(({ count }) => setQuestionCount(count || 0));
  }, [chapterId]);

  return (
    <div className="panel">
      <h2>Start practice</h2>
      <p className="muted small">Pick a chapter to practice. Practice sessions never affect your official results or merit list.</p>

      <div className="hierarchy-picker">
        <label>
          <span>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span>Subject</span>
          <select value={subjectId} disabled={!categoryId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          <span>Sub-category</span>
          <select value={subcategoryId} disabled={!subjectId} onChange={(e) => setSubcategoryId(e.target.value)}>
            <option value="">Select…</option>
            {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          <span>Chapter</span>
          <select value={chapterId} disabled={!subcategoryId} onChange={(e) => setChapterId(e.target.value)}>
            <option value="">Select…</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {chapterId && (
        <div className="practice-start-box">
          <div className="muted small">{questionCount} question{questionCount !== 1 ? 's' : ''} available in this chapter.</div>
          <label className="inline-num-field">
            <span>Number of questions</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, questionCount)}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Math.max(1, Math.min(questionCount, parseInt(e.target.value) || 1)))}
            />
          </label>
          <button
            className="btn-primary"
            disabled={questionCount === 0}
            onClick={() => onPick({ chapterId, count: numQuestions, mode: 'chapter' })}
          >
            Start practice
          </button>
        </div>
      )}
    </div>
  );
}

function WrongQuestionsEntry({ onStart }) {
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

function PracticeSession({ session, onExit }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(null);

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

      if (session.mode === 'chapter') {
        const { data } = await supabase.from('questions').select('*').eq('chapter_id', session.chapterId).eq('is_active', true);
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
        const order = new Map(ids.map((id, i) => [id, i]));
        setQuestions([...(qs || [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session, user.id, persistKey]);

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
        chapter_id: session.mode === 'chapter' ? session.chapterId : null,
        finished_at: new Date().toISOString(),
        total_questions: questions.length,
        correct_count: result.correct,
        wrong_count: result.wrong,
      })
      .select()
      .single();

    const sessionId = sessionRow?.id;

    // Record every answer + update wrong_questions tracker
    for (const q of questions) {
      const chosen = answers[q.id] || null;
      const isCorrect = chosen === q.correct_option;

      if (sessionId) {
        await supabase.from('practice_answers').insert({
          session_id: sessionId,
          question_id: q.id,
          selected_option: chosen,
          is_correct: chosen ? isCorrect : null,
        });
      }

      const { data: existing } = await supabase
        .from('wrong_questions')
        .select('*')
        .eq('examinee_id', user.id)
        .eq('question_id', q.id)
        .maybeSingle();

      if (!chosen || !isCorrect) {
        // wrong or skipped — count as wrong
        if (existing) {
          await supabase.from('wrong_questions').update({
            wrong_count: existing.wrong_count + 1,
            last_wrong_at: new Date().toISOString(),
            mastered: false,
            mastered_at: null,
          }).eq('id', existing.id);
        } else {
          await supabase.from('wrong_questions').insert({ examinee_id: user.id, question_id: q.id, wrong_count: 1 });
        }
      } else if (existing) {
        // correct — nudge toward mastery
        const newCount = Math.max(0, existing.wrong_count - 1);
        const mastered = newCount <= 0;
        await supabase.from('wrong_questions').update({
          wrong_count: newCount,
          mastered,
          mastered_at: mastered ? new Date().toISOString() : null,
        }).eq('id', existing.id);
      }
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

  const durationMinutes = Math.ceil(questions.length / 10) * DEFAULT_MINUTES_PER_10;

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
    />
  );
}

function findResumablePracticeSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('dentalmcq_practice_')) continue;
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && saved.phase === 'running' && saved.endAt && saved.endAt > Date.now()) {
        const resumeKey = key.replace('dentalmcq_practice_', '');
        return { resumeKey, mode: saved.mode || 'chapter', chapterId: saved.chapterId, count: saved.count };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export default function PracticePage() {
  const { profile } = useAuth();
  const [session, setSession] = useState(null);
  const [checkedResume, setCheckedResume] = useState(false);

  useEffect(() => {
    if (checkedResume) return;
    const resumable = findResumablePracticeSession();
    if (resumable) setSession(resumable);
    setCheckedResume(true);
  }, [checkedResume]);

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
      <ChapterPicker onPick={setSession} />
      <WrongQuestionsEntry onStart={setSession} />
    </>
  );
}
