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

export default function ExamineeDashboard() {
  const { user } = useAuth();
  const unreadMessages = useUnreadMessageCount(user.id);

  const navItems = [
    { to: '/dashboard', label: 'Home', icon: '🏠', end: true, quick: true, group: 'Study' },
    { to: '/dashboard/exams', label: 'Exams', icon: '📝', quick: true, group: 'Study' },
    { to: '/dashboard/package', label: 'Package', icon: '📦', group: 'Account' },
    { to: '/dashboard/notices', label: 'Notice Board', icon: '📢', group: 'Community' },
    { to: '/dashboard/chat', label: 'Messages', icon: '💬', quick: true, badge: unreadMessages, group: 'Community' },
    { to: '/dashboard/profile', label: 'My Profile', icon: '👤', group: 'Account' },
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
    <DashboardLayout title="Examinee" navItems={navItems} bottomNavItems={bottomNavItems}>
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
        <Route path="notices" element={<StudentNoticeBoard />} />
        <Route path="chat" element={<StudentChatPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Routes>
    </DashboardLayout>
  );
}
