import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BrandWordmark from '../components/BrandWordmark';

const FEATURES = [
  { icon: '📝', title: 'লাইভ MCQ এক্সাম', desc: 'BDS/FCPS/BCS সিলেবাস অনুযায়ী নির্ধারিত সময়ে লাইভ এক্সাম দিন, তাৎক্ষণিক রেজাল্ট পান।' },
  { icon: '📖', title: 'আনলিমিটেড প্র্যাকটিস', desc: 'বিষয়/অধ্যায় অনুযায়ী যত খুশি প্র্যাকটিস করুন, ভুল প্রশ্নগুলো আবার রিভিশন দিন।' },
  { icon: '📊', title: 'রেজাল্ট ও মেরিট লিস্ট', desc: 'নিজের উত্তরপত্র ও পুরো ব্যাচের র‍্যাংকিং দেখুন এক জায়গায়।' },
  { icon: '🏥', title: 'ডেন্টাল চেম্বার টুলস', desc: 'রোগীর তালিকা, অ্যাপয়েন্টমেন্ট ও প্রেসক্রিপশন — একই অ্যাকাউন্টে ম্যানেজ করুন।' },
];

const STEPS = [
  { n: '১', title: 'রেজিস্ট্রেশন করুন', desc: 'শুধু ইমেইল ও একটা পাসওয়ার্ড দিয়ে ফ্রি অ্যাকাউন্ট খুলুন।' },
  { n: '২', title: 'বিষয় বেছে নিন', desc: 'আপনার প্রয়োজনীয় ক্যাটাগরি/সিলেবাস সিলেক্ট করুন।' },
  { n: '৩', title: 'ফ্রি প্র্যাকটিস দিন', desc: 'শুরুতেই ফ্রি প্র্যাকটিস প্রশ্ন দিয়ে অ্যাপের মান যাচাই করুন।' },
  { n: '৪', title: 'প্যাকেজ আনলক করুন', desc: 'সন্তুষ্ট হলে প্যাকেজ কিনে লাইভ এক্সাম ও প্রিমিয়াম কনটেন্ট আনলক করুন।' },
];

function MentorCard({ m }) {
  return (
    <div className="mentor-card">
      <div className="mentor-card-photo">
        {m.photo_url ? <img src={m.photo_url} alt={m.full_name} /> : <span className="mentor-card-photo-fallback">👤</span>}
      </div>
      <div className="mentor-card-name">{m.full_name}</div>
      {m.degree && <div className="mentor-card-degree">{m.degree}</div>}
      {m.institute && <div className="mentor-card-institute">{m.institute}</div>}
      {m.bio && <div className="mentor-card-bio">{m.bio}</div>}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [mentors, setMentors] = useState(null);

  useEffect(() => {
    supabase
      .from('mentors')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => setMentors(data || []));
  }, []);

  return (
    <div className="landing-page">
      {/* ---------- Header ---------- */}
      <div className="landing-header">
        <BrandWordmark />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary sm" onClick={() => navigate('/login')}>লগইন</button>
          <button className="btn-primary sm" onClick={() => navigate('/register')}>ফ্রি রেজিস্ট্রেশন</button>
        </div>
      </div>

      {/* ---------- Hero ---------- */}
      <div className="landing-hero">
        <h1 className="landing-hero-title">বাংলাদেশের ডেন্টাল স্টুডেন্টদের জন্য<br />সবচেয়ে বড় MCQ প্র্যাকটিস প্ল্যাটফর্ম</h1>
        <p className="landing-hero-sub">
          লাইভ এক্সাম, বিষয়ভিত্তিক প্র্যাকটিস, মেরিট লিস্ট ও ডেন্টাল চেম্বার ম্যানেজমেন্ট — সব একসাথে, একটাই অ্যাকাউন্টে।
        </p>
        <div className="landing-hero-actions">
          <button className="btn-primary" onClick={() => navigate('/register')}>এখনই ফ্রি রেজিস্ট্রেশন করুন</button>
          <button className="btn-secondary" onClick={() => navigate('/login')}>আগে থেকে অ্যাকাউন্ট আছে? লগইন</button>
        </div>
      </div>

      {/* ---------- Features ---------- */}
      <div className="landing-section">
        <h2 className="landing-section-title">এই অ্যাপে যা যা পাবেন</h2>
        <div className="landing-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <div className="landing-feature-title">{f.title}</div>
              <div className="muted small">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Mentors ---------- */}
      {mentors && mentors.length > 0 && (
        <div className="landing-section">
          <h2 className="landing-section-title">আমাদের মেন্টর প্যানেল</h2>
          <p className="muted small" style={{ textAlign: 'center', marginTop: -8 }}>
            অভিজ্ঞ ডেন্টাল সার্জন ও শিক্ষকদের তত্ত্বাবধানে তৈরি কনটেন্ট
          </p>
          <div className="landing-mentor-grid">
            {mentors.map((m) => <MentorCard key={m.id} m={m} />)}
          </div>
        </div>
      )}

      {/* ---------- How it works ---------- */}
      <div className="landing-section">
        <h2 className="landing-section-title">কীভাবে শুরু করবেন</h2>
        <div className="landing-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="landing-step">
              <div className="landing-step-num">{s.n}</div>
              <div>
                <div className="landing-step-title">{s.title}</div>
                <div className="muted small">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Trust / closing CTA ---------- */}
      <div className="landing-section">
        <div className="panel" style={{ textAlign: 'center' }}>
          <h2 style={{ marginTop: 0 }}>আজই শুরু করুন, সম্পূর্ণ ফ্রি</h2>
          <p className="muted small">রেজিস্ট্রেশন করতে কোনো টাকা লাগে না — প্রিমিয়াম ফিচার শুধু প্রয়োজন হলে আনলক করবেন।</p>
          <button className="btn-primary" onClick={() => navigate('/register')}>ফ্রি রেজিস্ট্রেশন করুন</button>
        </div>
      </div>

      {/* ---------- Footer ---------- */}
      <div className="landing-footer">
        <span>যোগাযোগ: <a href="mailto:dentalmcqbd@gmail.com">dentalmcqbd@gmail.com</a></span>
        <span> · </span>
        <a href="/help">হেল্প সেন্টার</a>
      </div>
    </div>
  );
}
