import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import HomeRedirect from './pages/HomeRedirect';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ResendConfirmationPage from './pages/auth/ResendConfirmationPage';
import HelpCenterPage from './pages/HelpCenterPage';
import LegalPage from './pages/LegalPage';
import FaqPage from './pages/FaqPage';
import BlogListPage from './pages/BlogListPage';
import BlogPostPage from './pages/BlogPostPage';
import './App.css';

// Each role's dashboard is its own lazy chunk — a Student never
// downloads Super Admin/Moderator code (and vice versa), which is the
// single biggest bundle-size win available given how role-siloed the
// app's UI already is.
const SuperAdminDashboard = lazy(() => import('./pages/admin/SuperAdminDashboard'));
const ModeratorDashboard = lazy(() => import('./pages/admin/ModeratorDashboard'));
const ExamineeDashboard = lazy(() => import('./pages/examinee/ExamineeDashboard'));

function RouteLoading() {
  return (
    <div className="full-page-center">
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/resend-confirmation" element={<ResendConfirmationPage />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/terms" element={<LegalPage pageKey="terms" />} />
            <Route path="/privacy" element={<LegalPage pageKey="privacy_policy" />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />

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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
