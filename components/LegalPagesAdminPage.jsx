import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function LegalPageEditor({ pageKey, label }) {
  const [page, setPage] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('legal_pages').select('*').eq('key', pageKey).maybeSingle().then(({ data }) => {
      setPage(data);
      setTitle(data?.title || label);
      setContent(data?.content || '');
    });
  }, [pageKey]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from('legal_pages').upsert({ key: pageKey, title, content, updated_at: new Date().toISOString() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (page === null && content === '') {
    // still loading vs. genuinely empty — a tiny delay avoids a flash
  }

  return (
    <div className="panel">
      <h2>{label}</h2>
      <div className="exam-form-fields">
        <label>
          <span>পেজের টাইটেল</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span>কনটেন্ট — প্যারাগ্রাফের মাঝে একটা ফাঁকা লাইন দিন</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} />
        </label>
      </div>
      <button className="btn-primary sm" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
      </button>
      {saved && <span className="muted small" style={{ marginLeft: 10, color: 'var(--green)' }}>সেভ হয়েছে ✓</span>}
    </div>
  );
}

export default function LegalPagesAdminPage() {
  return (
    <>
      <LegalPageEditor pageKey="terms" label="শর্তাবলী (Terms & Conditions)" />
      <LegalPageEditor pageKey="privacy_policy" label="প্রাইভেসি পলিসি" />
    </>
  );
}
