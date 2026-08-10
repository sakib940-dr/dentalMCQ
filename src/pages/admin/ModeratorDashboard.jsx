import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import QuestionBankPage from '../../components/QuestionBankPage';
import ExamBuilderPage from '../../components/ExamBuilderPage';
import CategoriesPage from '../../components/CategoriesPage';
import ChangePasswordPanel from '../../components/ChangePasswordPanel';
import StaffChatInbox from '../../components/StaffChatInbox';
import NoticeBoardAdminPage from '../../components/NoticeBoardAdminPage';
import ModeratorOverview from '../../components/ModeratorOverview';
import ExamSchedulePage from '../../components/ExamSchedulePage';
import PaymentAdminPage from '../../components/PaymentAdminPage';
import { useAuth } from '../../contexts/AuthContext';

// Moderator (non-admin): unchanged — top quick-bar + ☰ drawer, same as before.
const moderatorNavItems = [
  { to: '/moderator', label: 'Dashboard', icon: '📊', end: true, quick: true, group: 'Overview' },
  { to: '/moderator/schedule', label: 'Exam Schedule', icon: '🗓️', group: 'Content' },
  { to: '/moderator/questions', label: 'Question Bank', icon: '❓', quick: true, group: 'Content' },
  { to: '/moderator/exams', label: 'Exams', icon: '📝', group: 'Content' },
  { to: '/moderator/notices', label: 'Notice Board', icon: '📢', group: 'Communication' },
  { to: '/moderator/chat', label: 'Messages', icon: '💬', quick: true, group: 'Communication' },
  { to: '/moderator/settings', label: 'Settings', icon: '⚙️', group: 'System' },
];

// Admin: primary navigation lives in a 5-tab bottom bar (same pattern
// DashboardLayout already supports for the Examinee dashboard).
const adminBottomNavItems = [
  { to: '/moderator', label: 'Analytics', icon: '📊', end: true },
  { to: '/moderator/schedule', label: 'Exam Schedule', icon: '🗓️' },
  { to: '/moderator/exams', label: 'Exam Create', icon: '📝' },
  { to: '/moderator/questions', label: 'Question Add', icon: '❓' },
  { to: '/moderator/chat', label: 'Message', icon: '💬' },
];

// Everything else stays in the ☰ drawer only — the 5 items above are
// deliberately left out here so they don't appear twice.
const adminDrawerNavItems = [
  { to: '/moderator/categories', label: 'Categories', icon: '📚', group: 'Content' },
  { to: '/moderator/notices', label: 'Notice Board', icon: '📢', group: 'Communication' },
  { to: '/moderator/payments', label: 'Payments', icon: '📦', group: 'Money' },
  { to: '/moderator/settings', label: 'Settings', icon: '⚙️', group: 'System' },
];

export default function ModeratorDashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const title = isAdmin ? 'Admin' : 'Moderator';

  return (
    <DashboardLayout
      title={title}
      navItems={isAdmin ? adminDrawerNavItems : moderatorNavItems}
      bottomNavItems={isAdmin ? adminBottomNavItems : undefined}
      showPackageInfo={false}
      appVersion={isAdmin ? 'v1.0' : undefined}
    >
      <Routes>
        <Route index element={<ModeratorOverview />} />
        {isAdmin && <Route path="categories" element={<CategoriesPage hideDelete />} />}
        {isAdmin && <Route path="payments" element={<PaymentAdminPage />} />}
        <Route path="schedule" element={<ExamSchedulePage />} />
        <Route path="questions" element={<QuestionBankPage />} />
        <Route path="exams" element={<ExamBuilderPage />} />
        <Route path="notices" element={<NoticeBoardAdminPage />} />
        <Route path="chat" element={<StaffChatInbox />} />
        <Route path="settings" element={<ChangePasswordPanel />} />
      </Routes>
    </DashboardLayout>
  );
}
