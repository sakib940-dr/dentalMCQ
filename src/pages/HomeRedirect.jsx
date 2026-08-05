import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LandingPage from './LandingPage';

export default function HomeRedirect() {
  const { role, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="full-page-center">
        <div className="spinner" />
      </div>
    );
  }

  if (role === 'super_admin') return <Navigate to="/admin" replace />;
  if (role === 'moderator' || role === 'admin') return <Navigate to="/moderator" replace />;
  if (role === 'examinee') return <Navigate to="/dashboard" replace />;

  // Logged in but the profile row hasn't loaded yet (e.g. right after
  // signup) — wait rather than flashing the public landing page.
  if (user) {
    return (
      <div className="full-page-center">
        <div className="spinner" />
      </div>
    );
  }

  // Not logged in at all — show the public marketing/landing page instead
  // of forcing straight to the login form.
  return <LandingPage />;
}
