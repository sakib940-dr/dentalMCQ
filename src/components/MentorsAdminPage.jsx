import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const MAX_PHOTO_BYTES = 300 * 1024; // 300KB
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function MentorPhotoUpload({ mentorId, photoUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');

    if (!PHOTO_TYPES.includes(file.type)) { setError('PNG, JPG বা WEBP ছবি দিন।'); return; }
    if (file.size > MAX_PHOTO_BYTES) { setError(`ছবিটা বেশি বড় (${(file.size / 1024).toFixed(0)}KB)। সর্বোচ্চ 300KB।`); return; }

    setUploading(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${mentorId}/photo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('mentor-photos')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) { setUploading(false); setError(uploadError.message); return; }

    const { data: urlData } = supabase.storage.from('mentor-photos').getPublicUrl(path);
    const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    const { error: saveError } = await supabase.from('mentors').update({ photo_url: bustedUrl }).eq('id', mentorId);
    setUploading(false);
    if (saveError) { setError(saveError.message); return; }
    onUploaded(bustedUrl);
  };

  return (
    <div className="avatar-upload-row">
      <div className="avatar-upload-preview">
        {photoUrl ? <img src={photoUrl} alt="" /> : <span style={{ fontSize: 22 }}>👤</span>}
      </div>
      <label className="btn-secondary sm" style={{ cursor: 'pointer' }}>
        {uploading ? 'আপলোড হচ্ছে…' : 'ছবি আপলোড করুন'}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
      </label>
      {error && <div className="error-box" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}

function MentorForm({ initial, onSaved, onCancel }) {
  const [fullName, setFullName] = useState(initial?.full_name || '');
  const [degree, setDegree] = useState(initial?.degree || '');
  const [institute, setInstitute] = useState(initial?.institute || '');
  const [bio, setBio] = useState(initial?.bio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMentor, setSavedMentor] = useState(initial || null);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError('নাম দেওয়া আবশ্যক।'); return; }
    setSaving(true);
    const payload = {
      full_name: fullName.trim(),
      degree: degree.trim() || null,
      institute: institute.trim() || null,
      bio: bio.trim() || null,
    };
    if (savedMentor?.id) {
      const { error: updateError } = await supabase.from('mentors').update(payload).eq('id', savedMentor.id);
      setSaving(false);
      if (updateError) { setError(updateError.message); return; }
      onSaved();
    } else {
      const { data: countData } = await supabase.from('mentors').select('display_order').order('display_order', { ascending: false }).limit(1);
      const nextOrder = countData && countData.length > 0 ? countData[0].display_order + 10 : 10;
      const { data: inserted, error: insertError } = await supabase
        .from('mentors')
        .insert({ ...payload, display_order: nextOrder })
        .select()
        .single();
      setSaving(false);
      if (insertError) { setError(insertError.message); return; }
      // Keep the form open, now in "edit" mode, so the photo can be uploaded
      // right after creating the record (upload needs the mentor's id).
      setSavedMentor(inserted);
    }
  };

  return (
    <form className="exam-form-fields" onSubmit={save} style={{ marginTop: 12 }}>
      <label>
        <span>নাম *</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. আব্দুল করিম" />
      </label>
      <label>
        <span>ডিগ্রি</span>
        <input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="BDS, FCPS (Oral & Maxillofacial Surgery)" />
      </label>
      <label>
        <span>মেডিকেল/ডেন্টাল কলেজের নাম</span>
        <input value={institute} onChange={(e) => setInstitute(e.target.value)} placeholder="Dhaka Dental College" />
      </label>
      <label>
        <span>সংক্ষিপ্ত পরিচিতি (ঐচ্ছিক)</span>
        <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="এক লাইনে অভিজ্ঞতা/বিশেষত্ব" />
      </label>

      {savedMentor?.id && (
        <div>
          <span className="compact-field-label" style={{ display: 'block', marginBottom: 6 }}>ছবি</span>
          <MentorPhotoUpload
            mentorId={savedMentor.id}
            photoUrl={savedMentor.photo_url}
            onUploaded={(url) => setSavedMentor((m) => ({ ...m, photo_url: url }))}
          />
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="submit" className="btn-primary sm" disabled={saving}>
          {saving ? 'সেভ হচ্ছে…' : savedMentor?.id ? 'আপডেট' : 'তৈরি করুন'}
        </button>
        <button type="button" className="btn-secondary sm" onClick={onSaved}>
          {savedMentor?.id ? 'শেষ, বন্ধ করুন' : 'বাতিল'}
        </button>
      </div>
    </form>
  );
}

export default function MentorsAdminPage() {
  const [mentors, setMentors] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const { data } = await supabase.from('mentors').select('*').order('display_order');
    setMentors(data || []);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (m) => {
    setMentors((ms) => ms.map((x) => (x.id === m.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from('mentors').update({ is_active: !m.is_active }).eq('id', m.id);
  };

  const remove = async (m) => {
    if (!confirm(`"${m.full_name}"-কে মেন্টর তালিকা থেকে বাদ দিতে চান?`)) return;
    await supabase.from('mentors').delete().eq('id', m.id);
    load();
  };

  const move = async (index, dir) => {
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= mentors.length) return;
    const a = mentors[index];
    const b = mentors[swapWith];
    await Promise.all([
      supabase.from('mentors').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('mentors').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    load();
  };

  if (mentors === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>মেন্টর / ফ্যাকাল্টি</h2>
      <p className="muted small">
        ল্যান্ডিং পেজে যেসব মেন্টরের ছবি, ডিগ্রি ও কলেজের নাম দেখাতে চান — এখান থেকে যোগ/এডিট করুন।
        এটাই নতুন ভিজিটরদের বিশ্বাস তৈরির অন্যতম বড় জায়গা।
      </p>

      {!adding && (
        <button className="btn-primary sm" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>+ নতুন মেন্টর যোগ করুন</button>
      )}
      {adding && (
        <MentorForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
      )}

      <div className="recent-list" style={{ marginTop: 16 }}>
        {mentors.map((m, i) => (
          <div key={m.id}>
            {editingId === m.id ? (
              <MentorForm initial={m} onSaved={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
            ) : (
              <div className="recent-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="avatar-upload-preview" style={{ width: 36, height: 36 }}>
                    {m.photo_url ? <img src={m.photo_url} alt="" /> : <span>👤</span>}
                  </div>
                  <div>
                    <span className="recent-name">{m.full_name}</span>
                    <div className="muted small">{[m.degree, m.institute].filter(Boolean).join(' · ') || 'ডিগ্রি/কলেজ যোগ করা হয়নি'}</div>
                  </div>
                  {!m.is_active && <span className="status-pill status-archived">Hidden</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-secondary sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn-secondary sm" onClick={() => move(i, 1)} disabled={i === mentors.length - 1}>↓</button>
                  <button className="btn-secondary sm" onClick={() => setEditingId(m.id)}>এডিট</button>
                  <button className="btn-secondary sm" onClick={() => toggleActive(m)}>{m.is_active ? 'লুকান' : 'দেখান'}</button>
                  <button className="btn-danger sm" onClick={() => remove(m)}>ডিলিট</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {mentors.length === 0 && <p className="muted small">এখনো কোনো মেন্টর যোগ করা হয়নি।</p>}
    </div>
  );
}
