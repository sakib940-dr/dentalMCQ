import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabaseClient';

const REQUIRED_COLUMNS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
];

export default function CsvQuestionImporter({ chapterId, onImported }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [duplicateTexts, setDuplicateTexts] = useState(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const reset = () => {
    setRows([]);
    setErrors([]);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (parsed) => {
        const foundColumns = parsed.meta.fields || [];
        const missing = REQUIRED_COLUMNS.filter((c) => !foundColumns.includes(c));
        if (missing.length > 0) {
          setErrors([`Missing required column(s): ${missing.join(', ')}`]);
          setRows([]);
          return;
        }

        const validationErrors = [];
        const cleanRows = [];

        parsed.data.forEach((row, i) => {
          const lineNum = i + 2; // +1 header, +1 to make it 1-indexed
          const q = (row.question || '').trim();
          const a = (row.option_a || '').trim();
          const b = (row.option_b || '').trim();
          const c = (row.option_c || '').trim();
          const d = (row.option_d || '').trim();
          const correct = (row.correct_answer || '').trim().toUpperCase();
          const explanation = (row.explanation || '').trim();

          if (!q || !a || !b || !c || !d) {
            validationErrors.push(`Row ${lineNum}: missing question text or one of the options.`);
            return;
          }
          if (!['A', 'B', 'C', 'D'].includes(correct)) {
            validationErrors.push(`Row ${lineNum}: correct_answer must be A, B, C or D (got "${row.correct_answer}").`);
            return;
          }

          cleanRows.push({
            question_text: q,
            option_a: a,
            option_b: b,
            option_c: c,
            option_d: d,
            correct_option: correct,
            explanation: explanation || null,
          });
        });

        setErrors(validationErrors);
        setRows(cleanRows);
      },
      error: (err) => {
        setErrors([`Could not read file: ${err.message}`]);
      },
    });
  };

  useEffect(() => {
    let cancelled = false;
    async function checkDuplicates() {
      if (rows.length === 0 || !chapterId) { setDuplicateTexts(new Set()); return; }
      setCheckingDuplicates(true);
      const { data, error } = await supabase.rpc('find_duplicate_questions', {
        target_chapter_id: chapterId,
        question_texts: rows.map((r) => r.question_text),
      });
      setCheckingDuplicates(false);
      if (cancelled || error) return;
      setDuplicateTexts(new Set((data || []).filter((d) => d.is_duplicate).map((d) => d.question_text)));
    }
    checkDuplicates();
    return () => { cancelled = true; };
  }, [rows, chapterId]);

  const handleImport = async () => {
    if (!chapterId) {
      setErrors((e) => [...e, 'Select a chapter before importing.']);
      return;
    }
    if (rows.length === 0) return;

    setImporting(true);
    const rowsToImport = skipDuplicates ? rows.filter((r) => !duplicateTexts.has(r.question_text)) : rows;
    const payload = rowsToImport.map((r) => ({ ...r, chapter_id: chapterId }));

    if (payload.length === 0) {
      setImporting(false);
      setResult({ inserted: 0, failed: 'All rows were duplicates and were skipped.' });
      return;
    }

    // Insert in batches of 500 to stay well under request size limits
    const batchSize = 500;
    let insertedCount = 0;
    let failed = null;

    for (let i = 0; i < payload.length; i += batchSize) {
      const batch = payload.slice(i, i + batchSize);
      const { error, count } = await supabase.from('questions').insert(batch).select('id', { count: 'exact' });
      if (error) {
        failed = error.message;
        break;
      }
      insertedCount += count ?? batch.length;
    }

    setImporting(false);

    if (failed) {
      setResult({ ok: false, message: failed });
      return;
    }

    setResult({ ok: true, message: `Imported ${insertedCount} question${insertedCount !== 1 ? 's' : ''} successfully.` });
    setRows([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    onImported?.(insertedCount);
  };

  return (
    <div className="csv-importer">
      <div className="csv-importer-head">
        <h3>Import questions from CSV</h3>
        <p className="muted small">
          Columns required (in any order): <code>question, option_a, option_b, option_c, option_d, correct_answer, explanation</code>.
          <br />
          <code>correct_answer</code> must be A, B, C, or D. Example row:
        </p>
        <pre className="csv-example">
{`question,option_a,option_b,option_c,option_d,correct_answer,explanation
"What is 2+2?","3","4","5","6","B","Basic math"`}
        </pre>
      </div>

      <label className="file-drop">
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} hidden />
        <span>{fileName || 'Choose a CSV file'}</span>
        <span className="file-drop-btn">Browse</span>
      </label>

      {errors.length > 0 && (
        <div className="error-box">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
            {errors.length > 10 && <li>…and {errors.length - 10} more issue(s).</li>}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="csv-preview-summary">
            {rows.length} valid question{rows.length !== 1 ? 's' : ''} ready to import
            {!chapterId && <span className="warn-inline"> — select a chapter above first</span>}
          </div>

          {checkingDuplicates && <div className="muted small">Checking for duplicates…</div>}
          {!checkingDuplicates && duplicateTexts.size > 0 && (
            <div className="warn-box">
              {duplicateTexts.size} question{duplicateTexts.size !== 1 ? 's' : ''} already exist{duplicateTexts.size === 1 ? 's' : ''} in this chapter (exact text match).
              <label className="checkbox-row" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
                <span>Skip duplicates on import</span>
              </label>
            </div>
          )}

          <div className="csv-preview-table-wrap">
            <table className="csv-preview-table">
              <thead>
                <tr><th>#</th><th>Question</th><th>Correct</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className={duplicateTexts.has(r.question_text) ? 'csv-row-duplicate' : ''}>
                    <td>{i + 1}</td>
                    <td className="q-cell">
                      {r.question_text}
                      {duplicateTexts.has(r.question_text) && <span className="csv-duplicate-tag"> duplicate</span>}
                    </td>
                    <td>{r.correct_option}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && <div className="csv-preview-more">…and {rows.length - 8} more</div>}
          </div>

          <div className="csv-importer-actions">
            <button className="btn-secondary" onClick={reset} disabled={importing}>Cancel</button>
            <button className="btn-primary" onClick={handleImport} disabled={importing || !chapterId || checkingDuplicates}>
              {importing ? 'Importing…' : `Import ${skipDuplicates ? rows.length - duplicateTexts.size : rows.length} question${rows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className={result.ok ? 'ok-box' : 'error-box'}>{result.message}</div>
      )}
    </div>
  );
}
