import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const TYPE_PRESETS = {
  email: { icon: '✉️', label: 'Email' },
  phone: { icon: '📞', label: 'Phone' },
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  facebook: { icon: '📘', label: 'Facebook' },
  custom: { icon: '🔗', label: '' },
};

const DEFAULT_METHODS = [
  { id: 'default-email', type: 'email', icon: '✉️', label: 'Email', value: 'dentalmcqbd@gmail.com' },
];

function newId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function ContactInfoPanel() {
  const [methods, setMethods] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addType, setAddType] = useState('email');

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'contact_methods').maybeSingle().then(({ data }) => {
      setMethods(Array.isArray(data?.value) ? data.value : DEFAULT_METHODS);
    });
  }, []);

  const persist = async (next) => {
    setMethods(next);
    setSaving(true);
    setSaved(false);
    await supabase.from('app_settings').upsert({
      key: 'contact_methods',
      value: next,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    setSaved(true);
  };

  const addMethod = () => {
    const preset = TYPE_PRESETS[addType];
    persist([...methods, { id: newId(), type: addType, icon: preset.icon, label: preset.label || 'Contact', value: '' }]);
  };

  const updateMethod = (id, patch) => {
    setMethods((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const saveMethod = () => {
    persist(methods);
  };

  const removeMethod = (id) => {
    persist(methods.filter((m) => m.id !== id));
  };

  const move = (id, dir) => {
    const idx = methods.findIndex((m) => m.id === id);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= methods.length) return;
    const next = [...methods];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    persist(next);
  };

  if (methods === null) return null;

  return (
    <div className="panel">
      <h2>Contact Us page</h2>
      <p className="muted small">
        What students see on the Contact Us page — add, edit, remove, or reorder any method
        (email, phone, WhatsApp, Facebook, or anything else) without needing a code change.
      </p>

      <div className="contact-editor-list">
        {methods.map((m, i) => (
          <div key={m.id} className="contact-editor-row">
            <div className="compact-field-list">
              <div className="compact-field-row">
                <span className="compact-field-label">Icon:</span>
                <input
                  className="compact-field-input"
                  style={{ maxWidth: 60 }}
                  value={m.icon}
                  onChange={(e) => updateMethod(m.id, { icon: e.target.value })}
                />
              </div>
              <div className="compact-field-row">
                <span className="compact-field-label">Label:</span>
                <input
                  className="compact-field-input"
                  value={m.label}
                  onChange={(e) => updateMethod(m.id, { label: e.target.value })}
                  placeholder="e.g. WhatsApp"
                />
              </div>
              <div className="compact-field-row">
                <span className="compact-field-label">Value:</span>
                <input
                  className="compact-field-input"
                  value={m.value}
                  onChange={(e) => updateMethod(m.id, { value: e.target.value })}
                  placeholder={m.type === 'email' ? 'name@example.com' : m.type === 'phone' || m.type === 'whatsapp' ? '+8801XXXXXXXXX' : 'https://...'}
                />
              </div>
            </div>
            <div className="contact-editor-actions">
              <button className="btn-secondary sm" onClick={() => move(m.id, -1)} disabled={i === 0}>↑</button>
              <button className="btn-secondary sm" onClick={() => move(m.id, 1)} disabled={i === methods.length - 1}>↓</button>
              <button className="btn-secondary sm" onClick={saveMethod}>Save</button>
              <button className="btn-danger sm" onClick={() => removeMethod(m.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {methods.length === 0 && <p className="muted small">No contact methods yet — add one below.</p>}

      <div className="compact-field-row" style={{ marginTop: 14 }}>
        <span className="compact-field-label">Add:</span>
        <select className="role-filter-select" value={addType} onChange={(e) => setAddType(e.target.value)}>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="facebook">Facebook</option>
          <option value="custom">Custom</option>
        </select>
        <button className="btn-primary sm" onClick={addMethod}>+ Add method</button>
      </div>

      {saved && !saving && <div className="ok-box" style={{ marginTop: 10 }}>Saved.</div>}
      {saving && <p className="muted small" style={{ marginTop: 10 }}>Saving…</p>}
    </div>
  );
}
