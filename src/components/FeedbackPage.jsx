import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { IconBug, IconLightbulb, IconMessageCircle, IconStar } from '../lib/examineeIcons';

const TYPES = [
  { key: 'bug', icon: IconBug, label: 'Report a Bug', placeholder: 'কী সমস্যা হয়েছে, কোন পেজে, কী করার চেষ্টা করছিলেন...' },
  { key: 'feature', icon: IconLightbulb, label: 'Suggest a Feature', placeholder: 'কী ফিচার থাকলে ভালো হতো...' },
  { key: 'general', icon: IconMessageCircle, label: 'Share Feedback', placeholder: 'আপনার মতামত লিখুন...' },
];

function StarRating({ value, onChange }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="star-rating-btn"
          onClick={() => onChange(n)}
          aria-label={`${n} star`}
        >
          <IconStar size={20} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!message.trim() && rating === 0) {
      setError('Please write a message or give a rating.');
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from('feedback').insert({
      user_id: user.id,
      type,
      message: message.trim() || null,
      rating: rating || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setSent(true);
    setMessage('');
    setRating(0);
  };

  return (
    <div className="panel">
      <h2>Feedback</h2>
      <p className="muted small">Bugs, feature ideas, or just how things are going — this goes straight to the admin team.</p>

      {sent && <div className="ok-box" style={{ marginBottom: 12 }}>Thanks — your feedback has been sent.</div>}

      <form onSubmit={submit}>
        <div className="mode-tabs" style={{ marginTop: 10 }}>
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={type === t.key ? 'mode-tab mode-tab-active' : 'mode-tab'}
              onClick={() => setType(t.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <textarea
          className="compact-field-input"
          style={{ width: '100%', marginTop: 12 }}
          rows={5}
          placeholder={TYPES.find((t) => t.key === type)?.placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <div style={{ marginTop: 14 }}>
          <div className="compact-field-label" style={{ marginBottom: 6 }}>Rate your overall experience (optional)</div>
          <StarRating value={rating} onChange={setRating} />
        </div>

        {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}

        <button type="submit" className="btn-primary" style={{ marginTop: 14 }} disabled={saving}>
          {saving ? 'Sending…' : 'Send Feedback'}
        </button>
      </form>
    </div>
  );
}
