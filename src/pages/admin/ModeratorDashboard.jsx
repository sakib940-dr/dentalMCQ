import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import QuestionBankPage from '../../components/QuestionBankPage';
import ExamBuilderPage from '../../components/ExamBuilderPage';
import CategoriesPage from '../../components/CategoriesPage';

const navItems = [
  { to: '/moderator', label: 'Overview', end: true },
  { to: '/moderator/categories', label: 'Categories' },
  { to: '/moderator/questions', label: 'Question Bank' },
  { to: '/moderator/exams', label: 'Exams' },
  { to: '/moderator/notices', label: 'Notice Board' },
];

function Overview() {
  return (
    <div className="panel">
      <h2>Moderator Overview</h2>
      <p className="muted">
        You can manage categories, the question bank, publish exams, and post notices. Super Admin
        settings and user management are not accessible from this account.
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

export default function ModeratorDashboard() {
  return (
    <DashboardLayout title="Moderator" navItems={navItems}>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="questions" element={<QuestionBankPage />} />
        <Route path="exams" element={<ExamBuilderPage />} />
        <Route path="notices" element={<Placeholder label="Notice Board" />} />
      </Routes>
    </DashboardLayout>
  );
}
