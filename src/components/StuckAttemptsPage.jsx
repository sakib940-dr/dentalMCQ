import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtHours(h) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} hrs`;
  return `${(h / 24).toFixed(1)} days`;
}

export default function StuckAttemptsPage() {
  const [attempts, setAttempts] = useState(null);
  const [voidingId, setVoidingId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    const { data, error: loadError } = await supabase.from('stuck_exam_attempts').select('*');
    if (loadError) console.error('Failed to load stuck attempts:', loadError.message);
    setAttempts(data || []);
  };

  useEffect(() => { load(); }, []);

  const voidAttempt = async (attempt) => {
    if (!confirm(`Void ${attempt.student_name}'s stuck attempt on "${attempt.exam_title}"? They will be able to start a fresh attempt.`)) return;
    setVoidingId(attempt.id);
    setError('');
    const { error: voidError } = await supabase.rpc('void_stuck_attempt', { target_attempt_id: attempt.id });
    setVoidingId(null);
    if (voidError) { setError(voidError.message); return; }
    load();
  };

  return (
    <div className="panel">
      <h2>Stuck Exam Attempts</h2>
      <p className="muted small">
        Students whose exam attempt never got submitted (lost connection, closed the tab, etc.)
        are stuck "in progress" and can't retry. Void their attempt here to let them start fresh.
      </p>

      {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}

      {attempts === null && <div className="muted small" style={{ marginTop: 12 }}>Loading…</div>}
      {attempts && attempts.length === 0 && <div className="muted small" style={{ marginTop: 12 }}>No stuck attempts right now.</div>}

      <div className="claims-list" style={{ marginTop: 12 }}>
        {attempts?.map((a) => (
          <div key={a.id} className="claim-row">
            <div className="claim-row-main">
              <div className="claim-row-name">{a.student_name} ({a.student_username})</div>
              <div className="muted small">{a.exam_title}</div>
              <div className="muted small">Stuck for {fmtHours(a.hours_stuck)}</div>
            </div>
            <button className="btn-danger sm" disabled={voidingId === a.id} onClick={() => voidAttempt(a)}>
              {voidingId === a.id ? 'Voiding…' : 'Void attempt'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
