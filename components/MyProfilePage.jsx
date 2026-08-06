import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

const MAX_LOGO_BYTES = 200 * 1024; // 200KB
const MAX_AVATAR_BYTES = 300 * 1024; // 300KB
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function AvatarUploadPanel() {
  const { profile, user, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');

    if (!AVATAR_TYPES.includes(file.type)) {
      setError('Please use a PNG, JPG, or WEBP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(`File is too large (${(file.size / 1024).toFixed(0)}KB). Max size is 300KB.`);
      return;
    }

    setUploading(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const avatarPath = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(avatarPath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
    const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: bustedUrl })
      .eq('id', profile.id);

    setUploading(false);
    if (profileError) { setError(profileError.message); return; }
    refreshProfile();
  };

  return (
    <div className="avatar-upload-row">
      <div className="avatar-upload-preview">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="Your avatar" />
        ) : (
          <span className="avatar-upload-fallback">{profile?.full_name?.[0]?.toUpperCase() || '👤'}</span>
        )}
      </div>
      <div>
        <label className="btn-secondary sm" style={{ cursor: 'pointer' }}>
          {uploading ? 'Uploading…' : profile?.avatar_url ? 'Change photo' : 'Add photo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
        </label>
        <div className="muted small" style={{ marginTop: 4 }}>PNG, JPG, or WEBP · max 300KB</div>
        {error && <div className="error-box" style={{ marginTop: 6 }}>{error}</div>}
      </div>
    </div>
  );
}

function LogoUploadPanel() {
  const { profile, user, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const logoPath = `${user.id}/logo.png`;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setError('');
    setSuccess('');

    if (file.type !== 'image/png') {
      setError('Only PNG files are allowed.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`File is too large (${(file.size / 1024).toFixed(0)}KB). Max size is 200KB.`);
      return;
    }

    setUploading(true);
    // upsert: true overwrites any existing file at this exact path, so
    // each user can only ever have one logo — a re-upload replaces it.
    const { error: uploadError } = await supabase.storage
      .from('prescription-logos')
      .upload(logoPath, file, { upsert: true, contentType: 'image/png' });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('prescription-logos').getPublicUrl(logoPath);
    // Cache-bust so the browser doesn't keep showing a stale cached logo
    // after a replace.
    const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ prescription_logo_url: bustedUrl })
      .eq('id', profile.id);

    setUploading(false);
    if (profileError) { setError(profileError.message); return; }
    setSuccess('Logo uploaded.');
    refreshProfile();
  };

  const removeLogo = async () => {
    if (!confirm('Remove your prescription logo?')) return;
    setError('');
    setSuccess('');
    await supabase.storage.from('prescription-logos').remove([logoPath]);
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ prescription_logo_url: null })
      .eq('id', profile.id);
    if (profileError) { setError(profileError.message); return; }
    setSuccess('Logo removed.');
    refreshProfile();
  };

  return (
    <div className="panel">
      <h2>Prescription Logo</h2>
      <p className="muted small">
        Appears as a faint watermark on your generated prescriptions. PNG only, max 200KB.
      </p>

      {profile?.prescription_logo_url && (
        <div className="logo-preview-box">
          <img src={profile.prescription_logo_url} alt="Your prescription logo" />
        </div>
      )}

      {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}
      {success && <div className="ok-box" style={{ marginTop: 10 }}>{success}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <label className="btn-secondary" style={{ cursor: 'pointer' }}>
          {uploading ? 'Uploading…' : profile?.prescription_logo_url ? 'Replace logo' : 'Upload logo'}
          <input type="file" accept="image/png" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
        </label>
        {profile?.prescription_logo_url && (
          <button className="btn-danger sm" onClick={removeLogo}>Delete</button>
        )}
      </div>
    </div>
  );
}

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

  return (
    <>
      <div className="panel">
        <h2>My Profile</h2>
        <p className="muted small">
          This information auto-fills the prescription generator's doctor details (left side of the pad).
        </p>

        <AvatarUploadPanel />

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
            <input value={form.mobileNumber} onChange={update('mobileNumber')} inputMode="numeric" maxLength={11} placeholder="01700000000" />
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
            <textarea value={chamberForm.chamberAddress} onChange={updateChamber('chamberAddress')} rows={2} placeholder="e.g. Dhaka, Bangladesh" />
          </label>
          <label>
            <span>Chamber mobile</span>
            <input value={chamberForm.chamberMobile} onChange={updateChamber('chamberMobile')} placeholder="e.g. 01700000000" />
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

      <LogoUploadPanel />
    </>
  );
}
