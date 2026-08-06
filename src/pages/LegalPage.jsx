import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import BrandWordmark from '../components/BrandWordmark';

export default function LegalPage({ pageKey }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);

  useEffect(() => {
    supabase.from('legal_pages').select('*').eq('key', pageKey).maybeSingle().then(({ data }) => setPage(data));
  }, [pageKey]);

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
          {page === null && <p className="muted small">Loading…</p>}
          {page && (
            <>
              <h2>{page.title}</h2>
              <p className="muted small">সর্বশেষ হালনাগাদ: {new Date(page.updated_at).toLocaleDateString('bn-BD')}</p>
              <div className="legal-page-body">
                {page.content.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
