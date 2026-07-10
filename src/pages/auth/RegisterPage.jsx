import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    mobileNumber: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error } = await signUp({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      mobileNumber: form.mobileNumber.trim(),
    });
    setLoading(false);

    if (error) {
      setError(error.message || 'Registration failed. Try a different username or email.');
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-mark">EH</div>
        <h1>Create your account</h1>
        <p className="auth-sub">Register to sit exams</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>Full name</span>
            <input value={form.fullName} onChange={update('fullName')} required />
          </label>
          <label>
            <span>Username</span>
            <input value={form.username} onChange={update('username')} required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={update('email')} required />
          </label>
          <label>
            <span>Mobile number</span>
            <input value={form.mobileNumber} onChange={update('mobileNumber')} />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={form.password} onChange={update('password')} required />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
