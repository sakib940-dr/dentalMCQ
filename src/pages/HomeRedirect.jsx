import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function HomeRedirect() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="full-page-center">
        <div className="spinner" />
      </div>
    );
  }

  if (role === 'super_admin') return <Navigate to="/admin" replace />;
  if (role === 'moderator') return <Navigate to="/moderator" replace />;
  if (role === 'examinee') return <Navigate to="/dashboard" replace />;

  // Profile not loaded yet or unknown role — send to login
  return <Navigate to="/login" replace />;
}
