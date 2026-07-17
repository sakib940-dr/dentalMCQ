import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import BrandWordmark from '../components/BrandWordmark';

export default function HelpCenterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState(null);

  useEffect(() => {
    supabase
      .from('help_center_sections')
      .select('*')
      .order('display_order')
      .then(({ data }) => setSections(data || []));
  }, []);

  return (
    <div className="public-page">
      <div className="public-page-inner">
        <div className="public-page-header">
          <BrandWordmark />
          {user ? (
            <button className="btn-secondary sm" onClick={() => navigate('/')}>← ড্যাশবোর্ডে ফিরুন</button>
          ) : (
            <button className="btn-secondary sm" onClick={() => navigate('/login')}>← লগইনে ফিরুন</button>
          )}
        </div>

        <div className="panel">
          <h2>হেল্প সেন্টার</h2>
          <p className="muted small">যেকোনো বিষয়ে ধাপে ধাপে সাহায্য — নিচের যেকোনো অংশে চাপুন খুলতে।</p>

          {sections === null && <p className="muted small">Loading…</p>}
          {sections && sections.length === 0 && <p className="muted small">এখনো কোনো হেল্প কনটেন্ট যোগ করা হয়নি।</p>}

          <div className="faq-accordion">
            {sections?.map((s) => (
              <details key={s.id} className="faq-item">
                <summary className="faq-item-title">{s.title}</summary>
                <div className="faq-item-body">
                  {s.body.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="panel">
          <p className="muted small">এখানে সমাধান না পেলে <a href="/dashboard/contact">Contact Us</a> পেজ থেকে যোগাযোগ করুন।</p>
        </div>
      </div>
    </div>
  );
}
