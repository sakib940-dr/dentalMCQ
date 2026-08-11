import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { RandomSelector } from './QuestionSelector';
import { IconTarget, IconDices, IconFileText, IconEdit3 } from '../lib/adminIcons';

function toDateOnly(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Given a date-only string (yyyy-mm-dd) from a start_time input, build the
// default availability window: 12:01 AM to 11:59 PM of that same day.
function defaultWindowFromDate(dateStr) {
  if (!dateStr) return { start: '', end: '' };
  return {
    start: `${dateStr}T00:01`,
    end: `${dateStr}T23:59`,
  };
}

// ============================================================
// Step 1 — Exam Create chooser: 4 ways to build an exam's question set.
// Only Manual/Custom and Random are wired up; CSV import and manually
// typing questions straight into an exam are flagged Coming Soon.
// ============================================================
function ExamCreateChooser({ onSelect, onCancel }) {
  return (
    <div className="panel">
      <div className="panel-head-row">
        <h2>Create Exam</h2>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
      <p className="muted small" style={{ marginBottom: 12 }}>Choose how you'd like to build this exam's question set.</p>

      <div className="exam-create-chooser">
        <button className="exam-create-option-card" onClick={() => onSelect('manual')}>
          <span className="exam-create-option-icon"><IconTarget size={24} /></span>
          <span className="exam-create-option-title">Manual / Custom Question Selection</span>
          <span className="exam-create-option-desc">Hand-pick questions from the existing question bank.</span>
        </button>
        <button className="exam-create-option-card" onClick={() => onSelect('random')}>
          <span className="exam-create-option-icon"><IconDices size={24} /></span>
          <span className="exam-create-option-title">Random Question Selection</span>
          <span className="exam-create-option-desc">Auto-pick by Category / Subject / Chapter.</span>
        </button>
        <button className="exam-create-option-card exam-create-option-disabled" disabled>
          <span className="exam-create-option-badge">Coming soon</span>
          <span className="exam-create-option-icon"><IconFileText size={24} /></span>
          <span className="exam-create-option-title">CSV Question Import</span>
          <span className="exam-create-option-desc">Build an exam directly from a CSV file.</span>
        </button>
        <button className="exam-create-option-card exam-create-option-disabled" disabled>
          <span className="exam-create-option-badge">Coming soon</span>
          <span className="exam-create-option-icon"><IconEdit3 size={24} /></span>
          <span className="exam-create-option-title">Manually Type Question & Options</span>
          <span className="exam-create-option-desc">Write brand-new questions straight into the exam.</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Manual / Custom Question Selection — full-page exam builder.
// Compact exam-info block + cascading Category → Subject → Sub-topic →
// Chapter filter + a compact, scrollable, checkbox question list.
// Selection persists across filter changes (it's keyed by question id,
// not by whatever the current filter happens to show).
// Also used to edit any existing exam, regardless of how it was
// originally built, since it offers full manual control.
// ============================================================
function ManualExamForm({ exam, onSaved, onCancel }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(exam?.title || '');
  const [syllabus, setSyllabus] = useState(exam?.syllabus || '');
  const [startDate, setStartDate] = useState(toDateOnly(exam?.start_time));
  const [endDate, setEndDate] = useState(toDateOnly(exam?.end_time));
  const [endDateTouched, setEndDateTouched] = useState(!!exam);
  const [timerMinutes, setTimerMinutes] = useState(exam?.duration_minutes ?? 0);
  const [timerTouched, setTimerTouched] = useState(!!exam);
  const [negativeMarking, setNegativeMarking] = useState(exam?.negative_marking ?? 0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [filters, setFilters] = useState({
    categoryId: exam?.category_id || '',
    subjectId: '',
    subcategoryId: '',
    chapterId: '',
  });
  const [questions, setQuestions] = useState([]);
  const [chapterNameById, setChapterNameById] = useState(new Map());
  const [questionsLoading, setQuestionsLoading] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!exam) return;
    supabase.from('exam_questions').select('question_id').eq('exam_id', exam.id).then(({ data }) => {
      setSelectedIds(new Set((data || []).map((r) => r.question_id)));
    });
  }, [exam]);

  useEffect(() => {
    if (!filters.categoryId) { setSubjects([]); return; }
    supabase.from('subjects').select('*').eq('category_id', filters.categoryId).order('display_order')
      .then(({ data }) => setSubjects(data || []));
  }, [filters.categoryId]);

  useEffect(() => {
    if (!filters.subjectId) { setSubcategories([]); return; }
    supabase.from('subcategories').select('*').eq('subject_id', filters.subjectId).order('display_order')
      .then(({ data }) => setSubcategories(data || []));
  }, [filters.subjectId]);

  useEffect(() => {
    if (!filters.subcategoryId) { setChapters([]); return; }
    supabase.from('chapters').select('*').eq('subcategory_id', filters.subcategoryId).order('display_order')
      .then(({ data }) => setChapters(data || []));
  }, [filters.subcategoryId]);

  // Cascading question fetch — resolves whichever level is the deepest
  // one currently selected (Chapter > Sub-topic > Subject > Category),
  // then loads every active question underneath it.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { categoryId, subjectId, subcategoryId, chapterId } = filters;
      if (!categoryId) { setQuestions([]); return; }
      setQuestionsLoading(true);

      let chapterIds = [];
      let nameMap = new Map();

      if (chapterId) {
        chapterIds = [chapterId];
      } else if (subcategoryId) {
        const { data } = await supabase.from('chapters').select('id, name').eq('subcategory_id', subcategoryId);
        chapterIds = (data || []).map((c) => c.id);
        nameMap = new Map((data || []).map((c) => [c.id, c.name]));
      } else if (subjectId) {
        const { data: subcats } = await supabase.from('subcategories').select('id').eq('subject_id', subjectId);
        const subcatIds = (subcats || []).map((s) => s.id);
        const { data: chaps } = subcatIds.length
          ? await supabase.from('chapters').select('id, name').in('subcategory_id', subcatIds)
          : { data: [] };
        chapterIds = (chaps || []).map((c) => c.id);
        nameMap = new Map((chaps || []).map((c) => [c.id, c.name]));
      } else {
        const { data: subs } = await supabase.from('subjects').select('id').eq('category_id', categoryId);
        const subjectIds = (subs || []).map((s) => s.id);
        const { data: subcats } = subjectIds.length
          ? await supabase.from('subcategories').select('id').in('subject_id', subjectIds)
          : { data: [] };
        const subcatIds = (subcats || []).map((s) => s.id);
        const { data: chaps } = subcatIds.length
          ? await supabase.from('chapters').select('id, name').in('subcategory_id', subcatIds)
          : { data: [] };
        chapterIds = (chaps || []).map((c) => c.id);
        nameMap = new Map((chaps || []).map((c) => [c.id, c.name]));
      }

      if (cancelled) return;
      setChapterNameById(nameMap);

      if (chapterIds.length === 0) { setQuestions([]); setQuestionsLoading(false); return; }

      const { data: qs } = await supabase
        .from('questions')
        .select('id, question_text, chapter_id, option_a, option_b, option_c, option_d, correct_option')
        .in('chapter_id', chapterIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setQuestions(qs || []);
      setQuestionsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [filters.categoryId, filters.subjectId, filters.subcategoryId, filters.chapterId]);

  const totalQuestions = selectedIds.size;

  // Default timer: 60% of the question count, in minutes — same rule as
  // before, still overridable by manually editing the field.
  useEffect(() => {
    if (timerTouched) return;
    setTimerMinutes(Math.round(totalQuestions * 0.6));
  }, [totalQuestions, timerTouched]);

  const handleTimerChange = (value) => {
    setTimerTouched(true);
    setTimerMinutes(Math.max(1, parseInt(value) || 1));
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    if (!endDateTouched) setEndDate(value);
  };
  const handleEndDateChange = (value) => {
    setEndDateTouched(true);
    setEndDate(value);
  };

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async (publish) => {
    setError('');
    if (!filters.categoryId) return setError('Select a category filter.');
    if (!title.trim()) return setError('Enter a title.');
    if (!startDate) return setError('Set a start date.');
    if (!endDate) return setError('Set an end date.');
    const startISO = new Date(`${startDate}T00:01`).toISOString();
    const endISO = new Date(`${endDate}T23:59`).toISOString();
    if (new Date(endISO) < new Date(startISO)) return setError('End date must be on or after the start date.');
    if (totalQuestions === 0) return setError('Select at least one question.');
    if (timerMinutes < 1) return setError('Set a timer duration of at least 1 minute.');

    setSaving(true);

    // Live exams never allow students to adjust the timer.
    const payload = {
      category_id: filters.categoryId,
      title: title.trim(),
      syllabus: syllabus.trim() || null,
      start_time: startISO,
      end_time: endISO,
      total_questions: totalQuestions,
      duration_minutes: timerMinutes,
      allow_student_time_adjust: false,
      negative_marking: negativeMarking,
      selection_mode: 'manual',
      status: publish ? 'upcoming' : 'draft',
      is_published: publish,
    };

    let examId = exam?.id;

    if (exam) {
      const { error: updateError } = await supabase.from('exams').update({ ...payload, published_by: publish ? user.id : exam.published_by }).eq('id', exam.id);
      if (updateError) { setError(updateError.message); setSaving(false); return; }
    } else {
      const { data, error: insertError } = await supabase
        .from('exams')
        .insert({ ...payload, created_by: user.id, published_by: publish ? user.id : null })
        .select()
        .single();
      if (insertError) { setError(insertError.message); setSaving(false); return; }
      examId = data.id;
    }

    // Replace exam_questions: delete old, insert new fixed set
    await supabase.from('exam_questions').delete().eq('exam_id', examId);
    const rows = Array.from(selectedIds).map((qid, i) => ({ exam_id: examId, question_id: qid, display_order: i }));
    const { error: eqError } = await supabase.from('exam_questions').insert(rows);
    if (eqError) { setError(eqError.message); setSaving(false); return; }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="panel">
      <h2>{exam ? 'Edit exam' : 'Manual / Custom Question Selection'}</h2>

      <div className="exam-info-grid exam-info-grid-compact">
        <label className="exam-info-full">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dental Anatomy Part 01" />
        </label>
        <label className="exam-info-full">
          <span>Syllabus / topic notes</span>
          <textarea value={syllabus} onChange={(e) => setSyllabus(e.target.value)} rows={2} />
        </label>
        <div className="exam-info-full exam-info-row-4">
          <label>
            <span>Start Date</span>
            <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
          </label>
          <label>
            <span>End Date</span>
            <input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} />
          </label>
          <label>
            <span>Duration (min)</span>
            <input type="number" min={1} max={300} value={timerMinutes} onChange={(e) => handleTimerChange(e.target.value)} />
          </label>
          <label>
            <span>Neg. Marking</span>
            <input type="number" min={0} max={1} step={0.05} value={negativeMarking} onChange={(e) => setNegativeMarking(Math.max(0, parseFloat(e.target.value) || 0))} />
          </label>
        </div>
      </div>

      <div className="exam-time-summary">
        {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} selected → default timer is {timerMinutes} minute{timerMinutes !== 1 ? 's' : ''}
      </div>

      <h3 className="section-subtitle sm">Filter questions</h3>
      <div className="manual-filter-grid">
        <label>
          <span>Category</span>
          <select
            value={filters.categoryId}
            onChange={(e) => setFilters({ categoryId: e.target.value, subjectId: '', subcategoryId: '', chapterId: '' })}
          >
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span>Subject</span>
          <select
            value={filters.subjectId}
            disabled={!filters.categoryId}
            onChange={(e) => setFilters((f) => ({ ...f, subjectId: e.target.value, subcategoryId: '', chapterId: '' }))}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          <span>Sub-topic</span>
          <select
            value={filters.subcategoryId}
            disabled={!filters.subjectId}
            onChange={(e) => setFilters((f) => ({ ...f, subcategoryId: e.target.value, chapterId: '' }))}
          >
            <option value="">All sub-topics</option>
            {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          <span>Chapter</span>
          <select
            value={filters.chapterId}
            disabled={!filters.subcategoryId}
            onChange={(e) => setFilters((f) => ({ ...f, chapterId: e.target.value }))}
          >
            <option value="">All chapters</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <div className="selected-count-bar">
        <span>{totalQuestions} question{totalQuestions !== 1 ? 's' : ''} selected</span>
        {totalQuestions > 0 && <button className="btn-danger sm" onClick={() => setSelectedIds(new Set())}>Clear all</button>}
      </div>

      <div className="qsel-scroll-lg">
        {!filters.categoryId && <div className="muted small" style={{ padding: '8px 6px' }}>Select a category above to see its questions.</div>}
        {filters.categoryId && questionsLoading && <div className="muted small" style={{ padding: '8px 6px' }}>Loading questions…</div>}
        {filters.categoryId && !questionsLoading && questions.length === 0 && (
          <div className="muted small" style={{ padding: '8px 6px' }}>No questions found for this filter.</div>
        )}
        {questions.map((q) => {
          const isSelected = selectedIds.has(q.id);
          return (
            <label key={q.id} className={isSelected ? 'qsel-card qsel-card-selected' : 'qsel-card'}>
              <input type="checkbox" checked={isSelected} onChange={() => toggle(q.id)} />
              <div className="qsel-card-body">
                {!filters.chapterId && chapterNameById.get(q.chapter_id) && (
                  <span className="qsel-card-tag">{chapterNameById.get(q.chapter_id)}</span>
                )}
                <div className="qsel-card-text">{q.question_text}</div>
                <div className="opt-list opt-list-compact qsel-opt-list">
                  {['A', 'B', 'C', 'D'].map((letter) => {
                    const isCorrectOpt = letter === q.correct_option;
                    return (
                      <div key={letter} className={isCorrectOpt ? 'opt-btn opt-static opt-correct' : 'opt-btn opt-static'}>
                        <span className="opt-letter">{letter}</span>
                        <span className="opt-text">{q[`option_${letter.toLowerCase()}`]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="exam-form-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn-secondary" onClick={() => save(false)} disabled={saving}>Save as draft</button>
        <button className="btn-primary" onClick={() => save(true)} disabled={saving}>
          {saving ? 'Saving…' : 'Publish exam'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Random Question Selection — unchanged logic/fields from before
// (Category + exam info fields, then the same cascading
// Subject → Sub-category → Chapter random-pick tool). Only the
// spacing was tightened and the timer-adjust checkbox removed.
// ============================================================
function RandomExamForm({ onSaved, onCancel }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [windowTouched, setWindowTouched] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerTouched, setTimerTouched] = useState(false);
  const [negativeMarking, setNegativeMarking] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  const totalQuestions = selectedIds.size;
  useEffect(() => {
    if (timerTouched) return;
    setTimerMinutes(Math.round(totalQuestions * 0.6));
  }, [totalQuestions, timerTouched]);

  const handleTimerChange = (value) => {
    setTimerTouched(true);
    setTimerMinutes(Math.max(1, parseInt(value) || 1));
  };
  const handleStartTimeChange = (value) => {
    setStartTime(value);
    if (!windowTouched && value) {
      const dateStr = value.split('T')[0];
      const { start, end } = defaultWindowFromDate(dateStr);
      setStartTime(start);
      setEndTime(end);
    }
  };
  const handleEndTimeChange = (value) => {
    setWindowTouched(true);
    setEndTime(value);
  };

  const addRandomIds = (ids) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const save = async (publish) => {
    setError('');
    if (!categoryId) return setError('Select a category.');
    if (!title.trim()) return setError('Enter a title.');
    if (!startTime) return setError('Set a start date/time.');
    if (!endTime) return setError('Set an end date/time.');
    if (new Date(endTime) <= new Date(startTime)) return setError('End time must be after start time.');
    if (totalQuestions === 0) return setError('Add at least one question using Random by chapter below.');
    if (timerMinutes < 1) return setError('Set a timer duration of at least 1 minute.');

    setSaving(true);
    const startISO = new Date(startTime).toISOString();
    const endISO = new Date(endTime).toISOString();

    const { data, error: insertError } = await supabase
      .from('exams')
      .insert({
        category_id: categoryId,
        title: title.trim(),
        syllabus: syllabus.trim() || null,
        start_time: startISO,
        end_time: endISO,
        total_questions: totalQuestions,
        duration_minutes: timerMinutes,
        allow_student_time_adjust: false,
        negative_marking: negativeMarking,
        selection_mode: 'random',
        status: publish ? 'upcoming' : 'draft',
        created_by: user.id,
        published_by: publish ? user.id : null,
        is_published: publish,
      })
      .select()
      .single();
    if (insertError) { setError(insertError.message); setSaving(false); return; }

    const rows = Array.from(selectedIds).map((qid, i) => ({ exam_id: data.id, question_id: qid, display_order: i }));
    const { error: eqError } = await supabase.from('exam_questions').insert(rows);
    if (eqError) { setError(eqError.message); setSaving(false); return; }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="panel">
      <h2>Random Question Selection</h2>
      <p className="muted small" style={{ marginBottom: 10 }}>
        Pick a Category, then Subject / Sub-category / Chapter below, and randomly add questions.
        Repeat for other chapters to keep building up the exam.
      </p>

      <div className="exam-form-fields exam-form-fields-compact">
        <label>
          <span>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dental Anatomy Part 01" />
        </label>
        <label>
          <span>Syllabus / topic notes</span>
          <textarea value={syllabus} onChange={(e) => setSyllabus(e.target.value)} rows={3} />
        </label>
        <div className="option-grid">
          <label>
            <span>Available from</span>
            <input type="datetime-local" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
          </label>
          <label>
            <span>Available until</span>
            <input type="datetime-local" value={endTime} onChange={(e) => handleEndTimeChange(e.target.value)} />
          </label>
        </div>
        <div className="option-grid">
          <label>
            <span>Timer (minutes)</span>
            <input type="number" min={1} max={300} value={timerMinutes} onChange={(e) => handleTimerChange(e.target.value)} />
          </label>
          <label>
            <span>Negative marking</span>
            <input type="number" min={0} max={1} step={0.05} value={negativeMarking} onChange={(e) => setNegativeMarking(Math.max(0, parseFloat(e.target.value) || 0))} />
          </label>
        </div>
        <div className="exam-time-summary">
          {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} selected → default timer is {timerMinutes} minute{timerMinutes !== 1 ? 's' : ''}
        </div>
      </div>

      <h3 className="section-subtitle sm">Random by chapter</h3>
      <RandomSelector categoryId={categoryId} onGenerate={addRandomIds} />

      {totalQuestions > 0 && (
        <div className="selected-count-bar" style={{ marginTop: 12 }}>
          <span>{totalQuestions} question{totalQuestions !== 1 ? 's' : ''} selected total</span>
          <button className="btn-danger sm" onClick={() => setSelectedIds(new Set())}>Clear all</button>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      <div className="exam-form-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn-secondary" onClick={() => save(false)} disabled={saving}>Save as draft</button>
        <button className="btn-primary" onClick={() => save(true)} disabled={saving}>
          {saving ? 'Saving…' : 'Publish exam'}
        </button>
      </div>
    </div>
  );
}

function computeEffectiveStatus(ex) {
  if (!ex.is_published) return 'draft';
  const now = new Date();
  const start = new Date(ex.start_time);
  const end = new Date(ex.end_time);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'live';
  return 'archived';
}

function ExamList({ onEdit, onCreate }) {
  const [exams, setExams] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.from('exams').select('*, categories(name)').order('start_time', { ascending: false }).then(({ data }) => setExams(data || []));
  }, [refreshKey]);

  const setPublishState = async (exam, publish) => {
    await supabase.from('exams').update({ is_published: publish, status: publish ? 'upcoming' : 'draft' }).eq('id', exam.id);
    setRefreshKey((k) => k + 1);
  };

  const remove = async (exam) => {
    if (!confirm(`Delete exam "${exam.title}"? This cannot be undone.`)) return;
    await supabase.from('exams').delete().eq('id', exam.id);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="panel">
      <div className="panel-head-row">
        <h2>Exams</h2>
        <button className="btn-primary" onClick={onCreate}>+ New exam</button>
      </div>

      {exams.length === 0 && <div className="muted">No exams yet.</div>}

      {exams.map((ex) => {
        const effectiveStatus = computeEffectiveStatus(ex);
        return (
          <div key={ex.id} className="exam-list-row">
            <div className="exam-list-row-main">
              <div className="exam-list-row-top">
                <span className={`status-pill status-${effectiveStatus}`}>{effectiveStatus}</span>
                <span className="exam-list-category">{ex.categories?.name}</span>
              </div>
              <div className="exam-list-title">{ex.title}</div>
              <div className="exam-list-meta">
                {ex.total_questions} questions · {ex.duration_minutes} min timer · available {new Date(ex.start_time).toLocaleString()} – {new Date(ex.end_time).toLocaleString()}
              </div>
            </div>
            <div className="exam-list-row-actions">
              <button className="btn-secondary" onClick={() => onEdit(ex)}>Edit</button>
              {!ex.is_published && <button className="btn-secondary" onClick={() => setPublishState(ex, true)}>Publish</button>}
              {ex.is_published && <button className="btn-secondary" onClick={() => setPublishState(ex, false)}>Unpublish</button>}
              <button className="btn-danger" onClick={() => remove(ex)}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExamBuilderPage() {
  // null = list | 'choose' = 4-option picker | 'manual-new' | 'random-new'
  // | exam object = editing an existing exam (always via Manual/Custom,
  // which offers full control regardless of how the exam was first built).
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => { setEditing(null); setRefreshKey((k) => k + 1); };

  if (editing === 'choose') {
    return (
      <ExamCreateChooser
        onSelect={(mode) => setEditing(mode === 'manual' ? 'manual-new' : 'random-new')}
        onCancel={() => setEditing(null)}
      />
    );
  }
  if (editing === 'manual-new') {
    return <ManualExamForm onSaved={handleSaved} onCancel={() => setEditing(null)} />;
  }
  if (editing === 'random-new') {
    return <RandomExamForm onSaved={handleSaved} onCancel={() => setEditing(null)} />;
  }
  if (editing) {
    return <ManualExamForm exam={editing} onSaved={handleSaved} onCancel={() => setEditing(null)} />;
  }

  return <ExamList key={refreshKey} onEdit={setEditing} onCreate={() => setEditing('choose')} />;
}
