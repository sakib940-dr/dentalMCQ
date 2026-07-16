import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import StudentDashboardHome from '../../components/StudentDashboardHome';
import CategoryExamsPage from '../../components/CategoryExamsPage';
import BookmarksPage from '../../components/BookmarksPage';
import PracticeSessionRoute from '../../components/PracticeSessionRoute';
import StudentChatPage from '../../components/StudentChatPage';
import StudentNoticeBoard from '../../components/StudentNoticeBoard';
import MyProfilePage from '../../components/MyProfilePage';
import PackagePage from '../../components/PackagePage';
import { useAppSetting, LockedFeature } from '../../components/FeatureLock';
import { useAuth } from '../../contexts/AuthContext';

// Lazy-loaded: PrescriptionPage pulls in jsPDF plus a ~600KB embedded
// Bengali font, both only needed by the (relatively rare) act of
// generating a prescription — no reason to ship that to every student
// just to browse exams.
const PrescriptionPage = lazy(() => import('../../components/PrescriptionPage'));

const navItems = [
  { to: '/dashboard', label: 'Home', end: true },
  { to: '/dashboard/exams', label: 'Exams' },
  { to: '/dashboard/package', label: 'Package' },
  { to: '/dashboard/notices', label: 'Notice Board' },
  { to: '/dashboard/chat', label: 'Messages' },
  { to: '/dashboard/profile', label: 'My Profile' },
];

function LiveExamGate({ children }) {
  const { profile } = useAuth();
  const { value: liveExamOn, loading } = useAppSetting('live_exam_enabled_global', true);
  if (loading) return null;
  if (!liveExamOn) return <LockedFeature />;
  if (profile && profile.live_exam_enabled === false) return <LockedFeature />;
  return children;
}

export default function ExamineeDashboard() {
  return (
    <DashboardLayout title="Examinee" navItems={navItems}>
      <Routes>
        <Route index element={<StudentDashboardHome />} />
        <Route path="exams" element={<LiveExamGate><CategoryExamsPage /></LiveExamGate>} />
        <Route path="bookmarks" element={<BookmarksPage />} />
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
        <Route path="notices" element={<StudentNoticeBoard />} />
        <Route path="chat" element={<StudentChatPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Routes>
    </DashboardLayout>
  );
}
