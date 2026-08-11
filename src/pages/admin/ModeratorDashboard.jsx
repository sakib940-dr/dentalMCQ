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
import {
  IconLayoutDashboard,
  IconCalendar,
  IconHelpCircle,
  IconFileText,
  IconMegaphone,
  IconMessageCircle,
  IconSettings,
  IconBookOpen,
  IconPackage,
} from '../../lib/adminIcons';

// Admin (role: admin, viewed at /moderator): primary navigation lives
// in a 5-tab bottom bar (same pattern DashboardLayout already supports
// for the Examinee dashboard).
const adminBottomNavItems = [
  { to: '/moderator', label: 'Analytics', icon: <IconLayoutDashboard size={20} />, end: true },
  { to: '/moderator/schedule', label: 'Exam Schedule', icon: <IconCalendar size={20} /> },
  { to: '/moderator/exams', label: 'Exam Create', icon: <IconFileText size={20} /> },
  { to: '/moderator/questions', label: 'Question Add', icon: <IconHelpCircle size={20} /> },
  { to: '/moderator/chat', label: 'Message', icon: <IconMessageCircle size={20} /> },
];

// Everything else stays in the ☰ drawer only — the 5 items above are
// deliberately left out here so they don't appear twice.
const adminDrawerNavItems = [
  { to: '/moderator/categories', label: 'Categories', icon: <IconBookOpen size={16} />, group: 'Content' },
  { to: '/moderator/notices', label: 'Notice Board', icon: <IconMegaphone size={16} />, group: 'Communication' },
  { to: '/moderator/payments', label: 'Payments', icon: <IconPackage size={16} />, group: 'Money' },
  { to: '/moderator/settings', label: 'Settings', icon: <IconSettings size={16} />, group: 'System' },
];

// Moderator (plain, non-admin): same 5-tab bottom bar pattern as
// Admin, but with Message swapped out for Notice — moderators use the
// Notice Board more than staff chat day-to-day.
const moderatorBottomNavItems = [
  { to: '/moderator', label: 'Analytics', icon: <IconLayoutDashboard size={20} />, end: true },
  { to: '/moderator/schedule', label: 'Exam Schedule', icon: <IconCalendar size={20} /> },
  { to: '/moderator/exams', label: 'Exam Create', icon: <IconFileText size={20} /> },
  { to: '/moderator/questions', label: 'Question Add', icon: <IconHelpCircle size={20} /> },
  { to: '/moderator/notices', label: 'Notice', icon: <IconMegaphone size={20} /> },
];

// Everything not already in the bottom bar — Messages moves here so it
// isn't duplicated in both places.
const moderatorDrawerNavItems = [
  { to: '/moderator/chat', label: 'Messages', icon: <IconMessageCircle size={16} />, group: 'Communication' },
  { to: '/moderator/settings', label: 'Settings', icon: <IconSettings size={16} />, group: 'System' },
];

export default function ModeratorDashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const title = isAdmin ? 'Admin' : 'Moderator';

  return (
    <DashboardLayout
      title={title}
      navItems={isAdmin ? adminDrawerNavItems : moderatorDrawerNavItems}
      bottomNavItems={isAdmin ? adminBottomNavItems : moderatorBottomNavItems}
      showPackageInfo={false}
      appVersion="v1.0"
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
