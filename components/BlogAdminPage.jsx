import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function slugify(s) {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function CoverImageUpload({ postId, coverUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('PNG, JPG বা WEBP ছবি দিন।'); return; }
    if (file.size > 1024 * 1024) { setError('ছবিটা বেশি বড় (সর্বোচ্চ 1MB)।'); return; }
    setUploading(true);
    setError('');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `blog/${postId}/cover.${ext}`;
    const { error: uploadError } = await supabase.storage.from('site-media').upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setUploading(false); setError(uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('site-media').getPublicUrl(path);
    const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from('blog_posts').update({ cover_image_url: bustedUrl }).eq('id', postId);
    setUploading(false);
    onUploaded(bustedUrl);
  };

  return (
    <div>
      {coverUrl && <img src={coverUrl} alt="" style={{ width: 160, borderRadius: 8, display: 'block', marginBottom: 8 }} />}
      <label className="btn-secondary sm" style={{ cursor: 'pointer' }}>
        {uploading ? 'আপলোড হচ্ছে…' : 'কভার ছবি আপলোড করুন'}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
      </label>
      {error && <div className="error-box" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}

function BlogForm({ initial, onSaved, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt || '');
  const [content, setContent] = useState(initial?.content || '');
  const [isPublished, setIsPublished] = useState(initial?.is_published || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedPost, setSavedPost] = useState(initial || null);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !content.trim()) { setError('টাইটেল ও কনটেন্ট দুটোই লাগবে।'); return; }
    const finalSlug = (slug.trim() ? slugify(slug) : slugify(title));
    if (!finalSlug) { setError('একটা valid slug দরকার।'); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt.trim() || null,
      content: content.trim(),
      is_published: isPublished,
      published_at: isPublished ? (savedPost?.published_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };
    if (savedPost?.id) {
      const { error: updateError } = await supabase.from('blog_posts').update(payload).eq('id', savedPost.id);
      setSaving(false);
      if (updateError) { setError(updateError.message); return; }
      setSavedPost((p) => ({ ...p, ...payload }));
      onSaved();
    } else {
      const { data: inserted, error: insertError } = await supabase.from('blog_posts').insert(payload).select().single();
      setSaving(false);
      if (insertError) { setError(insertError.message); return; }
      setSavedPost(inserted); // stay open so cover image can be uploaded
    }
  };

  return (
    <form className="exam-form-fields" onSubmit={save} style={{ marginTop: 12 }}>
      <label>
        <span>টাইটেল</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        <span>URL slug (ফাঁকা রাখলে টাইটেল থেকে অটো তৈরি হবে)</span>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-first-post" />
      </label>
      <label>
        <span>সংক্ষিপ্ত বিবরণ (লিস্টে দেখাবে)</span>
        <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
      </label>
      <label>
        <span>পুরো লেখা</span>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} />
      </label>
      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} style={{ width: 'auto' }} />
        <span>Published (পাবলিকলি দেখা যাবে)</span>
      </label>

      {savedPost?.id && (
        <CoverImageUpload postId={savedPost.id} coverUrl={savedPost.cover_image_url} onUploaded={(url) => setSavedPost((p) => ({ ...p, cover_image_url: url }))} />
      )}

      {error && <div className="error-box">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary sm" disabled={saving}>{saving ? 'সেভ হচ্ছে…' : savedPost?.id ? 'আপডেট' : 'তৈরি করুন'}</button>
        <button type="button" className="btn-secondary sm" onClick={onSaved}>{savedPost?.id ? 'শেষ, বন্ধ করুন' : 'বাতিল'}</button>
      </div>
    </form>
  );
}

export default function BlogAdminPage() {
  const [posts, setPosts] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (p) => {
    if (!confirm(`"${p.title}" পোস্টটা মুছে ফেলতে চান?`)) return;
    await supabase.from('blog_posts').delete().eq('id', p.id);
    load();
  };

  if (posts === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>Blog</h2>
      <p className="muted small">ব্লগ পোস্ট লিখুন ও পাবলিশ করুন — /blog পেজে দেখাবে।</p>

      {!adding && <button className="btn-primary sm" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>+ নতুন পোস্ট লিখুন</button>}
      {adding && <BlogForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}

      <div className="recent-list" style={{ marginTop: 16 }}>
        {posts.map((p) => (
          <div key={p.id}>
            {editingId === p.id ? (
              <BlogForm initial={p} onSaved={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
            ) : (
              <div className="recent-row">
                <div>
                  <span className="recent-name">{p.title}</span>
                  <span className={`status-pill ${p.is_published ? 'status-live' : 'status-archived'}`} style={{ marginLeft: 8 }}>
                    {p.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-secondary sm" onClick={() => setEditingId(p.id)}>এডিট</button>
                  <button className="btn-danger sm" onClick={() => remove(p)}>ডিলিট</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {posts.length === 0 && <p className="muted small">এখনো কোনো পোস্ট লেখা হয়নি।</p>}
    </div>
  );
}
