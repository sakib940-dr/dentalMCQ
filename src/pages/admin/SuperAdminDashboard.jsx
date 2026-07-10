import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import QuestionBankPage from '../../components/QuestionBankPage';
import CategoriesPage from '../../components/CategoriesPage';

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/questions', label: 'Question Bank' },
  { to: '/admin/exams', label: 'Exams' },
  { to: '/admin/moderators', label: 'Moderators' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/notices', label: 'Notice Board' },
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

export default function SuperAdminDashboard() {
  return (
    <DashboardLayout title="Super Admin" navItems={navItems}>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="questions" element={<QuestionBankPage />} />
        <Route path="exams" element={<Placeholder label="Exams" />} />
        <Route path="moderators" element={<Placeholder label="Moderators" />} />
        <Route path="students" element={<Placeholder label="Students" />} />
        <Route path="notices" element={<Placeholder label="Notice Board" />} />
        <Route path="settings" element={<Placeholder label="Settings" />} />
      </Routes>
    </DashboardLayout>
  );
}
