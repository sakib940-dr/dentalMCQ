import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { NOTO_SANS_BENGALI_BASE64 } from '../assets/notoSansBengaliBase64';
import { findOrCreatePatient } from '../lib/patients';
import { IconX, IconDownload, IconLock, IconArrowRight } from '../lib/examineeIcons';

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
              <button type="button" className="icon-btn-danger" onClick={() => remove(i)} aria-label="Remove"><IconX size={14} /></button>
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
          <button type="button" className="icon-btn-danger" onClick={(e) => { e.preventDefault(); removeTemplate(t.id); }} aria-label="Remove"><IconX size={14} /></button>
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
  const location = useLocation();
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      // Staff (super_admin/admin/moderator) always have access — this is
      // a role exemption for the people running the platform, not a
      // "default access" loophole for students. Students always go
      // through the subscription check below with no exceptions.
      if (profile?.role !== 'examinee') {
        if (!cancelled) { setHasAccess(true); setAccessChecked(true); }
        return;
      }

      // The ONLY question: is there an active subscription record for
      // prescription access? No global toggle, no default-free state.
      const { data, error } = await supabase.rpc('has_active_access', {
        target_examinee_id: user.id,
        target_category_id: null,
        target_resource_type: 'prescription',
      });
      if (cancelled) return;
      if (error) {
        console.error('Access check failed:', error.message);
        setHasAccess(false); // fail closed
      } else {
        setHasAccess(!!data);
      }
      setAccessChecked(true);
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

  // Reprint/Open, arriving from Prescription History or a Patient Profile:
  // load the stored record into this same form (identical to the existing
  // "Reprint/Edit" flow), and if it came in as a one-tap "Reprint &
  // Download", regenerate the PDF immediately too.
  const [autoGenerateAfterLoad, setAutoGenerateAfterLoad] = useState(false);
  useEffect(() => {
    const incoming = location.state?.prescription;
    const prefillPatient = location.state?.prefillPatient;
    if (incoming) {
      loadIntoForm(incoming);
      if (location.state?.autoGenerate) setAutoGenerateAfterLoad(true);
    } else if (prefillPatient) {
      setPatientName(prefillPatient.full_name || '');
      setPatientAge(prefillPatient.age || '');
      setPatientAddress(prefillPatient.address || '');
      setPatientMobile(prefillPatient.phone_number || '');
    }
    if (incoming || prefillPatient) window.history.replaceState({}, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!autoGenerateAfterLoad) return;
    setAutoGenerateAfterLoad(false);
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateAfterLoad]);

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

    // Keep the font registered in jsPDF as well. The browser canvas below uses
    // the same Noto Sans Bengali file so Bengali gets proper complex-script shaping.
    doc.addFileToVFS('NotoSansBengali.ttf', NOTO_SANS_BENGALI_BASE64);
    doc.addFont('NotoSansBengali.ttf', 'NotoBengali', 'normal');

    // Load the exact same Bengali font into the browser's font engine.
    // Canvas text uses the browser shaping engine (GSUB/GPOS), which jsPDF's
    // direct TTF text path does not reliably apply for Bengali conjuncts/kar/fola.
    const BENGALI_CANVAS_FONT = 'DentalMCQNotoBengali';
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
      throw new Error('This browser does not support the FontFace API required for Bengali PDF rendering.');
    }

    if (!document.fonts.check(`16px \"${BENGALI_CANVAS_FONT}\"`)) {
      const bengaliFace = new FontFace(
        BENGALI_CANVAS_FONT,
        `url(data:font/ttf;base64,${NOTO_SANS_BENGALI_BASE64}) format('truetype')`,
        { style: 'normal', weight: '400' }
      );
      const loadedFace = await bengaliFace.load();
      document.fonts.add(loadedFace);
    }
    await document.fonts.load(`16px "${BENGALI_CANVAS_FONT}"`);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ---------- Unicode/mixed-script PDF text helpers ----------
    const hasBangla = (value) => /[\u0980-\u09FF]/.test(String(value ?? ''));
    const isBanglaChar = (ch) => /[\u0980-\u09FF]/.test(ch);
    const isJoiner = (ch) => ch === '\u200C' || ch === '\u200D';

    const splitScriptRuns = (value) => {
      const chars = Array.from(String(value ?? ''));
      if (chars.length === 0) return [];

      const runs = [];
      let currentText = '';
      let currentBangla = false;

      for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i];
        const prevIsBangla = i > 0 && isBanglaChar(chars[i - 1]);
        const nextIsBangla = i + 1 < chars.length && isBanglaChar(chars[i + 1]);
        const bangla = isBanglaChar(ch) || (isJoiner(ch) && (prevIsBangla || nextIsBangla));

        if (!currentText) {
          currentText = ch;
          currentBangla = bangla;
        } else if (bangla === currentBangla) {
          currentText += ch;
        } else {
          runs.push({ text: currentText, bangla: currentBangla });
          currentText = ch;
          currentBangla = bangla;
        }
      }

      if (currentText) runs.push({ text: currentText, bangla: currentBangla });
      return runs;
    };

    const getCanvasColor = () => {
      const color = typeof doc.getTextColor === 'function' ? doc.getTextColor() : '#000000';
      return typeof color === 'string' ? color : '#000000';
    };

    const measureBanglaRun = (text, fontSizePt) => {
      const scale = 4;
      const pxPerPt = 96 / 72;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `${fontSizePt * pxPerPt * scale}px "${BENGALI_CANVAS_FONT}"`;
      const metrics = ctx.measureText(text);
      return metrics.width / scale / (96 / 25.4);
    };

    const measureMixedText = (text, fontStyle, fontSizePt) => {
      const originalFont = doc.getFont();
      const originalSize = doc.getFontSize();
      let width = 0;

      splitScriptRuns(text).forEach((run) => {
        if (run.bangla) {
          width += measureBanglaRun(run.text, fontSizePt);
        } else {
          doc.setFont('helvetica', fontStyle);
          doc.setFontSize(fontSizePt);
          width += doc.getTextWidth(run.text);
        }
      });

      doc.setFont(originalFont.fontName, originalFont.fontStyle);
      doc.setFontSize(originalSize);
      return width;
    };

    const getGraphemes = (text) => {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        return Array.from(new Intl.Segmenter('bn', { granularity: 'grapheme' }).segment(text), (x) => x.segment);
      }
      return Array.from(text);
    };

    const breakLongToken = (token, maxWidth, fontStyle, fontSizePt) => {
      const graphemes = getGraphemes(token);
      const parts = [];
      let current = '';

      graphemes.forEach((g) => {
        const candidate = current + g;
        if (current && measureMixedText(candidate, fontStyle, fontSizePt) > maxWidth) {
          parts.push(current);
          current = g;
        } else {
          current = candidate;
        }
      });

      if (current) parts.push(current);
      return parts;
    };

    const wrapMixedText = (value, maxWidth, fontStyle, fontSizePt) => {
      const paragraphs = String(value ?? '').split(/\r?\n/);
      const lines = [];

      paragraphs.forEach((paragraph) => {
        if (!maxWidth) {
          lines.push(paragraph);
          return;
        }

        if (paragraph === '') {
          lines.push('');
          return;
        }

        const tokens = paragraph.split(/(\s+)/).filter((token) => token !== '');
        let line = '';

        const pushLine = () => {
          if (line !== '') lines.push(line.replace(/\s+$/u, ''));
          line = '';
        };

        tokens.forEach((token) => {
          const tokenIsWhitespace = /^\s+$/u.test(token);
          if (tokenIsWhitespace && line === '') return;

          const candidate = line + token;
          if (measureMixedText(candidate, fontStyle, fontSizePt) <= maxWidth) {
            line = candidate;
            return;
          }

          if (line.trim() !== '') pushLine();
          if (tokenIsWhitespace) return;

          if (measureMixedText(token, fontStyle, fontSizePt) <= maxWidth) {
            line = token;
            return;
          }

          const pieces = breakLongToken(token, maxWidth, fontStyle, fontSizePt);
          pieces.forEach((piece, index) => {
            if (index < pieces.length - 1) lines.push(piece);
            else line = piece;
          });
        });

        if (line !== '') pushLine();
      });

      return lines.length ? lines : [''];
    };

    const drawBanglaRun = (text, x, baselineY, fontSizePt) => {
      if (!text) return 0;

      const scale = 4;
      const pxPerPt = 96 / 72;
      const pxPerMm = 96 / 25.4;
      const fontPx = fontSizePt * pxPerPt * scale;
      const padding = 2 * scale;

      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      measureCtx.font = `${fontPx}px "${BENGALI_CANVAS_FONT}"`;
      const measured = measureCtx.measureText(text);

      const ascent = Math.ceil(measured.actualBoundingBoxAscent || fontPx * 0.9);
      const descent = Math.ceil(measured.actualBoundingBoxDescent || fontPx * 0.3);
      const textWidthPx = Math.max(1, Math.ceil(measured.width));

      const canvas = document.createElement('canvas');
      canvas.width = textWidthPx + padding * 2;
      canvas.height = Math.max(1, ascent + descent + padding * 2);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontPx}px "${BENGALI_CANVAS_FONT}"`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = getCanvasColor();
      ctx.fillText(text, padding, padding + ascent);

      const visibleWidthMm = measured.width / scale / pxPerMm;
      const imageWidthMm = canvas.width / scale / pxPerMm;
      const imageHeightMm = canvas.height / scale / pxPerMm;
      const padMm = padding / scale / pxPerMm;
      const baselineFromTopMm = (padding + ascent) / scale / pxPerMm;

      doc.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        x - padMm,
        baselineY - baselineFromTopMm,
        imageWidthMm,
        imageHeightMm,
        undefined,
        'FAST'
      );

      return visibleWidthMm;
    };

    const writeMixedLine = (text, x, y, { fontStyle = 'normal', align = 'left', fontSizePt }) => {
      const lineWidth = measureMixedText(text, fontStyle, fontSizePt);
      let cursorX = x;
      if (align === 'right') cursorX = x - lineWidth;
      else if (align === 'center') cursorX = x - lineWidth / 2;

      splitScriptRuns(text).forEach((run) => {
        if (run.bangla) {
          cursorX += drawBanglaRun(run.text, cursorX, y, fontSizePt);
        } else if (run.text) {
          doc.setFont('helvetica', fontStyle);
          doc.setFontSize(fontSizePt);
          doc.text(run.text, cursorX, y, { align: 'left' });
          cursorX += doc.getTextWidth(run.text);
        }
      });
    };

    const writeText = (
      docInstance,
      value,
      x,
      y,
      { fontStyle = 'normal', maxWidth = null, align = 'left' } = {}
    ) => {
      const text = String(value ?? '');
      const fontSizePt = docInstance.getFontSize();
      const previousFont = docInstance.getFont();
      const previousSize = docInstance.getFontSize();

      // Exact old jsPDF path for English/numeric-only text.
      // This preserves Helvetica metrics, variants, wrapping and alignment exactly.
      if (!hasBangla(text)) {
        docInstance.setFont('helvetica', fontStyle);
        const output = maxWidth ? docInstance.splitTextToSize(text, maxWidth) : text;
        docInstance.text(output, x, y, { align });
        const lineCount = Array.isArray(output) ? output.length : String(output).split(/\r?\n/).length;
        docInstance.setFont(previousFont.fontName, previousFont.fontStyle);
        docInstance.setFontSize(previousSize);
        return { lines: Array.isArray(output) ? output : [output], lineCount };
      }

      // Bengali/mixed text: keep English as Helvetica, but render Bengali runs
      // through browser canvas so conjuncts, vowel signs and reordering are shaped correctly.
      const lines = maxWidth
        ? wrapMixedText(text, maxWidth, fontStyle, fontSizePt)
        : text.split(/\r?\n/);

      const lineHeightMm = (fontSizePt * (docInstance.getLineHeightFactor?.() || 1.15)) / docInstance.internal.scaleFactor;

      lines.forEach((line, index) => {
        writeMixedLine(line, x, y + index * lineHeightMm, { fontStyle, align, fontSizePt });
      });

      docInstance.setFont(previousFont.fontName, previousFont.fontStyle);
      docInstance.setFontSize(previousSize);
      return { lines, lineCount: lines.length };
    };

    // ---------- Watermark: the doctor's uploaded logo, large, centered,
    // and very faint, sitting behind everything else on the page. Drawn
    // first so all subsequent text/lines render on top of it. ----------
    if (profile?.prescription_logo_url) {
      const logoDataUrl = await fetchImageAsDataUrl(profile.prescription_logo_url);
      if (logoDataUrl) {
        try {
          const wmSize = pageWidth * 0.65;
          const wmX = (pageWidth - wmSize) / 2;
          const wmY = (pageHeight - wmSize) / 2;
          doc.saveGraphicsState();
          doc.setGState(new doc.GState({ opacity: watermarkOpacity }));
          doc.addImage(logoDataUrl, 'PNG', wmX, wmY, wmSize, wmSize, undefined, 'FAST');
          doc.restoreGraphicsState();
        } catch {
          // skip malformed logo
        }
      }
    }

    // ---------- Fixed A4 band layout ----------
    const bandHeaderH = pageHeight * 0.12;
    const bandPatientH = pageHeight * 0.06;
    const bandFooterH = pageHeight * 0.04;
    const bandMainH = pageHeight - bandHeaderH - bandPatientH - bandFooterH;

    const headerTop = 0;
    const patientTop = bandHeaderH;
    const mainTop = bandHeaderH + bandPatientH;
    const footerTop = pageHeight - bandFooterH;

    // ---------- Band 1: Header (Doctor left, Chamber right) ----------
    doc.setFillColor(238, 238, 236);
    doc.rect(0, headerTop, pageWidth, bandHeaderH, 'F');

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(15);
    let y = headerTop + 10;
    writeText(doc, `DR. ${(profile?.full_name || '').toUpperCase()}`, margin, y, { fontStyle: 'bold' });

    doc.setFontSize(10);
    let leftY = y + 6;
    if (profile?.designation) {
      writeText(doc, profile.designation, margin, leftY, { fontStyle: 'bold' });
      leftY += 4.5;
    }
    if (profile?.degrees) {
      writeText(doc, profile.degrees, margin, leftY, { fontStyle: 'normal' });
      leftY += 4.5;
    }
    if (profile?.medical_college) {
      writeText(doc, profile.medical_college, margin, leftY, { fontStyle: 'normal' });
      leftY += 4.5;
    }
    if (profile?.bmdc_number) {
      writeText(doc, `BMDC Reg No- ${profile.bmdc_number}`, margin, leftY, { fontStyle: 'normal' });
      leftY += 4.5;
    }

    let rightY = y - 4;
    doc.setFontSize(11);
    writeText(doc, 'Chamber', pageWidth - margin, rightY, { fontStyle: 'bold', align: 'right' });
    rightY += 5.5;
    doc.setFontSize(10);
    if (profile?.chamber_name) {
      writeText(doc, profile.chamber_name, pageWidth - margin, rightY, { fontStyle: 'normal', align: 'right' });
      rightY += 4.5;
    }
    if (profile?.chamber_address) {
      writeText(doc, profile.chamber_address, pageWidth - margin, rightY, { fontStyle: 'normal', align: 'right' });
      rightY += 4.5;
    }
    if (profile?.chamber_mobile) {
      writeText(doc, `Mobile: ${profile.chamber_mobile}`, pageWidth - margin, rightY, { fontStyle: 'normal', align: 'right' });
      rightY += 4.5;
    }
    if (profile?.visit_time || profile?.day_off) {
      const line = [
        profile?.visit_time && `Visit: ${profile.visit_time}`,
        profile?.day_off && `${profile.day_off} Off`,
      ].filter(Boolean).join('  ·  ');
      writeText(doc, line, pageWidth - margin, rightY, { fontStyle: 'normal', align: 'right' });
    }
    doc.setTextColor(20, 20, 20);

    // ---------- Band 2: Patient details bar ----------
    y = patientTop + 8;
    doc.setFontSize(11);
    writeText(doc, `Name: ${patientName || '—'}`, margin, y, { fontStyle: 'bold' });
    writeText(doc, `Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, y, {
      fontStyle: 'bold',
      align: 'right',
    });
    y += 6;
    doc.setFontSize(9.5);
    const patientLine2 = [
      patientAge && `Age: ${patientAge}`,
      patientAddress && `Address: ${patientAddress}`,
    ].filter(Boolean).join('     ');
    if (patientLine2) writeText(doc, patientLine2, margin, y, { fontStyle: 'normal' });
    if (patientMobile) {
      writeText(doc, `Mobile: ${patientMobile}`, pageWidth - margin, y, { fontStyle: 'normal', align: 'right' });
    }

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
      doc.setFontSize(8.5);
      doc.setTextColor(20, 20, 20);
      if (tooth.ul) writeText(doc, String(tooth.ul), x - armLen - 1, yCenter - 1.2, { fontStyle: 'normal', align: 'right' });
      if (tooth.ur) writeText(doc, String(tooth.ur), x + armLen + 1, yCenter - 1.2, { fontStyle: 'normal', align: 'left' });
      if (tooth.ll) writeText(doc, String(tooth.ll), x - armLen - 1, yCenter + 4, { fontStyle: 'normal', align: 'right' });
      if (tooth.lr) writeText(doc, String(tooth.lr), x + armLen + 1, yCenter + 4, { fontStyle: 'normal', align: 'left' });
    };

    const writeClinicalSection = (label, lines, startY, tooth) => {
      const items = filteredLines(lines);
      if (items.length === 0) return startY;
      let cy = startY;
      doc.setFontSize(10.5);
      doc.setTextColor(15, 61, 62);
      writeText(doc, label.toUpperCase(), leftColX, cy, { fontStyle: 'bold' });
      doc.setTextColor(20, 20, 20);
      cy += 5.5;
      doc.setFontSize(10);
      const colWidth = dividerX - leftColX - 6;

      items.forEach((l) => {
        const hasToothGraphic = tooth && l.tooth && (l.tooth.ur || l.tooth.ul || l.tooth.lr || l.tooth.ll);
        const textMaxWidth = colWidth - (hasToothGraphic ? 16 : 0);
        const lineStartY = cy;
        const { lineCount } = writeText(doc, l.text, leftColX + 3, cy, {
          fontStyle: 'normal',
          maxWidth: textMaxWidth,
        });
        if (hasToothGraphic) drawToothQuadrant(leftColX + 3 + textMaxWidth + 10, lineStartY - 1, l.tooth);
        cy += Math.max(lineCount * 5, hasToothGraphic ? 9 : 0);
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
    doc.setFontSize(20);
    doc.setTextColor(15, 61, 62);
    writeText(doc, 'Rx.', rightColX, rxY, { fontStyle: 'bolditalic' });
    doc.setTextColor(20, 20, 20);
    rxY += 10;

    filteredMedicines(medicines).forEach((m, i) => {
      doc.setFontSize(11);
      const nameResult = writeText(doc, `${i + 1}. ${m.name}`, rightColX, rxY, {
        fontStyle: 'bold',
        maxWidth: pageWidth - rightColX - margin,
      });
      rxY += nameResult.lineCount * 5.2;

      doc.setFontSize(9.5);
      const details = [m.dose, m.duration].filter(Boolean).join('   ——   ');
      if (details) {
        const detailResult = writeText(doc, details, rightColX + 4, rxY, {
          fontStyle: 'normal',
          maxWidth: pageWidth - rightColX - margin - 4,
        });
        rxY += detailResult.lineCount * 4.6;
      }
      rxY += 3.5;
    });

    if (selectedAdvice.length > 0) {
      rxY += 6;
      doc.setFontSize(13);
      doc.setTextColor(15, 61, 62);
      writeText(doc, 'Advice', rightColX, rxY, { fontStyle: 'bolditalic' });
      doc.setTextColor(20, 20, 20);
      rxY += 6.5;
      doc.setFontSize(10);

      selectedAdvice.forEach((a, i) => {
        const adviceResult = writeText(doc, `${i + 1}. ${a.text}`, rightColX + 4, rxY, {
          fontStyle: 'normal',
          maxWidth: pageWidth - rightColX - margin - 4,
        });
        rxY += adviceResult.lineCount * 5;
      });
    }

    // ---------- Band 4: Footer ----------
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.4);
    doc.line(margin, footerTop, pageWidth - margin, footerTop);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    writeText(doc, footerText, pageWidth / 2, footerTop + 7, { fontStyle: 'italic', align: 'center' });

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

    const patientId = await findOrCreatePatient(user.id, {
      name: patientName,
      phone: patientMobile,
      age: patientAge,
      address: patientAddress,
    });

    const { error: saveError } = await supabase.from('prescriptions').insert({
      created_by: user.id,
      patient_id: patientId,
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
          <div className="locked-feature-icon" style={{ display: 'flex', justifyContent: 'center' }}><IconLock size={40} /></div>
          <h2>This category requires an active subscription.</h2>
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
                <button type="button" className="icon-btn-danger" onClick={() => removeMedicine(i)} aria-label="Remove"><IconX size={14} /></button>
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconDownload size={15} /> Download PDF</span>
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
          <div className="panel-head-row">
            <h2>Recent prescriptions</h2>
            <button className="btn-secondary sm" onClick={() => navigate('/dashboard/chamber/prescriptions')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Full history & search <IconArrowRight size={14} /></button>
          </div>
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
