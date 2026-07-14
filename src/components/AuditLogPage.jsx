import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const ACTION_LABELS = {
  role_change: 'Role changed',
  account_delete: 'Account deleted',
  manual_lock: 'Manually locked',
  manual_unlock: 'Manually unlocked',
};

function describeDetails(action, details) {
  if (action === 'role_change') return `${details.from} → ${details.to}`;
  if (action === 'account_delete') return `${details.full_name} (${details.role})`;
  if (action === 'manual_lock' || action === 'manual_unlock') {
    return details.resource_type === 'prescription' ? 'Prescription' : 'a category';
  }
  return '';
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('*, actor:profiles!audit_log_actor_id_fkey(full_name), target:profiles!audit_log_target_user_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error('Failed to load audit log:', error.message);
        setLogs(data || []);
      });
  }, []);

  return (
    <div className="panel">
      <h2>Audit Log</h2>
      <p className="muted small">Recent sensitive actions — role changes, account deletions, and manual access locks.</p>

      {logs === null && <div className="muted small" style={{ marginTop: 12 }}>Loading…</div>}
      {logs && logs.length === 0 && <div className="muted small" style={{ marginTop: 12 }}>No actions logged yet.</div>}

      <div className="recent-list" style={{ marginTop: 12 }}>
        {logs?.map((l) => (
          <div key={l.id} className="recent-row">
            <div>
              <span className="recent-name">{ACTION_LABELS[l.action] || l.action}</span>
              <span className="muted small"> · {l.target?.full_name || 'Unknown user'} · {describeDetails(l.action, l.details)}</span>
            </div>
            <span className="muted small">by {l.actor?.full_name || 'Unknown'} · {fmtDateTime(l.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
