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

const navItems = [
  { to: '/moderator', label: 'Overview', end: true },
  { to: '/moderator/categories', label: 'Categories' },
  { to: '/moderator/schedule', label: 'Exam Schedule' },
  { to: '/moderator/questions', label: 'Question Bank' },
  { to: '/moderator/exams', label: 'Exams' },
  { to: '/moderator/payments', label: 'Payments' },
  { to: '/moderator/notices', label: 'Notice Board' },
  { to: '/moderator/chat', label: 'Messages' },
  { to: '/moderator/settings', label: 'Settings' },
];

function Placeholder({ label }) {
  return (
    <div className="panel">
      <h2>{label}</h2>
      <p className="muted">This section is coming in the next build step.</p>
    </div>
  );
}

export default function ModeratorDashboard() {
  return (
    <DashboardLayout title="Moderator" navItems={navItems}>
      <Routes>
        <Route index element={<ModeratorOverview />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="schedule" element={<ExamSchedulePage />} />
        <Route path="questions" element={<QuestionBankPage />} />
        <Route path="exams" element={<ExamBuilderPage />} />
        <Route path="payments" element={<PaymentAdminPage />} />
        <Route path="notices" element={<NoticeBoardAdminPage />} />
        <Route path="chat" element={<StaffChatInbox />} />
        <Route path="settings" element={<ChangePasswordPanel />} />
      </Routes>
    </DashboardLayout>
  );
}
