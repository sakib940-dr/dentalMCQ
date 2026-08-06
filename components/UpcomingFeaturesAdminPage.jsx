import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UpcomingFeaturesAdminPage() {
  const [features, setFeatures] = useState(null);
  const [icon, setIcon] = useState('✨');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await supabase.from('upcoming_features').select('*').order('display_order');
    setFeatures(data || []);
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!label.trim()) { setError('A name is required.'); return; }
    const nextOrder = features && features.length > 0 ? Math.max(...features.map((f) => f.display_order)) + 10 : 10;
    const { error: insertError } = await supabase.from('upcoming_features').insert({ icon: icon.trim() || '✨', label: label.trim(), display_order: nextOrder });
    if (insertError) { setError(insertError.message); return; }
    setIcon('✨');
    setLabel('');
    load();
  };

  const remove = async (f) => {
    if (!confirm(`Remove "${f.label}" from the roadmap?`)) return;
    await supabase.from('upcoming_features').delete().eq('id', f.id);
    load();
  };

  const move = async (index, dir) => {
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= features.length) return;
    const a = features[index];
    const b = features[swapWith];
    await Promise.all([
      supabase.from('upcoming_features').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('upcoming_features').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    load();
  };

  if (features === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>Upcoming Features</h2>
      <p className="muted small">The "Soon" roadmap shown on the Student Dashboard — add or remove items as modules actually get built.</p>

      <form className="compact-field-list" onSubmit={add} style={{ marginTop: 12 }}>
        <div className="compact-field-row">
          <span className="compact-field-label">Icon:</span>
          <input className="compact-field-input" style={{ maxWidth: 60 }} value={icon} onChange={(e) => setIcon(e.target.value)} />
        </div>
        <div className="compact-field-row">
          <span className="compact-field-label">Name:</span>
          <input className="compact-field-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Inventory Management" />
        </div>
        {error && <div className="error-box">{error}</div>}
        <button type="submit" className="btn-primary sm" style={{ marginTop: 8, alignSelf: 'flex-start' }}>+ Add to roadmap</button>
      </form>

      <div className="recent-list" style={{ marginTop: 16 }}>
        {features.map((f, i) => (
          <div key={f.id} className="recent-row">
            <span className="recent-name">{f.icon} {f.label}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-secondary sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="btn-secondary sm" onClick={() => move(i, 1)} disabled={i === features.length - 1}>↓</button>
              <button className="btn-danger sm" onClick={() => remove(f)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {features.length === 0 && <p className="muted small">Nothing on the roadmap right now.</p>}
    </div>
  );
}
