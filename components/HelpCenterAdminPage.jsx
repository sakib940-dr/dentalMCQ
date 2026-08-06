import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function SectionEditor({ section, onSaved, onCancel }) {
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !body.trim()) { setError('Title and content are both required.'); return; }
    setSaving(true);
    const { error: saveError } = section.id
      ? await supabase.from('help_center_sections').update({ title: title.trim(), body: body.trim(), updated_at: new Date().toISOString() }).eq('id', section.id)
      : await supabase.from('help_center_sections').insert({ title: title.trim(), body: body.trim(), display_order: section.display_order });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onSaved();
  };

  return (
    <form className="exam-form-fields" onSubmit={submit}>
      <label>
        <span>Title (emoji + heading, e.g. "📝 Account Registration")</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        <span>Content — separate paragraphs with a blank line. No formatting tags needed.</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} />
      </label>
      {error && <div className="error-box">{error}</div>}
      <div className="exam-setup-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

export default function HelpCenterAdminPage() {
  const [sections, setSections] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('help_center_sections').select('*').order('display_order');
    setSections(data || []);
  };

  useEffect(() => { load(); }, []);

  const remove = async (section) => {
    if (!confirm(`Delete "${section.title}"?`)) return;
    await supabase.from('help_center_sections').delete().eq('id', section.id);
    load();
  };

  const move = async (index, dir) => {
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= sections.length) return;
    const a = sections[index];
    const b = sections[swapWith];
    await Promise.all([
      supabase.from('help_center_sections').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('help_center_sections').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    load();
  };

  const nextOrder = () => (sections && sections.length > 0 ? Math.max(...sections.map((s) => s.display_order)) + 10 : 10);

  if (sections === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <div className="panel-head-row">
        <h2>Help Center</h2>
        {!adding && <button className="btn-primary sm" onClick={() => setAdding(true)}>+ Add section</button>}
      </div>
      <p className="muted small">Edit exactly what students see on the public Help Center page — changes go live immediately, no deploy needed.</p>

      {adding && (
        <div style={{ marginTop: 12 }}>
          <SectionEditor
            section={{ title: '', body: '', display_order: nextOrder() }}
            onSaved={() => { setAdding(false); load(); }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <div className="recent-list" style={{ marginTop: 14 }}>
        {sections.map((s, i) => (
          <div key={s.id} className="notice-card" style={{ marginBottom: 10 }}>
            {editingId === s.id ? (
              <SectionEditor
                section={s}
                onSaved={() => { setEditingId(null); load(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="notice-card-title">{s.title}</div>
                <div className="notice-card-body">{s.body.split(/\n\s*\n/)[0]}{s.body.includes('\n\n') ? '…' : ''}</div>
                <div className="notice-card-actions">
                  <button className="btn-secondary sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn-secondary sm" onClick={() => move(i, 1)} disabled={i === sections.length - 1}>↓</button>
                  <button className="btn-secondary" onClick={() => setEditingId(s.id)}>Edit</button>
                  <button className="btn-danger sm" onClick={() => remove(s)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {sections.length === 0 && !adding && <p className="muted small">No sections yet — add one above.</p>}
    </div>
  );
}
