import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function emptyMedicine() {
  return { name: '', dose: '', duration: '' };
}

export default function PrescriptionPage() {
  const { profile, user } = useAuth();
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [medicines, setMedicines] = useState([emptyMedicine()]);
  const [advice, setAdvice] = useState('');
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');

  const loadRecent = async () => {
    const { data } = await supabase.from('prescriptions').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(5);
    setRecent(data || []);
  };
  useEffect(() => { loadRecent(); }, [user.id]);

  const updateMedicine = (i, field, value) => {
    setMedicines((m) => m.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };
  const addMedicine = () => setMedicines((m) => [...m, emptyMedicine()]);
  const removeMedicine = (i) => setMedicines((m) => m.filter((_, idx) => idx !== i));

  const buildPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header — doctor info from profile
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(profile?.full_name || 'Doctor', 10, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 5;
    if (profile?.bmdc_number) { doc.text(`BMDC Reg: ${profile.bmdc_number}`, 10, y); y += 4; }
    if (profile?.medical_college) { doc.text(profile.medical_college, 10, y); y += 4; }
    if (profile?.address) { doc.text(profile.address, 10, y); y += 4; }
    if (profile?.mobile_number) { doc.text(`Phone: ${profile.mobile_number}`, 10, y); y += 4; }

    y += 2;
    doc.setLineWidth(0.3);
    doc.line(10, y, pageWidth - 10, y);
    y += 6;

    // Patient info
    doc.setFontSize(10);
    doc.text(`Patient: ${patientName}`, 10, y);
    if (patientAge) doc.text(`Age: ${patientAge}`, pageWidth - 40, y);
    y += 5;
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 10, y);
    y += 8;

    // Rx symbol
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('℞', 10, y);
    y += 6;

    // Medicines
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    medicines.filter((m) => m.name.trim()).forEach((m, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}. ${m.name}`, 14, y);
      doc.setFont('helvetica', 'normal');
      y += 4.5;
      const details = [m.dose, m.duration].filter(Boolean).join('  ·  ');
      if (details) { doc.text(details, 18, y); y += 4.5; }
      y += 2;
    });

    if (advice.trim()) {
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.text('Advice:', 10, y);
      doc.setFont('helvetica', 'normal');
      y += 5;
      const lines = doc.splitTextToSize(advice.trim(), pageWidth - 20);
      doc.text(lines, 10, y);
    }

    return doc;
  };

  const generate = async () => {
    setError('');
    if (!patientName.trim()) { setError('Enter the patient name.'); return; }
    if (medicines.filter((m) => m.name.trim()).length === 0) { setError('Add at least one medicine.'); return; }

    const doc = buildPdf();
    doc.save(`prescription_${patientName.replace(/\s+/g, '_')}.pdf`);

    await supabase.from('prescriptions').insert({
      created_by: user.id,
      patient_name: patientName.trim(),
      patient_age: patientAge.trim() || null,
      medicines: medicines.filter((m) => m.name.trim()),
      advice: advice.trim() || null,
    });
    loadRecent();
  };

  return (
    <>
      <div className="panel">
        <h2>Prescription Generator</h2>
        <p className="muted small">
          Doctor details are pulled from your <b>My Profile</b> — update them there if anything's
          missing. This does not include a drug database; type medicine names directly.
        </p>

        <div className="prescription-doctor-preview">
          <div className="prescription-doctor-name">{profile?.full_name}</div>
          <div className="muted small">
            {[profile?.bmdc_number && `BMDC: ${profile.bmdc_number}`, profile?.medical_college, profile?.mobile_number]
              .filter(Boolean).join(' · ') || 'Complete your profile to show details here.'}
          </div>
        </div>

        <div className="exam-form-fields" style={{ marginTop: 14 }}>
          <div className="option-grid">
            <label>
              <span>Patient name</span>
              <input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
            </label>
            <label>
              <span>Age</span>
              <input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="e.g. 34" />
            </label>
          </div>

          <div className="field-block" style={{ marginTop: 6 }}>
            <span>Medicines</span>
          </div>
          {medicines.map((m, i) => (
            <div key={i} className="prescription-med-row">
              <input placeholder="Medicine name" value={m.name} onChange={(e) => updateMedicine(i, 'name', e.target.value)} />
              <input placeholder="Dose (e.g. 1+0+1)" value={m.dose} onChange={(e) => updateMedicine(i, 'dose', e.target.value)} />
              <input placeholder="Duration (e.g. 5 days)" value={m.duration} onChange={(e) => updateMedicine(i, 'duration', e.target.value)} />
              {medicines.length > 1 && (
                <button type="button" className="icon-btn-danger" onClick={() => removeMedicine(i)}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={addMedicine} style={{ alignSelf: 'flex-start' }}>+ Add medicine</button>

          <label>
            <span>Advice (optional)</span>
            <textarea value={advice} onChange={(e) => setAdvice(e.target.value)} rows={2} />
          </label>

          {error && <div className="error-box">{error}</div>}
          <button className="btn-primary" onClick={generate} style={{ alignSelf: 'flex-start' }}>Generate PDF</button>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="panel">
          <h2>Recent prescriptions</h2>
          <div className="recent-list">
            {recent.map((p) => (
              <div key={p.id} className="recent-row">
                <span className="recent-name">{p.patient_name}</span>
                <span className="muted small">{new Date(p.created_at).toLocaleDateString('en-GB')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
