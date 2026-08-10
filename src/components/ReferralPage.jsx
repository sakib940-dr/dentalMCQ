import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useAppSetting } from './FeatureLock';
import { IconMessageCircle, IconSend } from '../lib/examineeIcons';

const SHARE_MESSAGE = 'DentalMCQ-এ ফ্রি রেজিস্ট্রেশন করুন — লাইভ এক্সাম, প্র্যাকটিস প্রশ্ন সব একসাথে:';

export default function ReferralPage() {
  const { profile } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);
  const { value: rewardEnabled, loading: rewardLoading } = useAppSetting('referral_reward_enabled', false);
  const { value: rewardDays } = useAppSetting('referral_reward_days', 15);

  useEffect(() => {
    supabase.from('my_referrals').select('*').order('created_at', { ascending: false }).then(({ data }) => setReferrals(data || []));
  }, []);

  const referralLink = profile?.referral_code
    ? `${window.location.origin}/register?ref=${profile.referral_code}`
    : '';

  const shareText = `${SHARE_MESSAGE} ${referralLink}`;

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  // Native share sheet — on phones this is what actually hands off to
  // WhatsApp/Messenger/etc. correctly (it opens whichever apps are
  // installed), instead of a hardcoded link that may not open the app.
  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url: referralLink });
        return true;
      }
    } catch {
      // user cancelled the share sheet — not an error
    }
    return false;
  };

  const shareToWhatsapp = async () => {
    if (await nativeShare()) return;
    // Fallback for desktop browsers without the native Share API —
    // wa.me opens WhatsApp Web/Desktop or prompts to install the app.
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  };

  const shareToMessenger = async () => {
    if (await nativeShare()) return;
    // Facebook's universal sharer (no app-id setup required) — opens the
    // Facebook share dialog, from where Messenger is also selectable.
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="panel">
      <h2>Referral</h2>

      {rewardLoading ? null : rewardEnabled ? (
        <p className="muted small">
          আপনার লিংক শেয়ার করুন — কেউ এই লিংকে রেজিস্ট্রেশন করে পেমেন্ট Approve করালে, আপনি পাবেন
          <b> {rewardDays} দিন</b> ফ্রি এক্সট্রা অ্যাক্সেস।
        </p>
      ) : (
        <p className="muted small">
          আপনার লিংক শেয়ার করুন বন্ধুদের সাথে। রেফারেল রিওয়ার্ড প্রোগ্রাম শীঘ্রই চালু হবে — চালু হলে এখানেই জানানো হবে।
        </p>
      )}

      <div className="referral-box">
        <input readOnly value={referralLink} className="referral-input" />
        <button className="btn-primary" onClick={copyReferral}>{copied ? 'Copied!' : 'Copy link'}</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn-secondary sm" onClick={shareToWhatsapp} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconMessageCircle size={15} /> WhatsApp-এ শেয়ার</button>
        <button className="btn-secondary sm" onClick={shareToMessenger} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconSend size={15} /> Messenger-এ শেয়ার</button>
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
