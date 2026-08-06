import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { fmtDateTime } from '../lib/formatters';

export default function PrescriptionHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(null);

  useEffect(() => {
    async function load() {
      // Bounded to the most recent 300 — plenty for search across a
      // realistic prescription history without pulling an unbounded table.
      const { data } = await supabase
        .from('prescriptions')
        .select('id, serial_number, patient_name, patient_mobile, created_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(300);
      setAll(data || []);
    }
    load();
  }, [user.id]);

  const term = query.trim().toLowerCase();
  const results = all === null
    ? null
    : term
      ? all.filter((p) =>
          p.patient_name?.toLowerCase().includes(term) ||
          p.patient_mobile?.includes(term) ||
          p.serial_number?.toLowerCase().includes(term))
      : all;

  const openRecord = async (id, autoGenerate) => {
    const { data } = await supabase.from('prescriptions').select('*').eq('id', id).single();
    if (data) navigate('/dashboard/prescription', { state: { prescription: data, autoGenerate } });
  };

  return (
    <div className="panel">
      <h2>Prescription History</h2>
      <form className="inline-add-form" onSubmit={(e) => e.preventDefault()}>
        <input
          placeholder="Search by patient name, phone, or serial number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      {results === null && <p className="muted small">Loading…</p>}
      {results !== null && results.length === 0 && <p className="muted small">No prescriptions found.</p>}

      <div className="recent-list">
        {(results || []).map((p) => (
          <div key={p.id} className="recent-row">
            <span className="recent-name">#{p.serial_number} · {p.patient_name}{p.patient_mobile ? ` · ${p.patient_mobile}` : ''}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="muted small">{fmtDateTime(p.created_at)}</span>
              <button className="btn-secondary sm" onClick={() => openRecord(p.id, false)}>Open</button>
              <button className="btn-primary sm" onClick={() => openRecord(p.id, true)}>Reprint &amp; Download</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
