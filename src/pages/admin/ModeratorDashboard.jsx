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
import PackagesReadOnlyPage from '../../components/PackagesReadOnlyPage';
import { useAuth } from '../../contexts/AuthContext';

const baseNavItems = [
  { to: '/moderator', label: 'Dashboard', icon: '📊', end: true, quick: true, group: 'Overview' },
  { to: '/moderator/schedule', label: 'Exam Schedule', icon: '🗓️', group: 'Content' },
  { to: '/moderator/questions', label: 'Question Bank', icon: '❓', quick: true, group: 'Content' },
  { to: '/moderator/exams', label: 'Exams', icon: '📝', group: 'Content' },
  { to: '/moderator/notices', label: 'Notice Board', icon: '📢', group: 'Communication' },
  { to: '/moderator/chat', label: 'Messages', icon: '💬', quick: true, group: 'Communication' },
  { to: '/moderator/settings', label: 'Settings', icon: '⚙️', group: 'System' },
];

export default function ModeratorDashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const title = isAdmin ? 'Admin' : 'Moderator';

  // Admin can create/edit (not delete) categories, and can VIEW packages
  // read-only — Moderator has no category or payment access at all, per
  // RBAC spec.
  const navItems = isAdmin
    ? [
        baseNavItems[0],
        { to: '/moderator/categories', label: 'Categories', icon: '📚', group: 'Content' },
        ...baseNavItems.slice(1),
        { to: '/moderator/packages', label: 'Packages', icon: '📦', group: 'Money' },
      ]
    : baseNavItems;

  return (
    <DashboardLayout title={title} navItems={navItems}>
      <Routes>
        <Route index element={<ModeratorOverview />} />
        {isAdmin && <Route path="categories" element={<CategoriesPage hideDelete />} />}
        {isAdmin && <Route path="packages" element={<PackagesReadOnlyPage />} />}
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
