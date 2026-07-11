import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import CategoryExamsPage from '../../components/CategoryExamsPage';
import StudentChatPage from '../../components/StudentChatPage';
import StudentNoticeBoard from '../../components/StudentNoticeBoard';
import { useAppSetting, LockedFeature } from '../../components/FeatureLock';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Home', end: true },
  { to: '/dashboard/notices', label: 'Notice Board' },
  { to: '/dashboard/chat', label: 'Messages' },
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
        <Route index element={<LiveExamGate><CategoryExamsPage /></LiveExamGate>} />
        <Route path="notices" element={<StudentNoticeBoard />} />
        <Route path="chat" element={<StudentChatPage />} />
      </Routes>
    </DashboardLayout>
  );
}
