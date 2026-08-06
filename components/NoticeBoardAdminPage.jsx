import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function NewNoticeForm({ onPosted }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !body.trim()) { setError('Title and message are both required.'); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from('notices').insert({
      title: title.trim(),
      body: body.trim(),
      is_pinned: pinned,
      posted_by: user.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setTitle('');
    setBody('');
    setPinned(false);
    onPosted();
  };

  return (
    <form className="exam-form-fields" onSubmit={submit}>
      <label>
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Exam schedule update" />
      </label>
      <label>
        <span>Message</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <span>Pin to top</span>
      </label>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Posting…' : 'Post notice'}
      </button>
    </form>
  );
}

function EditNoticeForm({ notice, onSaved, onCancel }) {
  const [title, setTitle] = useState(notice.title);
  const [body, setBody] = useState(notice.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !body.trim()) { setError('Title and message are both required.'); return; }
    setSaving(true);
    const { error: updateError } = await supabase
      .from('notices')
      .update({ title: title.trim(), body: body.trim() })
      .eq('id', notice.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    onSaved();
  };

  return (
    <form className="exam-form-fields" onSubmit={submit} style={{ marginTop: 8 }}>
      <label>
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        <span>Message</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      </label>
      {error && <div className="error-box">{error}</div>}
      <div className="exam-setup-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}

export default function NoticeBoardAdminPage() {
  const { user, role } = useAuth();
  const [notices, setNotices] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('notices').select('*, profiles(full_name)').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    setNotices(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePin = async (notice) => {
    await supabase.from('notices').update({ is_pinned: !notice.is_pinned }).eq('id', notice.id);
    load();
  };

  const remove = async (notice) => {
    if (!confirm(`Delete notice "${notice.title}"?`)) return;
    await supabase.from('notices').delete().eq('id', notice.id);
    load();
  };

  // Super Admin can manage every notice regardless of who posted it —
  // everyone else (moderators/admins) can only manage their own posts,
  // same restriction that already existed before this change.
  const canManage = (notice) => notice.posted_by === user.id || role === 'super_admin';

  return (
    <div className="panel">
      <h2>Notice Board</h2>
      <p className="muted small">Post an announcement — all students will see it on their dashboard.</p>
      <NewNoticeForm onPosted={load} />

      <h3 className="section-subtitle">Posted notices</h3>
      {notices === null && <div className="muted">Loading…</div>}
      {notices && notices.length === 0 && <div className="muted">No notices posted yet.</div>}

      <div className="notice-list">
        {notices?.map((n) => (
          <div key={n.id} className={n.is_pinned ? 'notice-card notice-card-pinned' : 'notice-card'}>
            {editingId === n.id ? (
              <EditNoticeForm
                notice={n}
                onSaved={() => { setEditingId(null); load(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="notice-card-top">
                  {n.is_pinned && <span className="notice-pin-tag">📌 Pinned</span>}
                  <span className="notice-card-meta">{n.profiles?.full_name || 'Staff'} · {fmtDateTime(n.created_at)}</span>
                </div>
                <div className="notice-card-title">{n.title}</div>
                <div className="notice-card-body">{n.body}</div>
                <div className="notice-card-actions">
                  <button className="btn-secondary" onClick={() => togglePin(n)}>{n.is_pinned ? 'Unpin' : 'Pin'}</button>
                  {canManage(n) && (
                    <>
                      <button className="btn-secondary" onClick={() => setEditingId(n.id)}>Edit</button>
                      <button className="btn-danger sm" onClick={() => remove(n)}>Delete</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
