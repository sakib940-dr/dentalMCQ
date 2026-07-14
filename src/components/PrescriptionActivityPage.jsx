import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function UserPrescriptionDetail({ user, onBack }) {
  const [prescriptions, setPrescriptions] = useState(null);

  useEffect(() => {
    supabase
      .from('prescriptions')
      .select('*')
      .eq('created_by', user.user_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPrescriptions(data || []));
  }, [user.user_id]);

  return (
    <div className="panel">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Back</button>
      <h2>{user.full_name}'s Prescriptions</h2>
      <p className="muted small">{user.username} · {user.role} · {user.total_prescriptions} total</p>

      {prescriptions === null && <div className="muted small" style={{ marginTop: 12 }}>Loading…</div>}
      {prescriptions && prescriptions.length === 0 && <div className="muted small" style={{ marginTop: 12 }}>No prescriptions found.</div>}

      <div className="recent-list" style={{ marginTop: 12 }}>
        {prescriptions?.map((p) => (
          <div key={p.id} className="recent-row">
            <div>
              <span className="recent-name">#{p.serial_number} · {p.patient_name}</span>
              {p.patient_age && <span className="muted small"> · Age {p.patient_age}</span>}
            </div>
            <span className="muted small">{fmtDateTime(p.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PrescriptionActivityPage() {
  const [summary, setSummary] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    supabase.from('prescription_usage_summary').select('*').then(({ data, error }) => {
      if (error) console.error('Failed to load prescription summary:', error.message);
      setSummary(data || []);
    });
  }, []);

  if (selectedUser) {
    return <UserPrescriptionDetail user={selectedUser} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <div className="panel">
      <h2>Prescription Activity</h2>
      <p className="muted small">Every user who has generated at least one prescription, sorted by volume.</p>

      {summary === null && <div className="muted small" style={{ marginTop: 12 }}>Loading…</div>}
      {summary && summary.length === 0 && <div className="muted small" style={{ marginTop: 12 }}>No prescriptions generated yet.</div>}

      <div className="claims-list" style={{ marginTop: 12 }}>
        {summary?.map((u) => (
          <button key={u.user_id} className="claim-row" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none' }} onClick={() => setSelectedUser(u)}>
            <div className="claim-row-main">
              <div className="claim-row-name">{u.full_name} <span className={`role-badge role-badge-${u.role}`} style={{ marginLeft: 6 }}>{u.role}</span></div>
              <div className="muted small">{u.username} · Last generated {fmtDateTime(u.last_generated_at)}</div>
            </div>
            <span className="status-pill status-live">{u.total_prescriptions}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
