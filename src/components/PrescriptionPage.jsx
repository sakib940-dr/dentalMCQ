import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="clinical-section-compact">
      <div className="clinical-section-compact-label">{label}:</div>
      <div className="clinical-section-compact-body">
        {lines.map((l, i) => (
          <div key={i} className={withTooth ? 'clinical-line-row clinical-line-row-tooth' : 'clinical-line-row'}>
            <input
              className="clinical-line-text-compact"
              placeholder="Type here"
              value={l.text}
              onChange={(e) => update(i, 'text', e.target.value)}
            />
            {withTooth && (
              <ToothQuadrantInput value={l.tooth} onChange={(v) => update(i, 'tooth', v)} />
            )}
            {lines.length > 1 && (
              <button type="button" className="icon-btn-danger" onClick={() => remove(i)} aria-label="Remove">✕</button>
            )}
          </div>
        ))}
        <button type="button" className="clinical-add-line-btn-compact" onClick={add}>+ Add line</button>
      </div>
    </div>
  );
}

// ---------- Advice templates manager ----------
function AdviceTemplatesPanel({ userId, selectedIds, onToggle }) {
  const [templates, setTemplates] = useState([]);
  const [newText, setNewText] = useState('');
  const [newTooth, setNewTooth] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await supabase.from('advice_templates').select('*').eq('doctor_id', userId).order('display_order');
    setTemplates(data || []);
  };
  useEffect(() => { load(); }, [userId]);

  const addTemplate = async (e) => {
    e.preventDefault();
    setError('');
    if (!newText.trim()) return;
    const { error: insertError } = await supabase.from('advice_templates').insert({
      doctor_id: userId,
      text: newText.trim(),
      tooth_number: newTooth.trim() || null,
      display_order: templates.length,
    });
    if (insertError) { setError(insertError.message); return; }
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
      <div className="clinical-section-label">Advice ({templates.length}/30)</div>
      {templates.length === 0 && <div className="muted small">No saved advice templates yet.</div>}
      {templates.map((t) => (
        <label key={t.id} className="advice-template-row">
          <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => onToggle(t)} />
          <span className="advice-template-text">
            {t.text}{t.tooth_number && <span className="advice-template-tooth"> (#{t.tooth_number})</span>}
          </span>
          <button type="button" className="icon-btn-danger" onClick={(e) => { e.preventDefault(); removeTemplate(t.id); }} aria-label="Remove">✕</button>
        </label>
      ))}

      {error && <div className="error-box" style={{ marginTop: 6 }}>{error}</div>}

      {showAdd ? (
        <form className="clinical-line-row" onSubmit={addTemplate} style={{ marginTop: 8 }}>
          <input className="clinical-line-text" placeholder="New advice text" value={newText} onChange={(e) => setNewText(e.target.value)} />
          <input className="clinical-line-tooth" placeholder="Tooth # (optional)" value={newTooth} onChange={(e) => setNewTooth(e.target.value)} />
          <button type="submit" className="btn-secondary" style={{ flexShrink: 0 }}>Save</button>
        </form>
      ) : (
        <button type="button" className="clinical-add-line-btn" onClick={() => setShowAdd(true)} disabled={templates.length >= 30}>
          {templates.length >= 30 ? 'Limit reached (30/30)' : '+ New advice template'}
        </button>
      )}
    </div>
  );
}

export default function PrescriptionPage() {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      // Staff (super_admin/admin/moderator) always have access — the
      // lock only ever applies to examinees.
      if (profile?.role !== 'examinee') {
        if (!cancelled) { setHasAccess(true); setAccessChecked(true); }
        return;
      }

      // A Super Admin's manual lock always wins, even if the student has
      // an active grant or the global toggle is off.
      const { data: manualLock } = await supabase
        .from('manual_category_locks')
        .select('id')
        .eq('examinee_id', user.id)
        .eq('resource_type', 'prescription')
        .maybeSingle();
      if (manualLock) {
        if (!cancelled) { setHasAccess(false); setAccessChecked(true); }
        return;
      }

      const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'prescription_requires_payment').maybeSingle();
      const locked = !!setting?.value;
      if (!locked) {
        if (!cancelled) { setHasAccess(true); setAccessChecked(true); }
        return;
      }
      const { data: grant } = await supabase
        .from('category_access_grants')
        .select('expires_at')
        .eq('examinee_id', user.id)
        .eq('resource_type', 'prescription')
        .maybeSingle();
      const active = grant && new Date(grant.expires_at) > new Date();
      if (!cancelled) { setHasAccess(!!active); setAccessChecked(true); }
    }
    checkAccess();
    return () => { cancelled = true; };
  }, [profile?.role, user?.id]);

  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [patientMobile, setPatientMobile] = useState('');

  const [chiefComplaint, setChiefComplaint] = useState([emptyClinicalLine(true)]);
  const [history, setHistory] = useState([emptyClinicalLine(false)]);
  const [onExamination, setOnExamination] = useState([emptyClinicalLine(true)]);
  const [investigation, setInvestigation] = useState([emptyClinicalLine(false)]);
  const [treatmentPlan, setTreatmentPlan] = useState([emptyClinicalLine(true)]);
  const [selectedAdvice, setSelectedAdvice] = useState([]); // [{id, text, tooth_number}]

  const [medicines, setMedicines] = useState([emptyMedicine()]);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');

  const DEFAULT_FOOTER = 'Only BDS/MBBS holders are legal doctors. Do not risk your life by taking treatment from fake or unqualified doctors.';
  const [footerText, setFooterText] = useState(profile?.prescription_footer_text || DEFAULT_FOOTER);
  const [footerEditing, setFooterEditing] = useState(false);
  const [footerSaving, setFooterSaving] = useState(false);
  const [watermarkOpacity, setWatermarkOpacity] = useState(profile?.prescription_watermark_opacity ?? 0.07);
  const [opacitySaving, setOpacitySaving] = useState(false);

  // Keep local state in sync if the profile reloads with a different
  // saved value (e.g. after refreshProfile() elsewhere) — per-user, not
  // a global app setting, so this now lives on the profile itself.
  useEffect(() => {
    if (profile?.prescription_footer_text) setFooterText(profile.prescription_footer_text);
    if (profile?.prescription_watermark_opacity != null) setWatermarkOpacity(profile.prescription_watermark_opacity);
  }, [profile?.prescription_footer_text, profile?.prescription_watermark_opacity]);

  const saveFooterText = async () => {
    setFooterSaving(true);
    const { error: saveErr } = await supabase.from('profiles').update({ prescription_footer_text: footerText }).eq('id', profile.id);
    setFooterSaving(false);
    if (saveErr) { setError(`Could not save footer: ${saveErr.message}`); return; }
    setFooterEditing(false);
    refreshProfile();
  };

  const saveWatermarkOpacity = async (value) => {
    setOpacitySaving(true);
    setWatermarkOpacity(value);
    const { error: saveErr } = await supabase.from('profiles').update({ prescription_watermark_opacity: value }).eq('id', profile.id);
    setOpacitySaving(false);
    if (saveErr) console.error('Failed to save watermark opacity:', saveErr.message);
    refreshProfile();
  };

  const loadRecent = async () => {
    const { data } = await supabase.from('prescriptions').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(5);
    setRecent(data || []);
  };
  useEffect(() => { loadRecent(); }, [user.id]);

  const loadIntoForm = (p) => {
    setPatientName(p.patient_name || '');
    setPatientAge(p.patient_age || '');
    setPatientAddress(p.patient_address || '');
    setPatientMobile(p.patient_mobile || '');
    setChiefComplaint((p.chief_complaint?.length ? p.chief_complaint : [emptyClinicalLine(true)]));
    setHistory((p.history?.length ? p.history : [emptyClinicalLine(false)]));
    setOnExamination((p.on_examination?.length ? p.on_examination : [emptyClinicalLine(true)]));
    setInvestigation((p.investigation?.length ? p.investigation : [emptyClinicalLine(false)]));
    setTreatmentPlan((p.treatment_plan?.length ? p.treatment_plan : [emptyClinicalLine(true)]));
    setMedicines((p.medicines?.length ? p.medicines : [emptyMedicine()]));
    // Advice was saved as a flattened text string, not structured
    // template references, so it can't be restored as checked templates
    // — but we show it so the doctor knows it existed and can re-select.
    if (p.advice) {
      setSuccess(`Loaded prescription #${p.serial_number} for ${p.patient_name}. Previous advice was: "${p.advice}" — re-select matching templates below if needed.`);
    } else {
      setSuccess(`Loaded prescription #${p.serial_number} for ${p.patient_name}.`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  const fetchImageAsDataUrl = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null; // logo fetch failing should never block prescription generation
    }
  };

  const buildPdf = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // Register the Bengali font (used only for Advice text, which is the
    // one field allowed to contain Bangla script). Everything else stays
    // in the default Helvetica.
    doc.addFileToVFS('NotoSansBengali.ttf', NOTO_SANS_BENGALI_BASE64);
    doc.addFont('NotoSansBengali.ttf', 'NotoBengali', 'normal');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ---------- Watermark: the doctor's uploaded logo, large, centered,
    // and very faint, sitting behind everything else on the page. Drawn
    // first so all subsequent text/lines render on top of it. ----------
    if (profile?.prescription_logo_url) {
      const logoDataUrl = await fetchImageAsDataUrl(profile.prescription_logo_url);
      if (logoDataUrl) {
        try {
          const wmSize = pageWidth * 0.65; // large, but leaves margin
          const wmX = (pageWidth - wmSize) / 2;
          const wmY = (pageHeight - wmSize) / 2;
          doc.saveGraphicsState();
          doc.setGState(new doc.GState({ opacity: watermarkOpacity }));
          doc.addImage(logoDataUrl, 'PNG', wmX, wmY, wmSize, wmSize, undefined, 'FAST');
          doc.restoreGraphicsState();
        } catch {
          // A malformed/corrupt logo should never block the prescription
          // itself from generating — just skip the watermark silently.
        }
      }
    }

    // ---------- Fixed A4 band layout ----------
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

    const writeClinicalSection = (label, lines, startY, tooth) => {
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
        const hasToothGraphic = tooth && l.tooth && (l.tooth.ur || l.tooth.ul || l.tooth.lr || l.tooth.ll);
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

    clinY = writeClinicalSection('C/C', chiefComplaint, clinY, true);
    clinY = writeClinicalSection('H/O', history, clinY, false);
    clinY = writeClinicalSection('O/E', onExamination, clinY, true);
    clinY = writeClinicalSection('Investigation', investigation, clinY, false);
    clinY = writeClinicalSection('Treatment Plan', treatmentPlan, clinY, true);

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
    doc.text(footerText, pageWidth / 2, footerTop + 7, { align: 'center' });

    return doc;
  };

  const generate = async () => {
    setError('');
    setSuccess('');
    // Patient name / medicines are no longer hard-required — a doctor may
    // want to generate a partial prescription (e.g. just clinical notes).

    try {
      const doc = await buildPdf();
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
      investigation: filteredLines(investigation),
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

  if (!accessChecked) return <div className="panel"><p className="muted">Loading…</p></div>;

  if (!hasAccess) {
    return (
      <div className="panel">
        <div className="locked-feature">
          <div className="locked-feature-icon">🔒</div>
          <h2>Prescription requires a package</h2>
          <p className="muted">Unlock the prescription generator with an active subscription.</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard/package')}>View packages</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <h2>Prescription Generator</h2>
        <p className="muted small">
          Doctor and chamber details are pulled from your <b>My Profile</b>. No drug database —
          type medicine names directly.
        </p>

        <div className="compact-info-grid">
          <div className="compact-info-box">
            <div className="compact-info-box-title">Doctor Information</div>
            <div className="compact-info-box-name">Dr. {profile?.full_name || '—'}</div>
            <div className="muted small">
              {[profile?.designation, profile?.degrees, profile?.bmdc_number && `BMDC: ${profile.bmdc_number}`]
                .filter(Boolean).join(' · ') || 'Complete your profile to show details here.'}
            </div>
          </div>
          <div className="compact-info-box">
            <div className="compact-info-box-title">Chamber Information</div>
            <div className="compact-info-box-name">{profile?.chamber_name || '—'}</div>
            <div className="muted small">
              {[profile?.chamber_address, profile?.chamber_mobile && `Mobile: ${profile.chamber_mobile}`]
                .filter(Boolean).join(' · ') || 'Add chamber details in My Profile.'}
            </div>
          </div>
        </div>

        <div className="compact-field-heading">Patient Information</div>
        <div className="compact-field-list">
          <div className="compact-field-row">
            <span className="compact-field-label">Name:</span>
            <input className="compact-field-input" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
          </div>
          <div className="compact-field-row">
            <span className="compact-field-label">Age:</span>
            <input className="compact-field-input" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="e.g. 35 Year" />
          </div>
          <div className="compact-field-row">
            <span className="compact-field-label">Phone:</span>
            <input className="compact-field-input" value={patientMobile} onChange={(e) => setPatientMobile(e.target.value)} placeholder="017xxxxxxxx" />
          </div>
          <div className="compact-field-row">
            <span className="compact-field-label">Address:</span>
            <input className="compact-field-input" value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} placeholder="e.g. Dhanmondi, Dhaka" />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="compact-field-heading" style={{ marginTop: 0 }}>Clinical Features</div>
        <ClinicalSection label="C/C" lines={chiefComplaint} onChange={setChiefComplaint} withTooth />
        <ClinicalSection label="H/O" lines={history} onChange={setHistory} />
        <ClinicalSection label="Investigation" lines={investigation} onChange={setInvestigation} />
        <ClinicalSection label="O/E" lines={onExamination} onChange={setOnExamination} withTooth />
      </div>

      <div className="panel">
        <div className="compact-field-heading" style={{ marginTop: 0 }}>Treatment Plan</div>
        <ClinicalSection label="Plan" lines={treatmentPlan} onChange={setTreatmentPlan} withTooth />
      </div>

      <div className="panel">
        <h2>Medicines (Rx)</h2>
        <div className="exam-form-fields">
          {medicines.map((m, i) => (
            <div key={i} className="prescription-med-row">
              <input placeholder="Medicine name" value={m.name} onChange={(e) => updateMedicine(i, 'name', e.target.value)} />
              <input placeholder="Dose (e.g. 1+0+1, 30 min after meal)" value={m.dose} onChange={(e) => updateMedicine(i, 'dose', e.target.value)} />
              <input placeholder="Duration (e.g. 5 days)" value={m.duration} onChange={(e) => updateMedicine(i, 'duration', e.target.value)} />
              {medicines.length > 1 && (
                <button type="button" className="icon-btn-danger" onClick={() => removeMedicine(i)} aria-label="Remove">✕</button>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={addMedicine} style={{ alignSelf: 'flex-start' }}>+ Add medicine</button>
        </div>

        <AdviceTemplatesPanel userId={user.id} selectedIds={selectedAdvice.map((a) => a.id)} onToggle={toggleAdvice} />

        <div className="exam-form-fields" style={{ marginTop: 4 }}>
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

      <div className="panel">
        <h2>Prescription Settings</h2>
        <p className="muted small">Footer text and watermark appearance — saved to your account, used on every prescription you generate.</p>

        <div className="compact-field-heading" style={{ marginTop: 4 }}>Footer Text</div>
        {footerEditing ? (
          <div className="exam-form-fields" style={{ marginTop: 10 }}>
            <input value={footerText} onChange={(e) => setFooterText(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={saveFooterText} disabled={footerSaving}>{footerSaving ? 'Saving…' : 'Save'}</button>
              <button className="btn-secondary" onClick={() => { setFooterEditing(false); setFooterText(profile?.prescription_footer_text || DEFAULT_FOOTER); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <span className="muted small" style={{ fontStyle: 'italic' }}>"{footerText}"</span>
            <button className="btn-secondary" onClick={() => setFooterEditing(true)}>Edit</button>
          </div>
        )}

        <div className="compact-field-heading">Watermark Opacity</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <input
            type="range"
            min="0"
            max="0.3"
            step="0.01"
            value={watermarkOpacity}
            onChange={(e) => saveWatermarkOpacity(parseFloat(e.target.value))}
            style={{ flex: 1 }}
            disabled={opacitySaving}
          />
          <span className="muted small" style={{ minWidth: 42 }}>{Math.round(watermarkOpacity * 100)}%</span>
        </div>
        <p className="muted small" style={{ marginTop: 4 }}>Only applies if you've uploaded a logo in My Profile.</p>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="muted small">{new Date(p.created_at).toLocaleDateString('en-GB')}</span>
                  <button className="btn-secondary sm" onClick={() => loadIntoForm(p)}>Reprint / Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
