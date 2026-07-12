import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function MyProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    fullName: profile?.full_name || '',
    medicalCollege: profile?.medical_college || '',
    hometown: profile?.hometown || '',
    bmdcNumber: profile?.bmdc_number || '',
    sessionYear: profile?.session_year || '',
    address: profile?.address || '',
    mobileNumber: profile?.mobile_number || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: form.fullName.trim(),
        medical_college: form.medicalCollege.trim() || null,
        hometown: form.hometown.trim() || null,
        bmdc_number: form.bmdcNumber.trim() || null,
        session_year: form.sessionYear.trim() || null,
        address: form.address.trim() || null,
        mobile_number: form.mobileNumber.trim() || null,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setSaved(true);
    refreshProfile();
  };

  const referralLink = profile?.referral_code
    ? `${window.location.origin}/register?ref=${profile.referral_code}`
    : '';

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  return (
    <>
      <div className="panel">
        <h2>My Profile</h2>
        <p className="muted small">
          This information is used across the app — including auto-filling the prescription
          generator's doctor details.
        </p>

        <form className="exam-form-fields" onSubmit={save} style={{ marginTop: 14 }}>
          <label>
            <span>Full name</span>
            <input value={form.fullName} onChange={update('fullName')} required />
          </label>
          <label>
            <span>Medical college</span>
            <input value={form.medicalCollege} onChange={update('medicalCollege')} placeholder="e.g. Dhaka Dental College" />
          </label>
          <label>
            <span>Session</span>
            <input value={form.sessionYear} onChange={update('sessionYear')} placeholder="e.g. 2019-20" />
          </label>
          <label>
            <span>Hometown</span>
            <input value={form.hometown} onChange={update('hometown')} />
          </label>
          <label>
            <span>BMDC registration number</span>
            <input value={form.bmdcNumber} onChange={update('bmdcNumber')} placeholder="e.g. BM-12345" />
          </label>
          <label>
            <span>Mobile number</span>
            <input value={form.mobileNumber} onChange={update('mobileNumber')} inputMode="numeric" maxLength={11} />
          </label>
          <label>
            <span>Address (chamber / clinic / home)</span>
            <textarea value={form.address} onChange={update('address')} rows={2} />
          </label>

          {error && <div className="error-box">{error}</div>}
          {saved && <div className="ok-box">Profile updated.</div>}
          <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Referral</h2>
        <p className="muted small">Share your link — friends who register through it will be linked to you.</p>
        <div className="referral-box">
          <input readOnly value={referralLink} className="referral-input" />
          <button className="btn-primary" onClick={copyReferral}>{copied ? 'Copied!' : 'Copy link'}</button>
        </div>
      </div>
    </>
  );
}
