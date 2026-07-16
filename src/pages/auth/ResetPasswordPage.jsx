import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BrandWordmark from '../../components/BrandWordmark';

export default function ResetPasswordPage() {
  const { session, loading: authLoading, updatePasswordAfterRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const { error } = await updatePasswordAfterRecovery(password);
    setLoading(false);
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('session') || msg.includes('expired') || msg.includes('token')) {
        setError('This link has expired while you were on this page. Please request a new one.');
      } else {
        setError(error.message || 'Could not update your password. Please try again.');
      }
      return;
    }
    setDone(true);
  };

  if (authLoading) return null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandWordmark />
        <h1>Set a new password</h1>

        {!session ? (
          <>
            <p className="auth-sub">This reset link is invalid or has expired.</p>
            <p className="auth-switch"><Link to="/forgot-password">Request a new link</Link></p>
          </>
        ) : done ? (
          <>
            <div className="panel" style={{ marginTop: 10 }}>
              <p className="muted">Your password has been updated.</p>
            </div>
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => navigate('/', { replace: true })}>
              Continue
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            {error && (
              <div className="error-box">
                {error}
                {error.includes('expired') && <> <Link to="/forgot-password">Request a new one</Link>.</>}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
