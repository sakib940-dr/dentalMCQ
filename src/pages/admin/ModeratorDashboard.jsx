import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import QuestionBankPage from '../../components/QuestionBankPage';
import ExamBuilderPage from '../../components/ExamBuilderPage';
import ChangePasswordPanel from '../../components/ChangePasswordPanel';
import StaffChatInbox from '../../components/StaffChatInbox';
import NoticeBoardAdminPage from '../../components/NoticeBoardAdminPage';
import ModeratorOverview from '../../components/ModeratorOverview';
import ExamSchedulePage from '../../components/ExamSchedulePage';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/moderator', label: 'Overview', end: true },
  { to: '/moderator/schedule', label: 'Exam Schedule' },
  { to: '/moderator/questions', label: 'Question Bank' },
  { to: '/moderator/exams', label: 'Exams' },
  { to: '/moderator/notices', label: 'Notice Board' },
  { to: '/moderator/chat', label: 'Messages' },
  { to: '/moderator/settings', label: 'Settings' },
];

export default function ModeratorDashboard() {
  const { profile } = useAuth();
  const title = profile?.role === 'admin' ? 'Admin' : 'Moderator';

  return (
    <DashboardLayout title={title} navItems={navItems}>
      <Routes>
        <Route index element={<ModeratorOverview />} />
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
