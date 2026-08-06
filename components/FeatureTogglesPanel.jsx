import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function FeatureTogglesPanel() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('app_settings').select('*');
    const map = {};
    (data || []).forEach((row) => { map[row.key] = row.value; });
    setSettings(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (key) => {
    const next = !settings[key];
    setSettings((s) => ({ ...s, [key]: next }));
    await supabase.from('app_settings').upsert({ key, value: next, updated_at: new Date().toISOString() });
  };

  if (loading) return null;

  return (
    <div className="panel">
      <h2>Feature Access</h2>
      <p className="muted small">
        Turn Practice or Live Exam off for everyone at once. The cards stay visible to students —
        they'll see a locked message instead of disappearing.
      </p>

      <div className="feature-toggle-row">
        <div>
          <div className="feature-toggle-title">Practice Mode</div>
          <div className="muted small">Chapter-wise practice and wrong-question review.</div>
        </div>
        <label className="mini-toggle">
          <input type="checkbox" checked={!!settings.practice_enabled_global} onChange={() => toggle('practice_enabled_global')} />
          <span>{settings.practice_enabled_global ? 'On' : 'Off'}</span>
        </label>
      </div>

      <div className="feature-toggle-row">
        <div>
          <div className="feature-toggle-title">Live Exam</div>
          <div className="muted small">Scheduled live exams that count toward the merit list.</div>
        </div>
        <label className="mini-toggle">
          <input type="checkbox" checked={!!settings.live_exam_enabled_global} onChange={() => toggle('live_exam_enabled_global')} />
          <span>{settings.live_exam_enabled_global ? 'On' : 'Off'}</span>
        </label>
      </div>
    </div>
  );
}
