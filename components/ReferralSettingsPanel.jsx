import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ReferralSettingsPanel() {
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('app_settings').select('key, value').in('key', ['referral_reward_enabled', 'referral_reward_days']);
    const map = {};
    (data || []).forEach((row) => { map[row.key] = row.value; });
    setEnabled(!!map.referral_reward_enabled);
    setDays(map.referral_reward_days ?? 15);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (nextEnabled, nextDays) => {
    setSaving(true);
    setSaved(false);
    await Promise.all([
      supabase.from('app_settings').upsert({ key: 'referral_reward_enabled', value: nextEnabled, updated_at: new Date().toISOString() }),
      supabase.from('app_settings').upsert({ key: 'referral_reward_days', value: nextDays, updated_at: new Date().toISOString() }),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    save(next, days);
  };

  if (loading) return null;

  return (
    <div className="panel">
      <h2>Referral Reward</h2>
      <p className="muted small">
        রেফারেল লিংকে কেউ রেজিস্টার করে পেমেন্ট Approve করালে, রেফারারকে অটোমেটিক এক্সট্রা দিন যোগ হবে
        (রেফারারের চলমান প্যাকেজের মেয়াদ বাড়িয়ে)।
      </p>

      <div className="feature-toggle-row">
        <div>
          <div className="feature-toggle-title">Reward চালু আছে?</div>
          <div className="muted small">বন্ধ থাকলে Referral পেজে "শীঘ্রই আসছে" মেসেজ দেখাবে, কোনো দিন যোগ হবে না।</div>
        </div>
        <label className="mini-toggle">
          <input type="checkbox" checked={enabled} onChange={toggle} />
          <span>{enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      <div className="compact-field-row" style={{ marginTop: 12 }}>
        <span className="compact-field-label">রিওয়ার্ড দিন সংখ্যা:</span>
        <input
          type="number"
          min={1}
          className="compact-field-input"
          style={{ maxWidth: 100 }}
          value={days}
          onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
          onBlur={() => save(enabled, days)}
        />
      </div>

      {saving && <p className="muted small" style={{ marginTop: 6 }}>সেভ হচ্ছে…</p>}
      {saved && !saving && <p className="muted small" style={{ marginTop: 6, color: 'var(--green)' }}>সেভ হয়েছে ✓</p>}
    </div>
  );
}
