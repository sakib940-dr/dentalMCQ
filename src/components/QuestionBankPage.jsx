import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabaseClient';

const CsvQuestionImporter = lazy(() => import('./CsvQuestionImporter'));

function HierarchyPicker({ value, onChange }) {
  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [chapters, setChapters] = useState([]);

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!value.categoryId) { setSubjects([]); return; }
    supabase.from('subjects').select('*').eq('category_id', value.categoryId).order('display_order')
      .then(({ data }) => setSubjects(data || []));
  }, [value.categoryId]);

  useEffect(() => {
    if (!value.subjectId) { setSubcategories([]); return; }
    supabase.from('subcategories').select('*').eq('subject_id', value.subjectId).order('display_order')
      .then(({ data }) => setSubcategories(data || []));
  }, [value.subjectId]);

  useEffect(() => {
    if (!value.subcategoryId) { setChapters([]); return; }
    supabase.from('chapters').select('*').eq('subcategory_id', value.subcategoryId).order('display_order')
      .then(({ data }) => setChapters(data || []));
  }, [value.subcategoryId]);

  return (
    <div className="hierarchy-picker">
      <label>
        <span>Category</span>
        <select
          value={value.categoryId || ''}
          onChange={(e) => onChange({ categoryId: e.target.value || null, subjectId: null, subcategoryId: null, chapterId: null })}
        >
          <option value="">Select…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label>
        <span>Subject</span>
        <select
          value={value.subjectId || ''}
          disabled={!value.categoryId}
          onChange={(e) => onChange({ ...value, subjectId: e.target.value || null, subcategoryId: null, chapterId: null })}
        >
          <option value="">Select…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <label>
        <span>Sub-category</span>
        <select
          value={value.subcategoryId || ''}
          disabled={!value.subjectId}
          onChange={(e) => onChange({ ...value, subcategoryId: e.target.value || null, chapterId: null })}
        >
          <option value="">Select…</option>
          {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <label>
        <span>Chapter</span>
        <select
          value={value.chapterId || ''}
          disabled={!value.subcategoryId}
          onChange={(e) => onChange({ ...value, chapterId: e.target.value || null })}
        >
          <option value="">Select…</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
    </div>
  );
}

function ManualQuestionForm({ chapterId, onAdded }) {
  const blank = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', explanation: '' };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!chapterId) { setError('Select a chapter first.'); return; }
    if (!form.question_text.trim() || !form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) {
      setError('Fill in the question and all four options.');
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from('questions').insert({ ...form, chapter_id: chapterId });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm(blank);
    onAdded?.();
  };

  return (
    <form className="manual-q-form" onSubmit={submit}>
      <label>
        <span>Question</span>
        <textarea value={form.question_text} onChange={update('question_text')} rows={2} />
      </label>
      <div className="option-grid">
        {['A', 'B', 'C', 'D'].map((letter) => (
          <label key={letter}>
            <span>Option {letter}</span>
            <input value={form[`option_${letter.toLowerCase()}`]} onChange={update(`option_${letter.toLowerCase()}`)} />
          </label>
        ))}
      </div>
      <label>
        <span>Correct answer</span>
        <select value={form.correct_option} onChange={update('correct_option')}>
          {['A', 'B', 'C', 'D'].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <label>
        <span>Explanation (optional)</span>
        <textarea value={form.explanation} onChange={update('explanation')} rows={2} />
      </label>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" className="btn-primary" disabled={saving || !chapterId}>
        {saving ? 'Saving…' : 'Add question'}
      </button>
    </form>
  );
}

function QuestionList({ chapterId, refreshKey }) {
  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!chapterId) { setQuestions([]); setTotal(0); return; }
    let query = supabase
      .from('questions')
      .select('*', { count: 'exact' })
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (search.trim()) {
      query = query.ilike('question_text', `%${search.trim()}%`);
    }

    const { data, count } = await query;
    setQuestions(data || []);
    setTotal(count || 0);
  }, [chapterId, search, page]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(0); }, [chapterId, search]);

  const toggleSelect = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected question(s)? This cannot be undone.`)) return;
    await supabase.from('questions').delete().in('id', Array.from(selected));
    setSelected(new Set());
    load();
  };

  const exportCsv = async () => {
    if (!chapterId) return;
    const { data } = await supabase.from('questions').select('*').eq('chapter_id', chapterId);
    if (!data || data.length === 0) return;
    const csv = Papa.unparse(
      data.map((q) => ({
        question: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_option,
        explanation: q.explanation || '',
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!chapterId) {
    return <div className="muted">Select a chapter above to view its questions.</div>;
  }

  return (
    <div className="question-list">
      <div className="question-list-toolbar">
        <input
          className="search-input"
          placeholder="Search questions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-secondary" onClick={exportCsv} disabled={total === 0}>Export CSV</button>
        <button className="btn-danger" onClick={bulkDelete} disabled={selected.size === 0}>
          Delete selected ({selected.size})
        </button>
      </div>

      <div className="q-list-count">{total} question{total !== 1 ? 's' : ''} in this chapter</div>

      {questions.map((q) => (
        <div key={q.id} className="q-row">
          <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)} />
          <div className="q-row-body">
            <div className="q-row-text">{q.question_text}</div>
            <div className="opt-list opt-list-compact">
              {['A', 'B', 'C', 'D'].map((letter) => {
                const isCorrectOpt = letter === q.correct_option;
                return (
                  <div key={letter} className={isCorrectOpt ? 'opt-btn opt-static opt-correct' : 'opt-btn opt-static'}>
                    <span className="opt-letter">{letter}</span>
                    <span className="opt-text">{q[`option_${letter.toLowerCase()}`]}</span>
                    {isCorrectOpt && <span className="opt-tag-correct">✓ correct</span>}
                  </div>
                );
              })}
            </div>
            {q.explanation && <div className="q-row-explanation">💡 {q.explanation}</div>}
          </div>
        </div>
      ))}

      {total > pageSize && (
        <div className="pagination">
          <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page + 1} of {Math.ceil(total / pageSize)}</span>
          <button className="btn-secondary" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

async function exportFullQuestionBank(setExporting) {
  setExporting(true);
  try {
    const [{ data: cats }, { data: subs }, { data: subcats }, { data: chaps }] = await Promise.all([
      supabase.from('categories').select('id, name'),
      supabase.from('subjects').select('id, name, category_id'),
      supabase.from('subcategories').select('id, name, subject_id'),
      supabase.from('chapters').select('id, name, subcategory_id'),
    ]);
    const catById = new Map((cats || []).map((c) => [c.id, c.name]));
    const subById = new Map((subs || []).map((s) => [s.id, s]));
    const subcatById = new Map((subcats || []).map((sc) => [sc.id, sc]));
    const chapById = new Map((chaps || []).map((c) => [c.id, c]));

    // Paginate through every question — a plain .select('*') silently
    // caps at 1000 rows, which would make this a partial "backup" of a
    // 4000+ question category without anyone noticing.
    let allQuestions = [];
    let from = 0;
    const pageSize = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase.from('questions').select('*').range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      allQuestions = allQuestions.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const rows = allQuestions.map((q) => {
      const chap = chapById.get(q.chapter_id);
      const subcat = chap ? subcatById.get(chap.subcategory_id) : null;
      const sub = subcat ? subById.get(subcat.subject_id) : null;
      return {
        category: sub ? catById.get(sub.category_id) || '' : '',
        subject: sub?.name || '',
        subcategory: subcat?.name || '',
        chapter: chap?.name || '',
        question: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_option,
        explanation: q.explanation || '',
        is_active: q.is_active,
      };
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `question_bank_backup_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    setExporting(false);
  }
}

export default function QuestionBankPage() {
  const [hierarchy, setHierarchy] = useState({ categoryId: null, subjectId: null, subcategoryId: null, chapterId: null });
  const [mode, setMode] = useState('list'); // list | manual | csv
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="panel">
      <div className="panel-head-row">
        <h2>Question Bank</h2>
        <button className="btn-secondary sm" onClick={() => exportFullQuestionBank(setExporting)} disabled={exporting}>
          {exporting ? 'Exporting…' : '⬇ Backup entire bank'}
        </button>
      </div>
      <HierarchyPicker value={hierarchy} onChange={setHierarchy} />

      <div className="mode-tabs">
        <button className={mode === 'list' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('list')}>Browse</button>
        <button className={mode === 'manual' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('manual')}>Add manually</button>
        <button className={mode === 'csv' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('csv')}>Import CSV</button>
      </div>

      <div className="mode-body">
        {mode === 'list' && <QuestionList chapterId={hierarchy.chapterId} refreshKey={refreshKey} />}
        {mode === 'manual' && <ManualQuestionForm chapterId={hierarchy.chapterId} onAdded={() => { bump(); setMode('list'); }} />}
        {mode === 'csv' && (
          <Suspense fallback={<div className="muted small">Loading importer…</div>}>
            <CsvQuestionImporter chapterId={hierarchy.chapterId} onImported={() => { bump(); setMode('list'); }} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
