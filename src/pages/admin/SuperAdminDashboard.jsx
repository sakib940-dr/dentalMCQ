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
import SuperAdminOverview from '../../components/SuperAdminOverview';
import ExamSchedulePage from '../../components/ExamSchedulePage';
import PaymentAdminPage from '../../components/PaymentAdminPage';
import AccessControlPage from '../../components/AccessControlPage';
import StuckAttemptsPage from '../../components/StuckAttemptsPage';
import AuditLogPage from '../../components/AuditLogPage';
import PrescriptionActivityPage from '../../components/PrescriptionActivityPage';
import FeedbackAdminPage from '../../components/FeedbackAdminPage';
import ContactInfoPanel from '../../components/ContactInfoPanel';
import HelpCenterAdminPage from '../../components/HelpCenterAdminPage';
import UpcomingFeaturesAdminPage from '../../components/UpcomingFeaturesAdminPage';

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/schedule', label: 'Exam Schedule' },
  { to: '/admin/questions', label: 'Question Bank' },
  { to: '/admin/exams', label: 'Exams' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/access', label: 'Access Control' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/prescriptions', label: 'Prescriptions' },
  { to: '/admin/notices', label: 'Notice Board' },
  { to: '/admin/chat', label: 'Messages' },
  { to: '/admin/feedback', label: 'Feedback' },
  { to: '/admin/settings', label: 'Settings' },
];

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
      <ContactInfoPanel />
      <HelpCenterAdminPage />
      <UpcomingFeaturesAdminPage />
      <ChangePasswordPanel />
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <DashboardLayout title="Super Admin" navItems={navItems}>
      <Routes>
        <Route index element={<SuperAdminOverview />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="schedule" element={<ExamSchedulePage />} />
        <Route path="questions" element={<QuestionBankPage />} />
        <Route path="exams" element={<ExamBuilderPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="access" element={<><AccessControlPage /><StuckAttemptsPage /><AuditLogPage /></>} />
        <Route path="payments" element={<PaymentAdminPage />} />
        <Route path="prescriptions" element={<PrescriptionActivityPage />} />
        <Route path="notices" element={<NoticeBoardAdminPage />} />
        <Route path="chat" element={<StaffChatInbox />} />
        <Route path="feedback" element={<FeedbackAdminPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </DashboardLayout>
  );
}
