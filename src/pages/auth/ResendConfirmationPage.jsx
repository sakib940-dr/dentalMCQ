import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BrandWordmark from '../../components/BrandWordmark';
import { useResendCooldown, parseRateLimitSeconds } from '../../lib/useResendCooldown';

export default function ResendConfirmationPage() {
  const { resendConfirmationEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const cooldown = useResendCooldown(60);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await resendConfirmationEmail(email);
    setLoading(false);
    if (error) {
      const waitSecs = parseRateLimitSeconds(error.message);
      if (waitSecs) cooldown.start(waitSecs);
      setError(error.message);
      return;
    }
    cooldown.start(60);
    setSent(true);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandWordmark />
        <h1>Resend confirmation email</h1>
        <p className="auth-sub">
          Already registered but never got the confirmation link, or it expired? Enter your email
          below and we'll send a new one.
        </p>

        {sent ? (
          <div className="panel" style={{ marginTop: 10 }}>
            <p className="muted">If <b>{email}</b> has an unconfirmed account, a new confirmation link is on its way.</p>
            <p className="muted small" style={{ marginTop: 8 }}>
              Check both your <b>Inbox</b> and <b>Spam/Junk</b> folder.
            </p>
            <button
              className="btn-secondary"
              style={{ marginTop: 10 }}
              onClick={handleSubmit}
              disabled={cooldown.active}
            >
              {cooldown.active ? `Resend available in ${cooldown.remaining}s` : 'Send again'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            {error && <div className="error-box">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading || cooldown.active}>
              {loading ? 'Sending…' : cooldown.active ? `Resend available in ${cooldown.remaining}s` : 'Send confirmation link'}
            </button>
          </form>
        )}

        <p className="auth-switch">
          <Link to="/login">← Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
