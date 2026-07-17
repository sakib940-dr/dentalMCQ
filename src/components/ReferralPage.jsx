import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function ReferralPage() {
  const { profile } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from('my_referrals').select('*').order('created_at', { ascending: false }).then(({ data }) => setReferrals(data || []));
  }, []);

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
    <div className="panel">
      <h2>Referral</h2>
      <p className="muted small">
        Share your link — when a friend registers through it and gets their payment approved,
        you get 15 extra days of access as a reward.
      </p>
      <div className="referral-box">
        <input readOnly value={referralLink} className="referral-input" />
        <button className="btn-primary" onClick={copyReferral}>{copied ? 'Copied!' : 'Copy link'}</button>
      </div>

      {referrals.length > 0 && (
        <div className="recent-list" style={{ marginTop: 14 }}>
          <div className="compact-field-heading" style={{ marginTop: 0 }}>People you referred ({referrals.length})</div>
          {referrals.map((r) => (
            <div key={r.id} className="recent-row">
              <span className="recent-name">{r.full_name}</span>
              <span className="muted small">{new Date(r.created_at).toLocaleDateString('en-GB')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
