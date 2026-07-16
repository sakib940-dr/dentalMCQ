import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { normalizePhone } from '../lib/patients';

function AddPatientForm({ onAdded }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const phoneNorm = normalizePhone(phone);
    if (!name.trim()) { setError('Patient name is required.'); return; }
    if (!phoneNorm) { setError('Phone number is required — it\'s how this patient gets linked to prescriptions and appointments.'); return; }

    setSaving(true);
    const { error: insertError } = await supabase.from('patients').insert({
      owner_id: user.id,
      full_name: name.trim(),
      phone_number: phoneNorm,
      age: age.trim() || null,
      address: address.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'A patient with this phone number already exists.' : insertError.message);
      return;
    }
    setName(''); setPhone(''); setAge(''); setAddress(''); setOpen(false);
    onAdded();
  };

  if (!open) {
    return <button className="btn-primary" onClick={() => setOpen(true)}>+ Add Patient</button>;
  }

  return (
    <form className="panel" onSubmit={submit} style={{ marginTop: 10 }}>
      <div className="compact-field-list">
        <div className="compact-field-row">
          <span className="compact-field-label">Name:</span>
          <input className="compact-field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="compact-field-row">
          <span className="compact-field-label">Phone:</span>
          <input className="compact-field-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="017xxxxxxxx" />
        </div>
        <div className="compact-field-row">
          <span className="compact-field-label">Age:</span>
          <input className="compact-field-input" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="compact-field-row">
          <span className="compact-field-label">Address:</span>
          <input className="compact-field-input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="exam-setup-actions">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Patient'}</button>
      </div>
    </form>
  );
}

export default function PatientsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [allPatients, setAllPatients] = useState(null);

  const load = async () => {
    const { data } = await supabase.from('patients').select('*').eq('owner_id', user.id).order('full_name');
    setAllPatients(data || []);
  };

  useEffect(() => { load(); }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const term = query.trim().toLowerCase();
  const patients = allPatients === null
    ? null
    : term
      ? allPatients.filter((p) => p.full_name.toLowerCase().includes(term) || p.phone_number.includes(term))
      : allPatients;

  return (
    <>
      <div className="panel">
        <div className="panel-head-row">
          <h2>Patients</h2>
          <AddPatientForm onAdded={load} />
        </div>
        <form className="inline-add-form" onSubmit={(e) => e.preventDefault()} style={{ marginTop: 10 }}>
          <input placeholder="Search by name or phone number" value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
      </div>

      {patients === null && <div className="panel"><p className="muted small">Loading…</p></div>}
      {patients !== null && patients.length === 0 && <div className="panel"><p className="muted small">No patients yet. Add one above, or one will be created automatically the next time you save a prescription with a phone number.</p></div>}

      <div className="panel">
        <div className="recent-list">
          {(patients || []).map((p) => (
            <button key={p.id} className="recent-row patient-row-btn" onClick={() => navigate(`/dashboard/chamber/patients/${p.id}`)}>
              <span className="recent-name">{p.full_name}</span>
              <span className="muted small">{p.phone_number}{p.next_visit_date ? ` · Next visit: ${p.next_visit_date}` : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
