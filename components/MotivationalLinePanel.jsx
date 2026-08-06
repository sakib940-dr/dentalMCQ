import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const DEFAULT_LINE = "Every question you solve today is one step closer to the merit list.";

export default function MotivationalLinePanel() {
  const [line, setLine] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'dashboard_motivational_line').maybeSingle().then(({ data }) => {
      setLine(data?.value || DEFAULT_LINE);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from('app_settings').upsert({
      key: 'dashboard_motivational_line',
      value: line.trim() || DEFAULT_LINE,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    setSaved(true);
  };

  if (loading) return null;

  return (
    <div className="panel">
      <h2>Student Dashboard Message</h2>
      <p className="muted small">
        Small motivational line shown under every student's name on their Home screen.
      </p>
      <textarea
        className="compact-field-input"
        style={{ width: '100%', marginTop: 10 }}
        rows={2}
        value={line}
        onChange={(e) => setLine(e.target.value)}
      />
      {saved && <div className="ok-box" style={{ marginTop: 8 }}>Saved.</div>}
      <button className="btn-secondary sm" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
