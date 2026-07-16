import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BrandWordmark from '../../components/BrandWordmark';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await sendPasswordReset(email);
    setLoading(false);
    // Always show the same "check your email" result, whether or not the
    // address exists — never reveal which emails are registered.
    if (error) { setError(error.message); return; }
    setSent(true);
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
              If an account exists for <b>{email}</b>, a password reset link is on its way. Check your
              inbox (and spam folder), then follow the link to set a new password.
            </p>
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
