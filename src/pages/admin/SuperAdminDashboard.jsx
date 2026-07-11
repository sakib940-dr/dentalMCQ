import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import QuestionBankPage from '../../components/QuestionBankPage';
import CategoriesPage from '../../components/CategoriesPage';
import ExamBuilderPage from '../../components/ExamBuilderPage';
import UserManagementPage from '../../components/UserManagementPage';
import FeatureTogglesPanel from '../../components/FeatureTogglesPanel';
import ChangePasswordPanel from '../../components/ChangePasswordPanel';
import StaffChatInbox from '../../components/StaffChatInbox';
import NoticeBoardAdminPage from '../../components/NoticeBoardAdminPage';

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/questions', label: 'Question Bank' },
  { to: '/admin/exams', label: 'Exams' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/notices', label: 'Notice Board' },
  { to: '/admin/chat', label: 'Messages' },
  { to: '/admin/settings', label: 'Settings' },
];

function Overview() {
  return (
    <div className="panel">
      <h2>Super Admin Overview</h2>
      <p className="muted">
        This is your control center. Category, question bank, exam, moderator, and student
        management panels will appear here as we build them out.
      </p>
    </div>
  );
}

function Placeholder({ label }) {
  return (
    <div className="panel">
      <h2>{label}</h2>
      <p className="muted">This section is coming in the next build step.</p>
    </div>
  );
}

function SettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FeatureTogglesPanel />
      <ChangePasswordPanel />
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <DashboardLayout title="Super Admin" navItems={navItems}>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="questions" element={<QuestionBankPage />} />
        <Route path="exams" element={<ExamBuilderPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="notices" element={<NoticeBoardAdminPage />} />
        <Route path="chat" element={<StaffChatInbox />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </DashboardLayout>
  );
}
