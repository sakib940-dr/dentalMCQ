import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import PracticePage from '../../components/PracticePage';
import { useAppSetting, LockedFeature } from '../../components/FeatureLock';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Home', end: true },
  { to: '/dashboard/live', label: 'Live Exams' },
  { to: '/dashboard/upcoming', label: 'Upcoming' },
  { to: '/dashboard/archived', label: 'Archived' },
  { to: '/dashboard/practice', label: 'Practice' },
  { to: '/dashboard/results', label: 'Results' },
  { to: '/dashboard/merit', label: 'Merit Lists' },
  { to: '/dashboard/notices', label: 'Notice Board' },
];

function Home() {
  return (
    <div className="panel">
      <h2>Welcome</h2>
      <p className="muted">
        Your exam categories, live exams, and results will appear here as we build out each
        section.
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

function LiveExamGate({ label }) {
  const { profile } = useAuth();
  const { value: liveExamOn, loading } = useAppSetting('live_exam_enabled_global', true);
  if (loading) return null;
  if (!liveExamOn) return <LockedFeature />;
  if (profile && profile.live_exam_enabled === false) return <LockedFeature />;
  return <Placeholder label={label} />;
}

export default function ExamineeDashboard() {
  return (
    <DashboardLayout title="Examinee" navItems={navItems}>
      <Routes>
        <Route index element={<Home />} />
        <Route path="live" element={<LiveExamGate label="Live Exams" />} />
        <Route path="upcoming" element={<LiveExamGate label="Upcoming Exams" />} />
        <Route path="archived" element={<LiveExamGate label="Archived Exams" />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="results" element={<Placeholder label="Results" />} />
        <Route path="merit" element={<Placeholder label="Merit Lists" />} />
        <Route path="notices" element={<Placeholder label="Notice Board" />} />
      </Routes>
    </DashboardLayout>
  );
}
