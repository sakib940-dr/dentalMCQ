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
import MotivationalLinePanel from '../../components/MotivationalLinePanel';
import MentorsAdminPage from '../../components/MentorsAdminPage';
import ReferralSettingsPanel from '../../components/ReferralSettingsPanel';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true, quick: true, group: 'Overview' },
  { to: '/admin/categories', label: 'Categories', icon: '📚', group: 'Content' },
  { to: '/admin/schedule', label: 'Exam Schedule', icon: '🗓️', group: 'Content' },
  { to: '/admin/questions', label: 'Question Bank', icon: '❓', quick: true, group: 'Content' },
  { to: '/admin/exams', label: 'Exams', icon: '📝', group: 'Content' },
  { to: '/admin/users', label: 'Users', icon: '👥', quick: true, group: 'People' },
  { to: '/admin/access', label: 'Access Control', icon: '🔐', group: 'People' },
  { to: '/admin/payments', label: 'Payments', icon: '💳', quick: true, group: 'Money' },
  { to: '/admin/prescriptions', label: 'Prescriptions', icon: '📄', group: 'Chamber' },
  { to: '/admin/notices', label: 'Notice Board', icon: '📢', group: 'Communication' },
  { to: '/admin/chat', label: 'Messages', icon: '💬', group: 'Communication' },
  { to: '/admin/feedback', label: 'Feedback', icon: '📮', group: 'Communication' },
  { to: '/admin/cms', label: 'Website / CMS', icon: '🖥️', quick: true, group: 'System' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️', group: 'System' },
];

function Placeholder({ label }) {
  return (
    <div className="panel">
      <h2>{label}</h2>
      <p className="muted">This section is coming in the next build step.</p>
    </div>
  );
}

// Everything that shapes what visitors/students actually SEE on the
// website (landing page, contact info, mentors, help center, roadmap)
// lives here — separate from account/system settings.
function CmsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel" style={{ background: '#FAF9F5' }}>
        <h2 style={{ margin: 0 }}>ওয়েবসাইট / অ্যাপ কনটেন্ট ম্যানেজমেন্ট (CMS)</h2>
        <p className="muted small" style={{ marginBottom: 0 }}>
          নিচের প্রতিটা প্যানেল থেকে যা এডিট করবেন তা সরাসরি ওয়েবসাইটে (ল্যান্ডিং পেজ, Contact Us, Help Center) সাথে সাথে
          দেখাবে — কোনো কোড ডিপ্লয় লাগবে না।
        </p>
      </div>
      <MentorsAdminPage />
      <ContactInfoPanel />
      <MotivationalLinePanel />
      <HelpCenterAdminPage />
      <UpcomingFeaturesAdminPage />
    </div>
  );
}

function SettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FeatureTogglesPanel />
      <ReferralSettingsPanel />
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
        <Route path="cms" element={<CmsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </DashboardLayout>
  );
}
