import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtScheduleDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ExamSchedulePage() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [entries, setEntries] = useState([]);
  const [date, setDate] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  const load = useCallback(async () => {
    if (!categoryId) { setEntries([]); return; }
    const { data } = await supabase.from('exam_schedule_entries').select('*').eq('category_id', categoryId).order('scheduled_date');
    setEntries(data || []);
  }, [categoryId]);

  useEffect(() => { load(); }, [load]);

  const addEntry = async (e) => {
    e.preventDefault();
    if (!date || !syllabus.trim()) return;
    setSaving(true);
    await supabase.from('exam_schedule_entries').insert({
      category_id: categoryId,
      scheduled_date: date,
      subject_syllabus: syllabus.trim(),
      notes: notes.trim() || null,
      display_order: entries.length,
    });
    setSaving(false);
    setDate('');
    setSyllabus('');
    setNotes('');
    load();
  };

  const removeEntry = async (id) => {
    await supabase.from('exam_schedule_entries').delete().eq('id', id);
    load();
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="panel">
      <h2>Exam Schedule</h2>
      <p className="muted small">
        Publish a routine — date and which subject/syllabus is coming up — so students know what
        to prepare for. This is separate from actual exams; it's just an announcement timetable.
      </p>

      <label className="field-block" style={{ marginTop: 14 }}>
        <span>Category</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Select a category…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      {!categoryId && <div className="muted small">Pick a category above to view or add its schedule.</div>}

      {categoryId && (
        <>
          <h3 className="section-subtitle">Schedule for "{selectedCategory?.name}"</h3>

          {entries.length === 0 && <div className="muted small">No schedule entries yet — add the first one below.</div>}
          <div className="schedule-list" style={{ marginTop: 10 }}>
            {entries.map((e) => (
              <div key={e.id} className="schedule-admin-row">
                <div className="schedule-admin-row-main">
                  <div className="schedule-admin-date">{fmtScheduleDate(e.scheduled_date)}</div>
                  <div className="schedule-admin-syllabus">{e.subject_syllabus}</div>
                  {e.notes && <div className="muted small">{e.notes}</div>}
                </div>
                <button className="icon-btn-danger" onClick={() => removeEntry(e.id)} aria-label="Remove">✕</button>
              </div>
            ))}
          </div>

          <form className="schedule-add-form" onSubmit={addEntry} style={{ marginTop: 14 }}>
            <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} required />
            <input value={syllabus} onChange={(ev) => setSyllabus(ev.target.value)} placeholder="Subject / syllabus (e.g. Dental Anatomy Part 2)" required />
            <input value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="Notes (optional)" />
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : '+ Add to schedule'}</button>
          </form>
        </>
      )}
    </div>
  );
}
