import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ChapterBrowser({ categoryId, selectedIds, onToggle }) {
  const [subjects, setSubjects] = useState([]);
  const [openSubject, setOpenSubject] = useState(null);
  const [subcatsBySubject, setSubcatsBySubject] = useState({});
  const [openSubcat, setOpenSubcat] = useState(null);
  const [chaptersBySubcat, setChaptersBySubcat] = useState({});
  const [openChapter, setOpenChapter] = useState(null);
  const [questionsByChapter, setQuestionsByChapter] = useState({});

  useEffect(() => {
    if (!categoryId) { setSubjects([]); return; }
    supabase.from('subjects').select('*').eq('category_id', categoryId).order('display_order')
      .then(({ data }) => setSubjects(data || []));
  }, [categoryId]);

  const loadSubcats = async (subjectId) => {
    setOpenSubject(openSubject === subjectId ? null : subjectId);
    if (subcatsBySubject[subjectId]) return;
    const { data } = await supabase.from('subcategories').select('*').eq('subject_id', subjectId).order('display_order');
    setSubcatsBySubject((m) => ({ ...m, [subjectId]: data || [] }));
  };

  const loadChapters = async (subcatId) => {
    setOpenSubcat(openSubcat === subcatId ? null : subcatId);
    if (chaptersBySubcat[subcatId]) return;
    const { data } = await supabase.from('chapters').select('*').eq('subcategory_id', subcatId).order('display_order');
    setChaptersBySubcat((m) => ({ ...m, [subcatId]: data || [] }));
  };

  const loadQuestions = async (chapterId) => {
    setOpenChapter(openChapter === chapterId ? null : chapterId);
    if (questionsByChapter[chapterId]) return;
    const { data } = await supabase.from('questions').select('*').eq('chapter_id', chapterId).eq('is_active', true);
    setQuestionsByChapter((m) => ({ ...m, [chapterId]: data || [] }));
  };

  if (!categoryId) return <div className="muted small">Select a category above first.</div>;

  return (
    <div className="chapter-browser">
      {subjects.map((subj) => (
        <div key={subj.id} className="browser-node">
          <button className="browser-node-head" onClick={() => loadSubcats(subj.id)}>
            {openSubject === subj.id ? '▾' : '▸'} {subj.name}
          </button>
          {openSubject === subj.id && (
            <div className="browser-children">
              {(subcatsBySubject[subj.id] || []).map((sc) => (
                <div key={sc.id} className="browser-node">
                  <button className="browser-node-head" onClick={() => loadChapters(sc.id)}>
                    {openSubcat === sc.id ? '▾' : '▸'} {sc.name}
                  </button>
                  {openSubcat === sc.id && (
                    <div className="browser-children">
                      {(chaptersBySubcat[sc.id] || []).map((ch) => (
                        <div key={ch.id} className="browser-node">
                          <button className="browser-node-head" onClick={() => loadQuestions(ch.id)}>
                            {openChapter === ch.id ? '▾' : '▸'} {ch.name}
                          </button>
                          {openChapter === ch.id && (
                            <div className="browser-children q-checkbox-list">
                              {(questionsByChapter[ch.id] || []).map((q) => (
                                <label key={q.id} className="q-checkbox-row q-checkbox-row-full">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(q.id)}
                                    onChange={() => onToggle(q.id)}
                                  />
                                  <span className="q-checkbox-body">
                                    <span className="q-checkbox-question">{q.question_text}</span>
                                    <span className="q-checkbox-options">
                                      {['A', 'B', 'C', 'D'].map((letter) => (
                                        <span
                                          key={letter}
                                          className={letter === q.correct_option ? 'q-checkbox-opt q-checkbox-opt-correct' : 'q-checkbox-opt'}
                                        >
                                          {letter}. {q[`option_${letter.toLowerCase()}`]}
                                        </span>
                                      ))}
                                    </span>
                                  </span>
                                </label>
                              ))}
                              {(questionsByChapter[ch.id] || []).length === 0 && (
                                <div className="muted small">No questions in this chapter.</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RandomSelector({ categoryId, onGenerate }) {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryId, setSubcategoryId] = useState('');
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState('');
  const [count, setCount] = useState(20);
  const [available, setAvailable] = useState(0);

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

  const checkAvailable = useCallback(async () => {
    if (!chapterId) { setAvailable(0); return; }
    const { count: c } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('chapter_id', chapterId).eq('is_active', true);
    setAvailable(c || 0);
  }, [chapterId]);

  useEffect(() => { checkAvailable(); }, [checkAvailable]);

  const generate = async () => {
    if (!chapterId) return;
    const { data } = await supabase.from('questions').select('id').eq('chapter_id', chapterId).eq('is_active', true);
    const ids = shuffle(data || []).slice(0, count).map((q) => q.id);
    onGenerate(ids);
  };

  return (
    <div className="random-selector">
      <div className="hierarchy-picker">
        <label>
          <span>Subject</span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
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
        <label>
          <span>How many questions ({available} available)</span>
          <input type="number" min={1} max={Math.max(1, available)} value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(available, parseInt(e.target.value) || 1)))} />
        </label>
      </div>
      <button className="btn-secondary" disabled={!chapterId || available === 0} onClick={generate}>
        Randomly add {Math.min(count, available)} question{Math.min(count, available) !== 1 ? 's' : ''}
      </button>
    </div>
  );
}

export default function QuestionSelector({ categoryId, selectedIds, onChange }) {
  const [mode, setMode] = useState('manual');

  const toggle = (id) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  };

  const addRandomIds = (ids) => {
    const next = new Set(selectedIds);
    ids.forEach((id) => next.add(id));
    onChange(next);
  };

  return (
    <div className="question-selector">
      <div className="mode-tabs">
        <button className={mode === 'manual' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('manual')}>Manual selection</button>
        <button className={mode === 'random' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('random')}>Random by chapter</button>
      </div>

      <div className="selected-count-bar">
        {selectedIds.size} question{selectedIds.size !== 1 ? 's' : ''} selected
        {selectedIds.size > 0 && (
          <button className="btn-danger sm" onClick={() => onChange(new Set())}>Clear all</button>
        )}
      </div>

      {mode === 'manual' && <ChapterBrowser categoryId={categoryId} selectedIds={selectedIds} onToggle={toggle} />}
      {mode === 'random' && <RandomSelector categoryId={categoryId} onGenerate={addRandomIds} />}
    </div>
  );
}
