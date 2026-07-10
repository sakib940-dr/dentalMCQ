import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

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

export default function ExamineeDashboard() {
  return (
    <DashboardLayout title="Exam Hall" navItems={navItems}>
      <Routes>
        <Route index element={<Home />} />
        <Route path="live" element={<Placeholder label="Live Exams" />} />
        <Route path="upcoming" element={<Placeholder label="Upcoming Exams" />} />
        <Route path="archived" element={<Placeholder label="Archived Exams" />} />
        <Route path="practice" element={<Placeholder label="Practice Mode" />} />
        <Route path="results" element={<Placeholder label="Results" />} />
        <Route path="merit" element={<Placeholder label="Merit Lists" />} />
        <Route path="notices" element={<Placeholder label="Notice Board" />} />
      </Routes>
    </DashboardLayout>
  );
}
