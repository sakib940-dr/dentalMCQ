import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import HomeRedirect from './pages/HomeRedirect';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';
import ModeratorDashboard from './pages/admin/ModeratorDashboard';
import ExamineeDashboard from './pages/examinee/ExamineeDashboard';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/" element={<HomeRedirect />} />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/moderator/*"
            element={
              <ProtectedRoute allowedRoles={['moderator', 'admin']}>
                <ModeratorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute allowedRoles={['examinee']}>
                <ExamineeDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
