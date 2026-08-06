import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fmtDateTime } from '../lib/formatters';

const TYPE_LABELS = { bug: '🐛 Bug', feature: '💡 Feature', general: '💬 General' };
const STATUS_OPTIONS = ['new', 'reviewed', 'resolved'];

export default function FeedbackAdminPage() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    const { data } = await supabase
      .from('feedback')
      .select('*, profiles(full_name, username)')
      .order('created_at', { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    setItems((its) => its.map((it) => (it.id === id ? { ...it, status } : it)));
    await supabase.from('feedback').update({ status }).eq('id', id);
  };

  const remove = async (id) => {
    if (!confirm('Delete this feedback entry?')) return;
    setItems((its) => its.filter((it) => it.id !== id));
    await supabase.from('feedback').delete().eq('id', id);
  };

  if (items === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  const visible = filter === 'all' ? items : items.filter((it) => it.type === filter);
  const newCount = items.filter((it) => it.status === 'new').length;

  return (
    <div className="panel">
      <div className="panel-head-row">
        <h2>Feedback</h2>
        <span className="muted small">{newCount} new</span>
      </div>

      <div className="mode-tabs" style={{ marginTop: 10 }}>
        {['all', 'bug', 'feature', 'general'].map((f) => (
          <button key={f} className={filter === f ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="muted small" style={{ marginTop: 12 }}>Nothing here yet.</p>}

      <div className="recent-list" style={{ marginTop: 10 }}>
        {visible.map((it) => (
          <div key={it.id} className="feedback-row">
            <div className="feedback-row-head">
              <span>{TYPE_LABELS[it.type] || it.type}</span>
              <span className="muted small">{it.profiles?.full_name || 'Unknown'} · {fmtDateTime(it.created_at)}</span>
            </div>
            {it.rating && <div style={{ margin: '4px 0' }}>{'★'.repeat(it.rating)}{'☆'.repeat(5 - it.rating)}</div>}
            {it.message && <p style={{ margin: '4px 0', fontSize: 13.5 }}>{it.message}</p>}
            <select
              className="role-filter-select"
              value={it.status}
              onChange={(e) => updateStatus(it.id, e.target.value)}
              style={{ marginTop: 6 }}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn-danger sm" style={{ marginTop: 6, marginLeft: 6 }} onClick={() => remove(it.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
