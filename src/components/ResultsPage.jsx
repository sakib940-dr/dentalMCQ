import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function scoreColor(pct) {
  if (pct >= 70) return 'var(--green)';
  if (pct >= 40) return 'var(--gold)';
  return 'var(--red)';
}

export default function ResultsPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('exam_attempts')
        .select('*, exams(title, end_time, categories(name))')
        .eq('examinee_id', user.id)
        .eq('attempt_type', 'official')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });
      if (cancelled) return;
      setAttempts(data || []);
    }
    load();
    return () => { cancelled = true; };
  }, [user.id]);

  if (attempts === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>Results</h2>
      <p className="muted small">Your official exam attempts. Merit lists (with rank) unlock once each exam's window closes.</p>

      {attempts.length === 0 && <div className="muted">No exam attempts yet.</div>}

      <div className="results-list">
        {attempts.map((a) => {
          const meritOpen = a.exams && new Date(a.exams.end_time) < new Date();
          return (
            <div key={a.id} className="results-row">
              <div className="results-row-main">
                <div className="results-row-title">{a.exams?.title || 'Deleted exam'}</div>
                <div className="results-row-meta">
                  {a.exams?.categories?.name} · submitted {fmtDateTime(a.submitted_at)}
                </div>
                {meritOpen && (
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {a.rank ? `Rank #${a.rank}` : 'Merit list ready — visit Merit Lists to view rank'}
                  </div>
                )}
                {!meritOpen && <div className="muted small" style={{ marginTop: 4 }}>Rank available once the exam window closes</div>}
              </div>
              <div className="results-score-badge" style={{ background: scoreColor(a.percentage) }}>
                {a.percentage}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
