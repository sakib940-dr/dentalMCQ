import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import PracticePage from '../../components/PracticePage';
import CategoryExamsPage from '../../components/CategoryExamsPage';
import StudentChatPage from '../../components/StudentChatPage';
import ResultsPage from '../../components/ResultsPage';
import MeritListPage from '../../components/MeritListPage';
import { useAppSetting, LockedFeature } from '../../components/FeatureLock';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Home', end: true },
  { to: '/dashboard/practice', label: 'Practice' },
  { to: '/dashboard/results', label: 'Results' },
  { to: '/dashboard/merit', label: 'Merit Lists' },
  { to: '/dashboard/notices', label: 'Notice Board' },
  { to: '/dashboard/chat', label: 'Messages' },
];

function Placeholder({ label }) {
  return (
    <div className="panel">
      <h2>{label}</h2>
      <p className="muted">This section is coming in the next build step.</p>
    </div>
  );
}

function LiveExamGate({ children }) {
  const { profile } = useAuth();
  const { value: liveExamOn, loading } = useAppSetting('live_exam_enabled_global', true);
  if (loading) return null;
  if (!liveExamOn) return <LockedFeature />;
  if (profile && profile.live_exam_enabled === false) return <LockedFeature />;
  return children;
}

export default function ExamineeDashboard() {
  return (
    <DashboardLayout title="Examinee" navItems={navItems}>
      <Routes>
        <Route index element={<LiveExamGate><CategoryExamsPage /></LiveExamGate>} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="merit" element={<MeritListPage />} />
        <Route path="notices" element={<Placeholder label="Notice Board" />} />
        <Route path="chat" element={<StudentChatPage />} />
      </Routes>
    </DashboardLayout>
  );
}
