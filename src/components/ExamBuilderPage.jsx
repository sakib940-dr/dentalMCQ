import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import QuestionSelector from './QuestionSelector';

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ExamForm({ exam, onSaved, onCancel }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(exam?.category_id || '');
  const [title, setTitle] = useState(exam?.title || '');
  const [syllabus, setSyllabus] = useState(exam?.syllabus || '');
  const [startTime, setStartTime] = useState(toLocalInputValue(exam?.start_time) || '');
  const [minutesPer10, setMinutesPer10] = useState(exam?.minutes_per_10 ?? 6);
  const [allowAdjust, setAllowAdjust] = useState(exam?.allow_student_time_adjust ?? true);
  const [negativeMarking, setNegativeMarking] = useState(exam?.negative_marking ?? 0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!exam) return;
    supabase.from('exam_questions').select('question_id').eq('exam_id', exam.id).then(({ data }) => {
      setSelectedIds(new Set((data || []).map((r) => r.question_id)));
    });
  }, [exam]);

  const totalQuestions = selectedIds.size;
  const totalMinutes = Math.ceil(totalQuestions / 10) * minutesPer10;

  const save = async (publish) => {
    setError('');
    if (!categoryId) return setError('Select a category.');
    if (!title.trim()) return setError('Enter a title.');
    if (!startTime) return setError('Set a start date/time.');
    if (totalQuestions === 0) return setError('Select at least one question.');

    setSaving(true);
    const startISO = new Date(startTime).toISOString();
    const endISO = new Date(new Date(startTime).getTime() + totalMinutes * 60000).toISOString();

    const payload = {
      category_id: categoryId,
      title: title.trim(),
      syllabus: syllabus.trim() || null,
      start_time: startISO,
      end_time: endISO,
      total_questions: totalQuestions,
      minutes_per_10: minutesPer10,
      allow_student_time_adjust: allowAdjust,
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
      <h2>{exam ? 'Edit exam' : 'Create exam'}</h2>

      <div className="exam-form-fields">
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
        <label>
          <span>Start date &amp; time</span>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <div className="option-grid">
          <label>
            <span>Minutes per 10 questions</span>
            <input type="number" min={1} max={60} value={minutesPer10} onChange={(e) => setMinutesPer10(Math.max(1, parseInt(e.target.value) || 1))} />
          </label>
          <label>
            <span>Negative marking (per wrong answer)</span>
            <input type="number" min={0} max={1} step={0.05} value={negativeMarking} onChange={(e) => setNegativeMarking(Math.max(0, parseFloat(e.target.value) || 0))} />
          </label>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={allowAdjust} onChange={(e) => setAllowAdjust(e.target.checked)} />
          <span>Allow students to adjust the timer before starting</span>
        </label>

        <div className="exam-time-summary">
          {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} selected → {totalMinutes} minute{totalMinutes !== 1 ? 's' : ''} total
          (at {minutesPer10} min / 10 questions)
        </div>
      </div>

      <h3 className="section-subtitle">Select questions</h3>
      <QuestionSelector categoryId={categoryId} selectedIds={selectedIds} onChange={setSelectedIds} />

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

function ExamList({ onEdit, onCreate }) {
  const [exams, setExams] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase.from('exams').select('*, categories(name)').order('start_time', { ascending: false });
    setExams(data || []);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const setStatus = async (exam, status) => {
    await supabase.from('exams').update({ status, is_published: status !== 'draft' }).eq('id', exam.id);
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

      {exams.map((ex) => (
        <div key={ex.id} className="exam-list-row">
          <div className="exam-list-row-main">
            <div className="exam-list-row-top">
              <span className={`status-pill status-${ex.status}`}>{ex.status}</span>
              <span className="exam-list-category">{ex.categories?.name}</span>
            </div>
            <div className="exam-list-title">{ex.title}</div>
            <div className="exam-list-meta">
              {ex.total_questions} questions · {ex.duration_minutes} min · {new Date(ex.start_time).toLocaleString()}
            </div>
          </div>
          <div className="exam-list-row-actions">
            <button className="btn-secondary" onClick={() => onEdit(ex)}>Edit</button>
            {ex.status === 'draft' && <button className="btn-secondary" onClick={() => setStatus(ex, 'upcoming')}>Publish</button>}
            {ex.status !== 'archived' && <button className="btn-secondary" onClick={() => setStatus(ex, 'archived')}>Archive</button>}
            {ex.status === 'archived' && <button className="btn-secondary" onClick={() => setStatus(ex, 'upcoming')}>Restore</button>}
            <button className="btn-danger" onClick={() => remove(ex)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExamBuilderPage() {
  const [editing, setEditing] = useState(null); // null = list, 'new' = create, exam object = edit
  const [refreshKey, setRefreshKey] = useState(0);

  if (editing === 'new') {
    return <ExamForm onSaved={() => { setEditing(null); setRefreshKey((k) => k + 1); }} onCancel={() => setEditing(null)} />;
  }
  if (editing) {
    return <ExamForm exam={editing} onSaved={() => { setEditing(null); setRefreshKey((k) => k + 1); }} onCancel={() => setEditing(null)} />;
  }

  return <ExamList key={refreshKey} onEdit={setEditing} onCreate={() => setEditing('new')} />;
}
