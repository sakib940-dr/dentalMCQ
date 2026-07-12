import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { NOTO_SANS_BENGALI_BASE64 } from '../assets/notoSansBengaliBase64';

function emptyMedicine() {
  return { name: '', dose: '', duration: '' };
}
function emptyClinicalLine(withTooth) {
  return withTooth
    ? { text: '', tooth: { ur: '', ul: '', lr: '', ll: '' } }
    : { text: '' };
}

// ---------- 4-quadrant tooth notation input: a "+" with four number fields ----------
function ToothQuadrantInput({ value, onChange }) {
  const set = (quad, v) => onChange({ ...value, [quad]: v });
  return (
    <div className="tooth-quad-input">
      <div className="tooth-quad-row">
        <input className="tooth-quad-field" value={value.ul} onChange={(e) => set('ul', e.target.value)} placeholder="" maxLength={2} />
        <input className="tooth-quad-field" value={value.ur} onChange={(e) => set('ur', e.target.value)} placeholder="" maxLength={2} />
      </div>
      <div className="tooth-quad-cross" />
      <div className="tooth-quad-row">
        <input className="tooth-quad-field" value={value.ll} onChange={(e) => set('ll', e.target.value)} placeholder="" maxLength={2} />
        <input className="tooth-quad-field" value={value.lr} onChange={(e) => set('lr', e.target.value)} placeholder="" maxLength={2} />
      </div>
    </div>
  );
}

// ---------- A repeatable clinical section: C/C, H/O, O/E, Treatment Plan ----------
function ClinicalSection({ label, lines, onChange, withTooth }) {
  const update = (i, field, value) => {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };
  const add = () => onChange([...lines, emptyClinicalLine(withTooth)]);
  const remove = (i) => onChange(lines.filter((_, idx) => idx !== i));

  return (
    <div className="clinical-section">
      <div className="clinical-section-label">{label}</div>
      {lines.map((l, i) => (
        <div key={i} className={withTooth ? 'clinical-line-row clinical-line-row-tooth' : 'clinical-line-row'}>
          <input
            className="clinical-line-text"
            placeholder="Description"
            value={l.text}
            onChange={(e) => update(i, 'text', e.target.value)}
          />
          {withTooth && (
            <ToothQuadrantInput value={l.tooth} onChange={(v) => update(i, 'tooth', v)} />
          )}
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

  const [chiefComplaint, setChiefComplaint] = useState([emptyClinicalLine(true)]);
  const [history, setHistory] = useState([emptyClinicalLine(false)]);
  const [onExamination, setOnExamination] = useState([emptyClinicalLine(true)]);
  const [treatmentPlan, setTreatmentPlan] = useState([emptyClinicalLine(true)]);
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

    // Register the Bengali font (used only for Advice text, which is the
    // one field allowed to contain Bangla script). Everything else stays
    // in the default Helvetica.
    doc.addFileToVFS('NotoSansBengali.ttf', NOTO_SANS_BENGALI_BASE64);
    doc.addFont('NotoSansBengali.ttf', 'NotoBengali', 'normal');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ---------- Fixed A4 band layout ----------
    // The page is divided into 4 fixed-height horizontal bands (by % of
    // total page height), matching the requested 6-part structure where
    // band 1 covers both Doctor+Chamber, and band 3 covers both the
    // clinical column and the Rx/Advice column side by side.
    const bandHeaderH = pageHeight * 0.12;   // Doctor + Chamber details
    const bandPatientH = pageHeight * 0.06;  // Patient details bar
    const bandFooterH = pageHeight * 0.04;   // Disclaimer footer
    const bandMainH = pageHeight - bandHeaderH - bandPatientH - bandFooterH; // Clinical + Rx/Advice

    const headerTop = 0;
    const patientTop = bandHeaderH;
    const mainTop = bandHeaderH + bandPatientH;
    const footerTop = pageHeight - bandFooterH;

    // ---------- Band 1: Header (Doctor left, Chamber right) ----------
    doc.setFillColor(238, 238, 236);
    doc.rect(0, headerTop, pageWidth, bandHeaderH, 'F');

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    let y = headerTop + 10;
    doc.text(`DR. ${(profile?.full_name || '').toUpperCase()}`, margin, y);

    doc.setFontSize(10);
    let leftY = y + 6;
    if (profile?.designation) { doc.setFont('helvetica', 'bold'); doc.text(profile.designation, margin, leftY); doc.setFont('helvetica', 'normal'); leftY += 4.5; }
    if (profile?.degrees) { doc.text(profile.degrees, margin, leftY); leftY += 4.5; }
    if (profile?.medical_college) { doc.text(profile.medical_college, margin, leftY); leftY += 4.5; }
    if (profile?.bmdc_number) { doc.text(`BMDC Reg No- ${profile.bmdc_number}`, margin, leftY); leftY += 4.5; }

    let rightY = y - 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Chamber', pageWidth - margin, rightY, { align: 'right' }); rightY += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (profile?.chamber_name) { doc.text(profile.chamber_name, pageWidth - margin, rightY, { align: 'right' }); rightY += 4.5; }
    if (profile?.chamber_address) { doc.text(profile.chamber_address, pageWidth - margin, rightY, { align: 'right' }); rightY += 4.5; }
    if (profile?.chamber_mobile) { doc.text(`Mobile: ${profile.chamber_mobile}`, pageWidth - margin, rightY, { align: 'right' }); rightY += 4.5; }
    if (profile?.visit_time || profile?.day_off) {
      const line = [profile?.visit_time && `Visit: ${profile.visit_time}`, profile?.day_off && `${profile.day_off} Off`].filter(Boolean).join('  ·  ');
      doc.text(line, pageWidth - margin, rightY, { align: 'right' });
    }
    doc.setTextColor(20, 20, 20);

    // ---------- Band 2: Patient details bar ----------
    y = patientTop + 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Name: ${patientName || '—'}`, margin, y);
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const patientLine2 = [patientAge && `Age: ${patientAge}`, patientAddress && `Address: ${patientAddress}`].filter(Boolean).join('     ');
    if (patientLine2) doc.text(patientLine2, margin, y);
    if (patientMobile) doc.text(`Mobile: ${patientMobile}`, pageWidth - margin, y, { align: 'right' });

    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.5);
    doc.line(margin, mainTop, pageWidth - margin, mainTop);

    // ---------- Band 3: Clinical (35%) + Rx/Advice (65%) side by side ----------
    const dividerX = margin + (pageWidth - margin * 2) * 0.35;
    const leftColX = margin;
    const rightColX = dividerX + 8;
    let clinY = mainTop + 10;
    let rxY = mainTop + 10;

    // Draws a small "+" cross with a tooth number in each of its four
    // quadrants (upper-left, upper-right, lower-left, lower-right) — the
    // standard dental notation box. Renders nothing if all four are empty.
    const drawToothQuadrant = (x, yCenter, tooth) => {
      if (!tooth) return;
      const hasAny = tooth.ur || tooth.ul || tooth.lr || tooth.ll;
      if (!hasAny) return;
      const armLen = 4.2;
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(0.3);
      doc.line(x - armLen, yCenter, x + armLen, yCenter);
      doc.line(x, yCenter - armLen, x, yCenter + armLen);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(20, 20, 20);
      if (tooth.ul) doc.text(String(tooth.ul), x - armLen - 1, yCenter - 1.2, { align: 'right' });
      if (tooth.ur) doc.text(String(tooth.ur), x + armLen + 1, yCenter - 1.2, { align: 'left' });
      if (tooth.ll) doc.text(String(tooth.ll), x - armLen - 1, yCenter + 4, { align: 'right' });
      if (tooth.lr) doc.text(String(tooth.lr), x + armLen + 1, yCenter + 4, { align: 'left' });
    };

    const writeClinicalSection = (label, lines, startY) => {
      const items = filteredLines(lines);
      if (items.length === 0) return startY;
      let cy = startY;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 61, 62);
      doc.text(label.toUpperCase(), leftColX, cy);
      doc.setTextColor(20, 20, 20);
      cy += 5.5;
      doc.setFontSize(10);
      const colWidth = dividerX - leftColX - 6;
      items.forEach((l) => {
        const hasToothGraphic = l.tooth && (l.tooth.ur || l.tooth.ul || l.tooth.lr || l.tooth.ll);
        const textMaxWidth = colWidth - (hasToothGraphic ? 16 : 0);
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(l.text, textMaxWidth);
        const lineStartY = cy;
        doc.text(wrapped, leftColX + 3, cy);
        if (hasToothGraphic) drawToothQuadrant(leftColX + 3 + textMaxWidth + 10, lineStartY - 1, l.tooth);
        cy += Math.max(wrapped.length * 5, hasToothGraphic ? 9 : 0);
      });
      return cy + 4;
    };

    clinY = writeClinicalSection('C/C', chiefComplaint, clinY);
    clinY = writeClinicalSection('H/O', history, clinY);
    clinY = writeClinicalSection('O/E', onExamination, clinY);
    clinY = writeClinicalSection('Treatment Plan', treatmentPlan, clinY);

    // Vertical divider between the two columns, spanning the main band
    doc.setDrawColor(210, 205, 195);
    doc.setLineWidth(0.4);
    doc.line(dividerX, mainTop, dividerX, footerTop - 4);

    // Right column: Rx (large, bold italic) → medicines → Advice below
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(20);
    doc.setTextColor(15, 61, 62);
    doc.text('Rx.', rightColX, rxY);
    doc.setTextColor(20, 20, 20);
    rxY += 10;

    filteredMedicines(medicines).forEach((m, i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const nameLines = doc.splitTextToSize(`${i + 1}. ${m.name}`, pageWidth - rightColX - margin);
      doc.text(nameLines, rightColX, rxY);
      rxY += nameLines.length * 5.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const details = [m.dose, m.duration].filter(Boolean).join('   ——   ');
      if (details) {
        const detailLines = doc.splitTextToSize(details, pageWidth - rightColX - margin - 4);
        doc.text(detailLines, rightColX + 4, rxY);
        rxY += detailLines.length * 4.6;
      }
      rxY += 3.5;
    });

    if (selectedAdvice.length > 0) {
      rxY += 6;
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(13);
      doc.setTextColor(15, 61, 62);
      doc.text('Advice', rightColX, rxY);
      doc.setTextColor(20, 20, 20);
      rxY += 6.5;
      doc.setFontSize(10);
      selectedAdvice.forEach((a, i) => {
        doc.setFont('NotoBengali', 'normal');
        const wrapped = doc.splitTextToSize(`${i + 1}. ${a.text}`, pageWidth - rightColX - margin - 4);
        doc.text(wrapped, rightColX + 4, rxY);
        rxY += wrapped.length * 5;
      });
    }

    // ---------- Band 4: Footer ----------
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.4);
    doc.line(margin, footerTop, pageWidth - margin, footerTop);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text('Follow the prescribed medication regularly.', pageWidth / 2, footerTop + 7, { align: 'center' });

    return doc;
  };

  const generate = async () => {
    setError('');
    setSuccess('');
    // Patient name / medicines are no longer hard-required — a doctor may
    // want to generate a partial prescription (e.g. just clinical notes).

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
      setPdfFileName(`prescription_${(patientName.trim() || 'unnamed').replace(/\s+/g, '_')}.pdf`);
      setSuccess('Your prescription PDF is ready below — tap "Download PDF" to save it.');
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
      setError(`Could not generate the PDF: ${pdfError.message || pdfError}`);
      return;
    }

    const { error: saveError } = await supabase.from('prescriptions').insert({
      created_by: user.id,
      patient_name: patientName.trim() || 'Unnamed patient',
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
        <ClinicalSection label="C/C (Chief Complaint)" lines={chiefComplaint} onChange={setChiefComplaint} withTooth />
        <ClinicalSection label="H/O (History)" lines={history} onChange={setHistory} />
        <ClinicalSection label="O/E (On Examination)" lines={onExamination} onChange={setOnExamination} withTooth />
        <AdviceTemplatesPanel userId={user.id} selectedIds={selectedAdvice.map((a) => a.id)} onToggle={toggleAdvice} />
        <ClinicalSection label="Treatment Plan" lines={treatmentPlan} onChange={setTreatmentPlan} withTooth />
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
