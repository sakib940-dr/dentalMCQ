import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function emptyMedicine() {
  return { name: '', dose: '', duration: '' };
}
function emptyClinicalLine() {
  return { text: '', tooth_number: '' };
}

// ---------- A repeatable clinical section: C/C, H/O, O/E, Treatment Plan ----------
function ClinicalSection({ label, lines, onChange }) {
  const update = (i, field, value) => {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };
  const add = () => onChange([...lines, emptyClinicalLine()]);
  const remove = (i) => onChange(lines.filter((_, idx) => idx !== i));

  return (
    <div className="clinical-section">
      <div className="clinical-section-label">{label}</div>
      {lines.map((l, i) => (
        <div key={i} className="clinical-line-row">
          <input
            className="clinical-line-text"
            placeholder="Description"
            value={l.text}
            onChange={(e) => update(i, 'text', e.target.value)}
          />
          <input
            className="clinical-line-tooth"
            placeholder="Tooth #"
            value={l.tooth_number}
            onChange={(e) => update(i, 'tooth_number', e.target.value)}
          />
          {lines.length > 1 && (
            <button type="button" className="icon-btn-danger" onClick={() => remove(i)}>✕</button>
          )}
        </div>
      ))}
      <button type="button" className="clinical-add-line-btn" onClick={add}>+ Add line</button>
    </div>
  );
}

// ---------- Advice templates manager ----------
function AdviceTemplatesPanel({ userId, selectedIds, onToggle }) {
  const [templates, setTemplates] = useState([]);
  const [newText, setNewText] = useState('');
  const [newTooth, setNewTooth] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('advice_templates').select('*').eq('doctor_id', userId).order('display_order');
    setTemplates(data || []);
  };
  useEffect(() => { load(); }, [userId]);

  const addTemplate = async (e) => {
    e.preventDefault();
    if (!newText.trim()) return;
    await supabase.from('advice_templates').insert({
      doctor_id: userId,
      text: newText.trim(),
      tooth_number: newTooth.trim() || null,
      display_order: templates.length,
    });
    setNewText('');
    setNewTooth('');
    setShowAdd(false);
    load();
  };

  const removeTemplate = async (id) => {
    await supabase.from('advice_templates').delete().eq('id', id);
    load();
  };

  return (
    <div className="clinical-section">
      <div className="clinical-section-label">Advice</div>
      {templates.length === 0 && <div className="muted small">No saved advice templates yet.</div>}
      {templates.map((t) => (
        <label key={t.id} className="advice-template-row">
          <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => onToggle(t)} />
          <span className="advice-template-text">
            {t.text}{t.tooth_number && <span className="advice-template-tooth"> (#{t.tooth_number})</span>}
          </span>
          <button type="button" className="icon-btn-danger" onClick={(e) => { e.preventDefault(); removeTemplate(t.id); }}>✕</button>
        </label>
      ))}

      {showAdd ? (
        <form className="clinical-line-row" onSubmit={addTemplate} style={{ marginTop: 8 }}>
          <input className="clinical-line-text" placeholder="New advice text" value={newText} onChange={(e) => setNewText(e.target.value)} />
          <input className="clinical-line-tooth" placeholder="Tooth # (optional)" value={newTooth} onChange={(e) => setNewTooth(e.target.value)} />
          <button type="submit" className="btn-secondary" style={{ flexShrink: 0 }}>Save</button>
        </form>
      ) : (
        <button type="button" className="clinical-add-line-btn" onClick={() => setShowAdd(true)}>+ New advice template</button>
      )}
    </div>
  );
}

export default function PrescriptionPage() {
  const { profile, user } = useAuth();
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [patientMobile, setPatientMobile] = useState('');

  const [chiefComplaint, setChiefComplaint] = useState([emptyClinicalLine()]);
  const [history, setHistory] = useState([emptyClinicalLine()]);
  const [onExamination, setOnExamination] = useState([emptyClinicalLine()]);
  const [treatmentPlan, setTreatmentPlan] = useState([emptyClinicalLine()]);
  const [selectedAdvice, setSelectedAdvice] = useState([]); // [{id, text, tooth_number}]

  const [medicines, setMedicines] = useState([emptyMedicine()]);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');

  const loadRecent = async () => {
    const { data } = await supabase.from('prescriptions').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(5);
    setRecent(data || []);
  };
  useEffect(() => { loadRecent(); }, [user.id]);

  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [pdfBlobUrl]);

  const toggleAdvice = (template) => {
    setSelectedAdvice((s) => {
      const exists = s.find((a) => a.id === template.id);
      if (exists) return s.filter((a) => a.id !== template.id);
      return [...s, template];
    });
  };

  const updateMedicine = (i, field, value) => {
    setMedicines((m) => m.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };
  const addMedicine = () => setMedicines((m) => [...m, emptyMedicine()]);
  const removeMedicine = (i) => setMedicines((m) => m.filter((_, idx) => idx !== i));

  const filteredLines = (lines) => lines.filter((l) => (l.text || '').trim());
  const filteredMedicines = (meds) => meds.filter((m) => (m.name || '').trim());

  const buildPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const midX = pageWidth / 2;
    let y = 12;

    // ---------- Header: doctor (left) + chamber (right) ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`DR. ${(profile?.full_name || '').toUpperCase()}`, 8, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let leftY = y + 5;
    if (profile?.designation) { doc.setFont('helvetica', 'bold'); doc.text(profile.designation, 8, leftY); doc.setFont('helvetica', 'normal'); leftY += 4; }
    if (profile?.degrees) { doc.text(profile.degrees, 8, leftY); leftY += 4; }
    if (profile?.medical_college) { doc.text(profile.medical_college, 8, leftY); leftY += 4; }
    if (profile?.bmdc_number) { doc.text(`BMDC Reg No- ${profile.bmdc_number}`, 8, leftY); leftY += 4; }

    let rightY = y;
    doc.setFont('helvetica', 'bold');
    doc.text('Chamber:', pageWidth - 8, rightY, { align: 'right' }); rightY += 4;
    doc.setFont('helvetica', 'normal');
    if (profile?.chamber_name) { doc.text(profile.chamber_name, pageWidth - 8, rightY, { align: 'right' }); rightY += 4; }
    if (profile?.chamber_address) { doc.text(profile.chamber_address, pageWidth - 8, rightY, { align: 'right' }); rightY += 4; }
    if (profile?.chamber_mobile) { doc.text(`Mobile: ${profile.chamber_mobile}`, pageWidth - 8, rightY, { align: 'right' }); rightY += 4; }
    if (profile?.visit_time) { doc.text(`Visit Time ${profile.visit_time}`, pageWidth - 8, rightY, { align: 'right' }); rightY += 4; }
    if (profile?.day_off) { doc.text(`${profile.day_off} Off`, pageWidth - 8, rightY, { align: 'right' }); rightY += 4; }

    y = Math.max(leftY, rightY) + 3;
    doc.setLineWidth(0.4);
    doc.line(8, y, pageWidth - 8, y);
    y += 6;

    // ---------- Patient row ----------
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Name: ${patientName}`, 8, y);
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - 8, y, { align: 'right' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    const patientLine2 = [patientAge && `Age: ${patientAge}`, patientMobile && `Mobile: ${patientMobile}`].filter(Boolean).join('   ');
    if (patientLine2) { doc.text(patientLine2, 8, y); y += 5; }
    if (patientAddress) { doc.text(`Address: ${patientAddress}`, 8, y); y += 5; }

    y += 2;
    doc.line(8, y, pageWidth - 8, y);
    y += 6;

    // ---------- Two-column body: left = clinical, right = Rx ----------
    const leftColX = 8;
    const rightColX = midX + 4;
    let clinY = y;
    let rxY = y;

    const writeSection = (label, lines, startY) => {
      const items = filteredLines(lines);
      if (items.length === 0) return startY;
      let cy = startY;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(label, leftColX, cy);
      cy += 4.5;
      doc.setFont('helvetica', 'normal');
      items.forEach((l) => {
        const suffix = l.tooth_number ? `  |${l.tooth_number}` : '';
        const wrapped = doc.splitTextToSize(l.text + suffix, midX - leftColX - 4);
        doc.text(wrapped, leftColX + 2, cy);
        cy += wrapped.length * 4.2;
      });
      return cy + 3;
    };

    clinY = writeSection('C/C', chiefComplaint, clinY);
    clinY = writeSection('H/O', history, clinY);
    clinY = writeSection('O/E', onExamination, clinY);
    if (selectedAdvice.length > 0) {
      clinY = writeSection('Advice', selectedAdvice.map((a) => ({ text: a.text, tooth_number: a.tooth_number })), clinY);
    }
    clinY = writeSection('Treatment Plan', treatmentPlan, clinY);

    // Rx column
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(15);
    doc.text('Rx.', rightColX, rxY);
    rxY += 7;

    doc.setFontSize(10);
    filteredMedicines(medicines).forEach((m, i) => {
      doc.setFont('helvetica', 'bold');
      const nameLines = doc.splitTextToSize(`${i + 1}. ${m.name}`, pageWidth - rightColX - 8);
      doc.text(nameLines, rightColX, rxY);
      rxY += nameLines.length * 4.5;
      doc.setFont('helvetica', 'normal');
      const details = [m.dose, m.duration].filter(Boolean).join('  ------  ');
      if (details) {
        const detailLines = doc.splitTextToSize(details, pageWidth - rightColX - 10);
        doc.text(detailLines, rightColX + 3, rxY);
        rxY += detailLines.length * 4.2;
      }
      rxY += 2.5;
    });

    // ---------- Footer ----------
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setLineWidth(0.3);
    doc.line(8, pageHeight - 12, pageWidth - 8, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Follow the prescribed medication regularly.', pageWidth / 2, pageHeight - 7, { align: 'center' });

    return doc;
  };

  const generate = async () => {
    setError('');
    setSuccess('');
    if (!patientName.trim()) { setError('Enter the patient name.'); return; }
    if (filteredMedicines(medicines).length === 0) { setError('Add at least one medicine.'); return; }

    try {
      const doc = buildPdf();
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);

      // window.open() and programmatic <a download> clicks are both
      // unreliable across mobile browsers — some silently no-op with no
      // error and no popup-blocked warning. The one thing that reliably
      // works everywhere is a REAL, visible <a href=... download> link
      // that the user taps themselves — that's always a genuine user
      // gesture the browser can't block or ignore.
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(blobUrl);
      setPdfFileName(`prescription_${patientName.replace(/\s+/g, '_')}.pdf`);
      setSuccess('Your prescription PDF is ready below — tap "Download PDF" to save it.');
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
      setError(`Could not generate the PDF: ${pdfError.message || pdfError}`);
      return;
    }

    const { error: saveError } = await supabase.from('prescriptions').insert({
      created_by: user.id,
      patient_name: patientName.trim(),
      patient_age: patientAge.trim() || null,
      patient_address: patientAddress.trim() || null,
      patient_mobile: patientMobile.trim() || null,
      chief_complaint: filteredLines(chiefComplaint),
      history: filteredLines(history),
      on_examination: filteredLines(onExamination),
      treatment_plan: filteredLines(treatmentPlan),
      advice: selectedAdvice.map((a) => a.text).join('; ') || null,
      medicines: filteredMedicines(medicines),
    });
    if (saveError) {
      console.error('Failed to save prescription record:', saveError.message);
      setError(`PDF was generated, but saving the record failed: ${saveError.message}`);
    }
    loadRecent();
  };

  return (
    <>
      <div className="panel">
        <h2>Prescription Generator</h2>
        <p className="muted small">
          Doctor and chamber details are pulled from your <b>My Profile</b>. No drug database —
          type medicine names directly.
        </p>

        <div className="prescription-doctor-preview">
          <div className="prescription-doctor-name">Dr. {profile?.full_name}</div>
          <div className="muted small">
            {[profile?.designation, profile?.degrees, profile?.bmdc_number && `BMDC: ${profile.bmdc_number}`]
              .filter(Boolean).join(' · ') || 'Complete your profile to show details here.'}
          </div>
          <div className="muted small" style={{ marginTop: 3 }}>
            {profile?.chamber_name || 'Add chamber details in My Profile to show them on the prescription.'}
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
          <div className="option-grid">
            <label>
              <span>Patient mobile</span>
              <input value={patientMobile} onChange={(e) => setPatientMobile(e.target.value)} />
            </label>
            <label>
              <span>Patient address</span>
              <input value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} />
            </label>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Clinical Details</h2>
        <ClinicalSection label="C/C (Chief Complaint)" lines={chiefComplaint} onChange={setChiefComplaint} />
        <ClinicalSection label="H/O (History)" lines={history} onChange={setHistory} />
        <ClinicalSection label="O/E (On Examination)" lines={onExamination} onChange={setOnExamination} />
        <AdviceTemplatesPanel userId={user.id} selectedIds={selectedAdvice.map((a) => a.id)} onToggle={toggleAdvice} />
        <ClinicalSection label="Treatment Plan" lines={treatmentPlan} onChange={setTreatmentPlan} />
      </div>

      <div className="panel">
        <h2>Medicines (Rx)</h2>
        <div className="exam-form-fields">
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

          {error && <div className="error-box">{error}</div>}
          {success && <div className="ok-box">{success}</div>}
          <button className="btn-primary" onClick={generate} style={{ alignSelf: 'flex-start', marginTop: 6 }}>Generate PDF</button>

          {pdfBlobUrl && (
            <a
              href={pdfBlobUrl}
              download={pdfFileName}
              className="btn-primary pdf-download-link"
              style={{ alignSelf: 'flex-start', textDecoration: 'none', display: 'inline-block' }}
            >
              ⬇ Download PDF
            </a>
          )}
        </div>
      </div>

      {pdfBlobUrl && (
        <div className="panel">
          <h2>Preview</h2>
          <p className="muted small">If the download button above doesn't work, long-press this preview and choose "Download" or "Save".</p>
          <iframe src={pdfBlobUrl} title="Prescription preview" className="pdf-preview-frame" />
        </div>
      )}

      {recent.length > 0 && (
        <div className="panel">
          <h2>Recent prescriptions</h2>
          <div className="recent-list">
            {recent.map((p) => (
              <div key={p.id} className="recent-row">
                <span className="recent-name">#{p.serial_number} · {p.patient_name}</span>
                <span className="muted small">{new Date(p.created_at).toLocaleDateString('en-GB')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
