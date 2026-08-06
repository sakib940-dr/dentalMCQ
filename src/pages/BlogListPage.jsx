import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import BrandWordmark from '../components/BrandWordmark';

export default function BlogListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    supabase.from('blog_posts').select('id, slug, title, excerpt, cover_image_url, published_at')
      .eq('is_published', true).order('published_at', { ascending: false })
      .then(({ data }) => setPosts(data || []));
  }, []);

  return (
    <div className="public-page">
      <div className="public-page-inner">
        <div className="public-page-header">
          <BrandWordmark />
          <button className="btn-secondary sm" onClick={() => navigate(user ? '/' : '/login')}>
            {user ? '← ড্যাশবোর্ডে ফিরুন' : '← লগইনে ফিরুন'}
          </button>
        </div>

        <div className="panel">
          <h2>ব্লগ</h2>
          {posts === null && <p className="muted small">Loading…</p>}
          {posts && posts.length === 0 && <p className="muted small">এখনো কোনো পোস্ট নেই।</p>}
          <div className="blog-list">
            {posts?.map((p) => (
              <button key={p.id} className="blog-list-card" onClick={() => navigate(`/blog/${p.slug}`)}>
                {p.cover_image_url && <img src={p.cover_image_url} alt="" className="blog-list-cover" />}
                <div>
                  <div className="blog-list-title">{p.title}</div>
                  {p.excerpt && <div className="muted small">{p.excerpt}</div>}
                  {p.published_at && <div className="muted small" style={{ marginTop: 4 }}>{new Date(p.published_at).toLocaleDateString('bn-BD')}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
