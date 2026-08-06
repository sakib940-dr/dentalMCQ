import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StudentNoticeBoard() {
  const [notices, setNotices] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('notices')
      .select('*, profiles(full_name)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setNotices(data || []); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="panel">
      <h2>Notice Board</h2>
      {notices === null && <div className="muted">Loading…</div>}
      {notices && notices.length === 0 && <div className="muted">No announcements yet.</div>}

      <div className="notice-list">
        {notices?.map((n) => (
          <div key={n.id} className={n.is_pinned ? 'notice-card notice-card-pinned' : 'notice-card'}>
            <div className="notice-card-top">
              {n.is_pinned && <span className="notice-pin-tag">📌 Pinned</span>}
              <span className="notice-card-meta">{n.profiles?.full_name || 'Staff'} · {fmtDateTime(n.created_at)}</span>
            </div>
            <div className="notice-card-title">{n.title}</div>
            <div className="notice-card-body">{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
