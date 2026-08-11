import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { IconPencil, IconX } from '../lib/adminIcons';

function fmtScheduleDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function EditEntryForm({ entry, onSaved, onCancel }) {
  const [date, setDate] = useState(entry.scheduled_date);
  const [syllabus, setSyllabus] = useState(entry.subject_syllabus);
  const [notes, setNotes] = useState(entry.notes || '');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!date || !syllabus.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('exam_schedule_entries').update({
      scheduled_date: date,
      subject_syllabus: syllabus.trim(),
      notes: notes.trim() || null,
    }).eq('id', entry.id).select();
    setSaving(false);
    if (error) {
      alert('Could not save changes: ' + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert('Changes were not saved. You may not have permission to edit this schedule entry (check database access rules).');
      return;
    }
    onSaved();
  };

  return (
    <form className="schedule-add-form" onSubmit={submit} style={{ marginTop: 8 }}>
      <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} required />
      <input value={syllabus} onChange={(ev) => setSyllabus(ev.target.value)} placeholder="Subject / syllabus" required />
      <input value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="Notes (optional)" />
      <div className="exam-setup-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}

export default function ExamSchedulePage() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [entries, setEntries] = useState([]);
  const [date, setDate] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

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
    const { error } = await supabase.from('exam_schedule_entries').insert({
      category_id: categoryId,
      scheduled_date: date,
      subject_syllabus: syllabus.trim(),
      notes: notes.trim() || null,
      display_order: entries.length,
    });
    setSaving(false);
    if (error) {
      alert('Could not add schedule entry: ' + error.message);
      return;
    }
    setDate('');
    setSyllabus('');
    setNotes('');
    load();
  };

  const removeEntry = async (id) => {
    const { error } = await supabase.from('exam_schedule_entries').delete().eq('id', id);
    if (error) {
      alert('Could not delete schedule entry: ' + error.message);
      return;
    }
    if (editingId === id) setEditingId(null);
    load();
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const today = todayStr();
  const upcomingEntries = entries
    .filter((e) => e.scheduled_date >= today)
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
  const pastEntries = entries
    .filter((e) => e.scheduled_date < today)
    .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));

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

          {entries.length > 0 && (
            <>
              <h4 className="section-subtitle" style={{ marginTop: 12 }}>Upcoming Exams</h4>
              {upcomingEntries.length === 0 && <div className="muted small">Nothing upcoming.</div>}
              <div className="schedule-list" style={{ marginTop: 10 }}>
                {upcomingEntries.map((e) => (
                  <div key={e.id} className="schedule-admin-row">
                    {editingId === e.id ? (
                      <EditEntryForm entry={e} onSaved={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
                    ) : (
                      <>
                        <div className="schedule-admin-row-main">
                          <div className="schedule-admin-date">{fmtScheduleDate(e.scheduled_date)}</div>
                          <div className="schedule-admin-syllabus">{e.subject_syllabus}</div>
                          {e.notes && <div className="muted small">{e.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="icon-btn" onClick={() => setEditingId(e.id)} title="Edit"><IconPencil size={14} /></button>
                          <button className="icon-btn-danger" onClick={() => removeEntry(e.id)} aria-label="Remove"><IconX size={14} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <h4 className="section-subtitle" style={{ marginTop: 18 }}>Archive / Past Exams</h4>
              {pastEntries.length === 0 && <div className="muted small">No past entries yet.</div>}
              <div className="schedule-list" style={{ marginTop: 10 }}>
                {pastEntries.map((e) => (
                  <div key={e.id} className="schedule-admin-row">
                    {editingId === e.id ? (
                      <EditEntryForm entry={e} onSaved={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
                    ) : (
                      <>
                        <div className="schedule-admin-row-main">
                          <div className="schedule-admin-date">{fmtScheduleDate(e.scheduled_date)}</div>
                          <div className="schedule-admin-syllabus">{e.subject_syllabus}</div>
                          {e.notes && <div className="muted small">{e.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="icon-btn" onClick={() => setEditingId(e.id)} title="Edit"><IconPencil size={14} /></button>
                          <button className="icon-btn-danger" onClick={() => removeEntry(e.id)} aria-label="Remove"><IconX size={14} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

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
