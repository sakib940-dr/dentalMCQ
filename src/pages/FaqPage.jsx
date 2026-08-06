import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import BrandWordmark from '../components/BrandWordmark';

export default function FaqPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState(null);

  useEffect(() => {
    supabase.from('faqs').select('*').eq('is_active', true).order('display_order').then(({ data }) => setFaqs(data || []));
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
          <h2>সাধারণ জিজ্ঞাসা (FAQ)</h2>
          {faqs === null && <p className="muted small">Loading…</p>}
          {faqs && faqs.length === 0 && <p className="muted small">এখনো কোনো FAQ যোগ করা হয়নি।</p>}
          <div className="faq-accordion">
            {faqs?.map((f) => (
              <details key={f.id} className="faq-item">
                <summary className="faq-item-title">{f.question}</summary>
                <div className="faq-item-body"><p>{f.answer}</p></div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
