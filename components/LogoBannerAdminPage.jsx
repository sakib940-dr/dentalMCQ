import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function LogoUpload({ logoUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) { setError('PNG, JPG, WEBP বা SVG দিন।'); return; }
    if (file.size > 500 * 1024) { setError('ছবিটা বেশি বড় (সর্বোচ্চ 500KB)।'); return; }
    setUploading(true);
    setError('');
    const ext = file.name.split('.').pop();
    const path = `logo/site-logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('site-media').upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setUploading(false); setError(uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('site-media').getPublicUrl(path);
    const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from('app_settings').upsert({ key: 'site_logo_url', value: bustedUrl, updated_at: new Date().toISOString() });
    setUploading(false);
    onUploaded(bustedUrl);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: 44 }} />}
      <label className="btn-secondary sm" style={{ cursor: 'pointer' }}>
        {uploading ? 'আপলোড হচ্ছে…' : logoUrl ? 'লোগো বদলান' : 'লোগো আপলোড করুন'}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
      </label>
      {error && <div className="error-box">{error}</div>}
    </div>
  );
}

export default function LogoBannerAdminPage() {
  const [logoUrl, setLogoUrl] = useState(null);
  const [banner, setBanner] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('app_settings').select('key, value').in('key', ['site_logo_url', 'site_banner', 'site_notice']);
    const map = {};
    (data || []).forEach((r) => { map[r.key] = r.value; });
    setLogoUrl(map.site_logo_url || null);
    setBanner(map.site_banner || { enabled: false, title: '', subtitle: '', image_url: '', link: '' });
    setNotice(map.site_notice || { enabled: false, text: '', link: '' });
  };
  useEffect(() => { load(); }, []);

  const saveBanner = async (next) => {
    setBanner(next);
    setSaving(true);
    setSaved(false);
    await supabase.from('app_settings').upsert({ key: 'site_banner', value: next, updated_at: new Date().toISOString() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveNotice = async (next) => {
    setNotice(next);
    setSaving(true);
    setSaved(false);
    await supabase.from('app_settings').upsert({ key: 'site_notice', value: next, updated_at: new Date().toISOString() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (banner === null || notice === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>লোগো, ব্যানার ও নোটিস</h2>
      <p className="muted small">এগুলো ল্যান্ডিং পেজে (লগইন করার আগে) সব ভিজিটর দেখতে পাবেন।</p>

      <div style={{ marginTop: 14 }}>
        <div className="compact-field-heading" style={{ marginTop: 0 }}>সাইট লোগো</div>
        <LogoUpload logoUrl={logoUrl} onUploaded={setLogoUrl} />
      </div>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--card-border)' }} />

      <div className="compact-field-heading" style={{ marginTop: 0 }}>হোমপেজ ব্যানার</div>
      <div className="feature-toggle-row">
        <span>ব্যানার চালু আছে?</span>
        <label className="mini-toggle">
          <input type="checkbox" checked={banner.enabled} onChange={(e) => saveBanner({ ...banner, enabled: e.target.checked })} />
          <span>{banner.enabled ? 'On' : 'Off'}</span>
        </label>
      </div>
      <div className="exam-form-fields" style={{ marginTop: 8 }}>
        <label>
          <span>টাইটেল</span>
          <input value={banner.title} onChange={(e) => setBanner({ ...banner, title: e.target.value })} onBlur={() => saveBanner(banner)} placeholder="যেমন: নতুন ব্যাচ শুরু হচ্ছে!" />
        </label>
        <label>
          <span>সাবটাইটেল (ঐচ্ছিক)</span>
          <input value={banner.subtitle} onChange={(e) => setBanner({ ...banner, subtitle: e.target.value })} onBlur={() => saveBanner(banner)} />
        </label>
        <label>
          <span>লিংক (ঐচ্ছিক, ক্লিক করলে কোথায় যাবে)</span>
          <input value={banner.link} onChange={(e) => setBanner({ ...banner, link: e.target.value })} onBlur={() => saveBanner(banner)} placeholder="/register" />
        </label>
      </div>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--card-border)' }} />

      <div className="compact-field-heading" style={{ marginTop: 0 }}>সাইট-ওয়াইড নোটিস বার</div>
      <div className="feature-toggle-row">
        <span>নোটিস বার চালু আছে?</span>
        <label className="mini-toggle">
          <input type="checkbox" checked={notice.enabled} onChange={(e) => saveNotice({ ...notice, enabled: e.target.checked })} />
          <span>{notice.enabled ? 'On' : 'Off'}</span>
        </label>
      </div>
      <div className="exam-form-fields" style={{ marginTop: 8 }}>
        <label>
          <span>নোটিসের লেখা</span>
          <input value={notice.text} onChange={(e) => setNotice({ ...notice, text: e.target.value })} onBlur={() => saveNotice(notice)} placeholder="যেমন: 🎉 ঈদ অফার — ২০% ছাড়!" />
        </label>
        <label>
          <span>লিংক (ঐচ্ছিক)</span>
          <input value={notice.link} onChange={(e) => setNotice({ ...notice, link: e.target.value })} onBlur={() => saveNotice(notice)} />
        </label>
      </div>

      {saving && <p className="muted small" style={{ marginTop: 8 }}>সেভ হচ্ছে…</p>}
      {saved && !saving && <p className="muted small" style={{ marginTop: 8, color: 'var(--green)' }}>সেভ হয়েছে ✓</p>}
    </div>
  );
}
