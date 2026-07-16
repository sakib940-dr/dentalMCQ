import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BrandWordmark from '../../components/BrandWordmark';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('email not confirmed')) {
        setError('Please verify your email first — check your inbox for the confirmation link.');
      } else if (msg.includes('invalid login credentials')) {
        setError('Incorrect email or password.');
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setError('Could not reach the server. Check your internet connection and try again.');
      } else {
        setError(error.message || 'Login failed. Please try again.');
      }
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandWordmark />
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in to your exam account</p>

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
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <p className="auth-forgot-link"><Link to="/forgot-password">Forgot password?</Link></p>
          {error && <div className="error-box">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          New examinee? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}
