import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import PracticeRunner from './PracticeRunner';

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

export default function PracticePage() {
  const { profile } = useAuth();
  const [session, setSession] = useState(null); // { chapterId, count, mode } | { mode: 'wrong' }

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

  if (session) {
    return <PracticeRunner session={session} onExit={() => setSession(null)} />;
  }

  return (
    <>
      <ChapterPicker onPick={setSession} />
      <WrongQuestionsEntry onStart={setSession} />
    </>
  );
}
