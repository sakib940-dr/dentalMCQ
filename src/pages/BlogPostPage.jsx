import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import BrandWordmark from '../components/BrandWordmark';

export default function BlogPostPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase.from('blog_posts').select('*').eq('slug', slug).eq('is_published', true).maybeSingle()
      .then(({ data }) => { if (data) setPost(data); else setNotFound(true); });
  }, [slug]);

  return (
    <div className="public-page">
      <div className="public-page-inner">
        <div className="public-page-header">
          <BrandWordmark />
          <button className="btn-secondary sm" onClick={() => navigate('/blog')}>← ব্লগে ফিরুন</button>
        </div>

        <div className="panel">
          {notFound && <p className="muted">এই পোস্টটা পাওয়া যায়নি।</p>}
          {!notFound && post === null && <p className="muted small">Loading…</p>}
          {post && (
            <>
              {post.cover_image_url && <img src={post.cover_image_url} alt="" className="blog-post-cover" />}
              <h2>{post.title}</h2>
              {post.published_at && <p className="muted small">{new Date(post.published_at).toLocaleDateString('bn-BD')}</p>}
              <div className="legal-page-body">
                {post.content.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
