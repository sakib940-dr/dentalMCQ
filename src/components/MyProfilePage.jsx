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
    degrees: profile?.degrees || '',
    designation: profile?.designation || '',
  });
  const [chamberForm, setChamberForm] = useState({
    chamberName: profile?.chamber_name || '',
    chamberAddress: profile?.chamber_address || '',
    chamberMobile: profile?.chamber_mobile || '',
    visitTime: profile?.visit_time || '',
    dayOff: profile?.day_off || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [chamberSaving, setChamberSaving] = useState(false);
  const [chamberSaved, setChamberSaved] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const updateChamber = (field) => (e) => setChamberForm((f) => ({ ...f, [field]: e.target.value }));

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
        degrees: form.degrees.trim() || null,
        designation: form.designation.trim() || null,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setSaved(true);
    refreshProfile();
  };

  const saveChamber = async (e) => {
    e.preventDefault();
    setChamberSaving(true);
    setChamberSaved(false);
    await supabase
      .from('profiles')
      .update({
        chamber_name: chamberForm.chamberName.trim() || null,
        chamber_address: chamberForm.chamberAddress.trim() || null,
        chamber_mobile: chamberForm.chamberMobile.trim() || null,
        visit_time: chamberForm.visitTime.trim() || null,
        day_off: chamberForm.dayOff.trim() || null,
      })
      .eq('id', profile.id);
    setChamberSaving(false);
    setChamberSaved(true);
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
          This information auto-fills the prescription generator's doctor details (left side of the pad).
        </p>

        <form className="exam-form-fields" onSubmit={save} style={{ marginTop: 14 }}>
          <label>
            <span>Full name</span>
            <input value={form.fullName} onChange={update('fullName')} required />
          </label>
          <label>
            <span>Designation</span>
            <input value={form.designation} onChange={update('designation')} placeholder="e.g. Oral & Dental Surgeon" />
          </label>
          <label>
            <span>Degrees</span>
            <input value={form.degrees} onChange={update('degrees')} placeholder="e.g. BDS (DDC), PGT (OMS)" />
          </label>
          <label>
            <span>Medical college</span>
            <input value={form.medicalCollege} onChange={update('medicalCollege')} placeholder="e.g. Dhaka Dental College & Hospital" />
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
            <input value={form.bmdcNumber} onChange={update('bmdcNumber')} placeholder="e.g. 13683" />
          </label>
          <label>
            <span>Mobile number</span>
            <input value={form.mobileNumber} onChange={update('mobileNumber')} inputMode="numeric" maxLength={11} />
          </label>
          <label>
            <span>Personal address</span>
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
        <h2>Chamber Details</h2>
        <p className="muted small">Shown on the right side of every prescription you generate.</p>

        <form className="exam-form-fields" onSubmit={saveChamber} style={{ marginTop: 14 }}>
          <label>
            <span>Chamber / clinic name</span>
            <input value={chamberForm.chamberName} onChange={updateChamber('chamberName')} placeholder="e.g. Doctor's Dental Clinic" />
          </label>
          <label>
            <span>Chamber address</span>
            <textarea value={chamberForm.chamberAddress} onChange={updateChamber('chamberAddress')} rows={2} placeholder="e.g. Railgate Mor, Sirajganj Sadar" />
          </label>
          <label>
            <span>Chamber mobile</span>
            <input value={chamberForm.chamberMobile} onChange={updateChamber('chamberMobile')} placeholder="e.g. 01780-261790" />
          </label>
          <label>
            <span>Visit time</span>
            <input value={chamberForm.visitTime} onChange={updateChamber('visitTime')} placeholder="e.g. 5PM-9PM" />
          </label>
          <label>
            <span>Day off</span>
            <input value={chamberForm.dayOff} onChange={updateChamber('dayOff')} placeholder="e.g. Friday" />
          </label>

          {chamberSaved && <div className="ok-box">Chamber details updated.</div>}
          <button type="submit" className="btn-primary" disabled={chamberSaving} style={{ alignSelf: 'flex-start' }}>
            {chamberSaving ? 'Saving…' : 'Save chamber details'}
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
