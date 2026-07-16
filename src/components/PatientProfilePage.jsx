import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { fmtDateTime } from '../lib/formatters';

function BookAppointmentForm({ patientId, onBooked }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!date || !time) { setError('Pick a date and time.'); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from('appointments').insert({
      owner_id: user.id,
      patient_id: patientId,
      scheduled_at: new Date(`${date}T${time}`).toISOString(),
      reason: reason.trim() || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setDate(''); setTime(''); setReason(''); setOpen(false);
    onBooked();
  };

  if (!open) return <button className="btn-secondary sm" onClick={() => setOpen(true)}>+ Book Appointment</button>;

  return (
    <form className="panel" onSubmit={submit} style={{ marginTop: 10 }}>
      <div className="compact-field-list">
        <div className="compact-field-row">
          <span className="compact-field-label">Date:</span>
          <input type="date" className="compact-field-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="compact-field-row">
          <span className="compact-field-label">Time:</span>
          <input type="time" className="compact-field-input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="compact-field-row">
          <span className="compact-field-label">Reason:</span>
          <input className="compact-field-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Follow-up scaling (optional)" />
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="exam-setup-actions">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Booking…' : 'Book'}</button>
      </div>
    </form>
  );
}

export default function PatientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [notes, setNotes] = useState('');
  const [nextVisit, setNextVisit] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: appts }, { data: rx }] = await Promise.all([
      supabase.from('patients').select('*').eq('id', id).single(),
      supabase.from('appointments').select('*').eq('patient_id', id).order('scheduled_at', { ascending: true }),
      supabase.from('prescriptions').select('id, serial_number, patient_name, created_at').eq('patient_id', id).order('created_at', { ascending: false }),
    ]);
    setPatient(p || null);
    setNotes(p?.clinical_notes || '');
    setNextVisit(p?.next_visit_date || '');
    setAppointments(appts || []);
    setPrescriptions(rx || []);
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNotesAndVisit = async () => {
    setSavingNotes(true);
    await supabase.from('patients').update({
      clinical_notes: notes.trim() || null,
      next_visit_date: nextVisit || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setSavingNotes(false);
    load();
  };

  const updateAppointmentStatus = async (apptId, status) => {
    await supabase.from('appointments').update({ status }).eq('id', apptId);
    load();
  };

  const openPrescription = async (rxId, autoGenerate) => {
    const { data } = await supabase.from('prescriptions').select('*').eq('id', rxId).single();
    if (data) navigate('/dashboard/prescription', { state: { prescription: data, autoGenerate } });
  };

  const newPrescription = () => {
    navigate('/dashboard/prescription', { state: { prefillPatient: patient } });
  };

  if (patient === null) return <div className="panel"><p className="muted">Loading patient…</p></div>;

  const now = new Date();
  const upcoming = appointments.filter((a) => a.status === 'upcoming' && new Date(a.scheduled_at) >= now);
  const past = appointments.filter((a) => a.status !== 'upcoming' || new Date(a.scheduled_at) < now);

  return (
    <>
      <button className="btn-secondary" onClick={() => navigate('/dashboard/chamber/patients')} style={{ marginBottom: 12 }}>← All patients</button>

      <div className="panel">
        <h2>{patient.full_name}</h2>
        <p className="muted small">{patient.phone_number}{patient.age ? ` · Age ${patient.age}` : ''}{patient.address ? ` · ${patient.address}` : ''}</p>
        <button className="btn-primary" style={{ marginTop: 8 }} onClick={newPrescription}>+ New Prescription</button>
      </div>

      <div className="panel">
        <h2>Clinical Notes &amp; Next Visit</h2>
        <textarea
          className="compact-field-input"
          rows={3}
          placeholder="Allergies, medical history, standing notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
        <div className="compact-field-row">
          <span className="compact-field-label">Next visit:</span>
          <input type="date" className="compact-field-input" value={nextVisit} onChange={(e) => setNextVisit(e.target.value)} />
        </div>
        <button className="btn-secondary sm" style={{ marginTop: 10 }} onClick={saveNotesAndVisit} disabled={savingNotes}>{savingNotes ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="panel">
        <div className="panel-head-row">
          <h2>Appointments</h2>
          <BookAppointmentForm patientId={id} onBooked={load} />
        </div>
        {upcoming.length === 0 && <p className="muted small">No upcoming appointments.</p>}
        <div className="recent-list">
          {upcoming.map((a) => (
            <div key={a.id} className="recent-row">
              <span className="recent-name">{fmtDateTime(a.scheduled_at)}{a.reason ? ` · ${a.reason}` : ''}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-secondary sm" onClick={() => updateAppointmentStatus(a.id, 'completed')}>Mark done</button>
                <button className="btn-danger sm" onClick={() => updateAppointmentStatus(a.id, 'cancelled')}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
        {past.length > 0 && (
          <>
            <p className="muted small" style={{ marginTop: 12 }}>Past</p>
            <div className="recent-list">
              {past.map((a) => (
                <div key={a.id} className="recent-row">
                  <span className="recent-name">{fmtDateTime(a.scheduled_at)}{a.reason ? ` · ${a.reason}` : ''}</span>
                  <span className="status-pill status-archived">{a.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Treatment History &amp; Prescriptions</h2>
        {prescriptions.length === 0 && <p className="muted small">No prescriptions yet for this patient.</p>}
        <div className="recent-list">
          {prescriptions.map((p) => (
            <div key={p.id} className="recent-row">
              <span className="recent-name">#{p.serial_number} · {fmtDateTime(p.created_at)}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-secondary sm" onClick={() => openPrescription(p.id, false)}>Open</button>
                <button className="btn-primary sm" onClick={() => openPrescription(p.id, true)}>Reprint</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
