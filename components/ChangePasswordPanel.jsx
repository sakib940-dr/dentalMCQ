import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePasswordPanel() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!current || !next || !confirm) {
      setError('Fill in all fields.');
      return;
    }
    if (next.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    const { error: changeError } = await changePassword(current, next);
    setSaving(false);

    if (changeError) {
      setError(changeError.message || 'Could not change password.');
      return;
    }

    setSuccess('Password updated successfully.');
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  return (
    <div className="panel">
      <h2>Change Password</h2>
      <form className="exam-form-fields" onSubmit={submit} style={{ marginTop: 14 }}>
        <label>
          <span>Current password</span>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label>
          <span>New password</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </label>
        <label>
          <span>Confirm new password</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <div className="error-box">{error}</div>}
        {success && <div className="ok-box">{success}</div>}
        <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
