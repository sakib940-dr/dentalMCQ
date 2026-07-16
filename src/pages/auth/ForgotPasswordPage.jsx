import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BrandWordmark from '../../components/BrandWordmark';
import { useResendCooldown, parseRateLimitSeconds } from '../../lib/useResendCooldown';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const cooldown = useResendCooldown(60);

  const doSend = async () => {
    setError('');
    setResendSuccess(false);
    const { error } = await sendPasswordReset(email);
    if (error) {
      const waitSecs = parseRateLimitSeconds(error.message);
      if (waitSecs) cooldown.start(waitSecs);
      setError(error.message);
      return false;
    }
    cooldown.start(60);
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Always show the same "check your email" result, whether or not the
    // address exists — never reveal which emails are registered.
    const ok = await doSend();
    setLoading(false);
    if (ok) setSent(true);
  };

  const handleResend = async () => {
    const ok = await doSend();
    if (ok) setResendSuccess(true);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandWordmark />
        <h1>Reset your password</h1>
        <p className="auth-sub">Enter your account email and we'll send you a reset link.</p>

        {sent ? (
          <div className="panel" style={{ marginTop: 10 }}>
            <p className="muted">
              If an account exists for <b>{email}</b>, a password reset link is on its way.
            </p>
            <p className="muted small" style={{ marginTop: 8 }}>
              Check both your <b>Inbox</b> and <b>Spam/Junk</b> folder — reset emails sometimes land
              there, especially the first time.
            </p>
            {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}
            {resendSuccess && <div className="ok-box" style={{ marginTop: 10 }}>Reset link resent.</div>}
            <button
              className="btn-secondary"
              style={{ marginTop: 10 }}
              onClick={handleResend}
              disabled={cooldown.active}
            >
              {cooldown.active ? `Resend available in ${cooldown.remaining}s` : 'Resend reset link'}
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
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
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
