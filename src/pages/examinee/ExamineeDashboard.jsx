import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import StudentDashboardHome from '../../components/StudentDashboardHome';
import CategoryExamsPage from '../../components/CategoryExamsPage';
import BookmarksPage from '../../components/BookmarksPage';
import QuestionBankPracticePage from '../../components/QuestionBankPracticePage';
import PracticeSessionRoute from '../../components/PracticeSessionRoute';
import ChamberHome from '../../components/ChamberHome';
import PatientsListPage from '../../components/PatientsListPage';
import PatientProfilePage from '../../components/PatientProfilePage';
import PrescriptionHistoryPage from '../../components/PrescriptionHistoryPage';
import StudentChatPage from '../../components/StudentChatPage';
import StudentNoticeBoard from '../../components/StudentNoticeBoard';
import MyProfilePage from '../../components/MyProfilePage';
import PackagePage from '../../components/PackagePage';
import SmartSearchPage from '../../components/SmartSearchPage';
import FeedbackPage from '../../components/FeedbackPage';
import ContactUsPage from '../../components/ContactUsPage';
import SupportHubPage from '../../components/SupportHubPage';
import SettingsPage from '../../components/SettingsPage';
import ReferralPage from '../../components/ReferralPage';
import { useAppSetting, LockedFeature } from '../../components/FeatureLock';
import { useAuth } from '../../contexts/AuthContext';

// Lazy-loaded: PrescriptionPage pulls in jsPDF plus a ~600KB embedded
// Bengali font, both only needed by the (relatively rare) act of
// generating a prescription — no reason to ship that to every student
// just to browse exams.
const PrescriptionPage = lazy(() => import('../../components/PrescriptionPage'));

function LiveExamGate({ children }) {
  const { profile } = useAuth();
  const { value: liveExamOn, loading } = useAppSetting('live_exam_enabled_global', true);
  if (loading) return null;
  if (!liveExamOn) return <LockedFeature />;
  if (profile && profile.live_exam_enabled === false) return <LockedFeature />;
  return children;
}

// Unread count sourced from the same `notifications` table the bell icon
// already reads from — one definition of "unread", not two disagreeing ones.
function useUnreadMessageCount(userId) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { count: c } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'chat_message')
        .eq('is_read', false);
      if (!cancelled) setCount(c || 0);
    }
    load();
    const channel = supabase
      .channel(`unread_msgs_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);
  return count;
}

// Same "soonest-expiring active grant" logic as StudentDashboardHome's
// SubscriptionStrip — the drawer header needs a compact version of the
// same summary, not a second definition of "what counts as active."
function useActiveSubscriptionSummary(userId) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: grants }, { data: categories }] = await Promise.all([
        supabase.from('category_access_grants').select('category_id, resource_type, expires_at').eq('examinee_id', userId),
        supabase.from('categories').select('id, name'),
      ]);
      if (cancelled) return;
      const now = new Date();
      const active = (grants || [])
        .filter((g) => !g.expires_at || new Date(g.expires_at) > now)
        .sort((a, b) => {
          if (!a.expires_at) return 1;
          if (!b.expires_at) return -1;
          return new Date(a.expires_at) - new Date(b.expires_at);
        });
      if (active.length === 0) { setSummary(null); return; }
      const soonest = active[0];
      const name = soonest.resource_type === 'prescription'
        ? 'Prescription'
        : (categories || []).find((c) => c.id === soonest.category_id)?.name || 'Category';
      setSummary({ packageName: name, expiresAt: soonest.expires_at });
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);
  return summary;
}

export default function ExamineeDashboard() {
  const { user } = useAuth();
  const unreadMessages = useUnreadMessageCount(user.id);
  const subscriptionSummary = useActiveSubscriptionSummary(user.id);

  // Drawer now holds only secondary/less-used items — Home, Exams,
  // Chamber, Messages, and Profile all moved to the bottom nav bar.
  const navItems = [
    { to: '/dashboard/package', label: 'Package', icon: '📦', group: 'Account' },
    { to: '/dashboard/notices', label: 'Notice Board', icon: '📢', group: 'Account' },
    { to: '/help', label: 'Help', icon: '❓', group: 'Support' },
    { to: '/dashboard/contact', label: 'Contact', icon: '📞', group: 'Support' },
    { to: '/dashboard/referral', label: 'Referral', icon: '🎁', group: 'Support' },
    { to: '/dashboard/settings', label: 'Settings', icon: '⚙️', group: 'Support' },
    { to: '/dashboard/feedback', label: 'Feedback', icon: '📮', group: 'Support' },
  ];

  // Primary navigation for students lives in a bottom tab bar (standard
  // mobile-app pattern) instead of the top quick-bar the other three
  // roles use — passing this prop is what switches DashboardLayout into
  // that mode. The full navItems list above still populates the ☰
  // drawer for secondary items.
  const bottomNavItems = [
    { to: '/dashboard', label: 'Home', icon: '🏠', end: true },
    { to: '/dashboard/exams', label: 'Exams', icon: '📝' },
    { to: '/dashboard/chamber', label: 'Chamber', icon: '🏥' },
    { to: '/dashboard/chat', label: 'Messages', icon: '💬', badge: unreadMessages },
    { to: '/dashboard/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <DashboardLayout
      title="Examinee"
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      drawerProfile={subscriptionSummary}
      appVersion="v1.0"
    >
      <Routes>
        <Route index element={<StudentDashboardHome />} />
        <Route path="exams" element={<LiveExamGate><CategoryExamsPage /></LiveExamGate>} />
        <Route path="question-bank" element={<QuestionBankPracticePage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="search" element={<SmartSearchPage />} />
        <Route path="practice-session" element={<PracticeSessionRoute />} />
        <Route path="package" element={<PackagePage />} />
        <Route
          path="prescription"
          element={
            <Suspense fallback={<div className="panel"><p className="muted">Loading…</p></div>}>
              <PrescriptionPage />
            </Suspense>
          }
        />
        <Route path="chamber" element={<ChamberHome />} />
        <Route path="chamber/patients" element={<PatientsListPage />} />
        <Route path="chamber/patients/:id" element={<PatientProfilePage />} />
        <Route path="chamber/prescriptions" element={<PrescriptionHistoryPage />} />
        <Route path="support" element={<SupportHubPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="contact" element={<ContactUsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="referral" element={<ReferralPage />} />
        <Route path="notices" element={<StudentNoticeBoard />} />
        <Route path="chat" element={<StudentChatPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Routes>
    </DashboardLayout>
  );
}
