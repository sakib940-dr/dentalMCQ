import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ContactInfoPanel() {
  const [email, setEmail] = useState('');
  const [facebook, setFacebook] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('*').in('key', ['contact_email', 'contact_facebook']).then(({ data }) => {
      const map = {};
      (data || []).forEach((row) => { map[row.key] = row.value; });
      setEmail(map.contact_email || 'dentalmcqbd@gmail.com');
      setFacebook(map.contact_facebook || '');
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await Promise.all([
      supabase.from('app_settings').upsert({ key: 'contact_email', value: email.trim(), updated_at: new Date().toISOString() }),
      supabase.from('app_settings').upsert({ key: 'contact_facebook', value: facebook.trim(), updated_at: new Date().toISOString() }),
    ]);
    setSaving(false);
    setSaved(true);
  };

  if (loading) return null;

  return (
    <div className="panel">
      <h2>Contact Us page</h2>
      <p className="muted small">What students see on the Contact Us page.</p>
      <div className="compact-field-list" style={{ marginTop: 10 }}>
        <div className="compact-field-row">
          <span className="compact-field-label">Email:</span>
          <input className="compact-field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="compact-field-row">
          <span className="compact-field-label">Facebook:</span>
          <input className="compact-field-input" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/... (optional)" />
        </div>
      </div>
      {saved && <div className="ok-box" style={{ marginTop: 8 }}>Saved.</div>}
      <button className="btn-secondary sm" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
