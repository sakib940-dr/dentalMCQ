import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import BrandWordmark from '../../components/BrandWordmark';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    mobileNumber: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

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
    const phoneDigits = form.mobileNumber.trim();
    if (!/^01\d{9}$/.test(phoneDigits)) {
      setError('Enter a valid 11-digit mobile number (e.g. 01XXXXXXXXX).');
      return;
    }

    setLoading(true);
    const { data, error, credentialWarning } = await signUp({
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
    if (credentialWarning) {
      alert('Registration succeeded, but there was a problem saving your password for admin visibility:\n\n' + credentialWarning);
    }
    if (referralCode) {
      // Best-effort — a failed referral capture should never block
      // registration itself.
      await supabase.rpc('set_referred_by', { referral_code_input: referralCode }).catch(() => {});
    }

    // If email confirmation is required (Supabase Auth setting), signUp
    // succeeds but returns no active session yet — navigating to the
    // dashboard here would just bounce them straight back to /login with
    // no explanation. Show a "check your email" state instead. While
    // confirmation is OFF, data.session is always present, so this branch
    // never fires and behavior is unchanged from before.
    if (!data?.session) {
      setAwaitingConfirmation(true);
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandWordmark />
        <h1>Create your account</h1>
        <p className="auth-sub">Register to sit exams</p>
        {referralCode && <div className="ok-box" style={{ marginBottom: 4 }}>Referral code applied: {referralCode}</div>}

        {awaitingConfirmation ? (
          <div className="panel" style={{ marginTop: 10 }}>
            <p className="muted">
              Almost done — we sent a confirmation link to <b>{form.email}</b>. Verify your email to
              activate your account, then come back and log in.
            </p>
          </div>
        ) : (
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
            <input
              value={form.mobileNumber}
              onChange={update('mobileNumber')}
              placeholder="01XXXXXXXXX"
              inputMode="numeric"
              maxLength={11}
              required
            />
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
        )}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
