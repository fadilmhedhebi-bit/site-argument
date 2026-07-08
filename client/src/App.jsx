import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useNotificationStore } from './stores/notificationStore';
import { ThemeProvider } from './ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LivreurPage from './pages/LivreurPage';
import ClientCommandePage from './pages/ClientCommandePage';
import CustomerPage from './pages/CustomerPage';
import SuiviCommandePage from './pages/SuiviCommandePage';
import SettingsPage from './pages/SettingsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ReservationPublicPage from './pages/ReservationPublicPage';
import PlatformAdminLoginPage from './pages/PlatformAdminLoginPage';
import PlatformAdminDashboardPage from './pages/PlatformAdminDashboardPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';

function ProtectedRoute({ children, roles }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'driver') return <Navigate to="/livraison" />;
  return <Navigate to="/dashboard" />;
}

export default function App() {
  const requestPermission = useNotificationStore((s) => s.requestPermission);
  useEffect(() => { requestPermission(); }, []);

  return (
    <ThemeProvider>
    <BrowserRouter>
      <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/commander/:businessId" element={<ClientCommandePage />} />
        <Route path="/client/:businessId" element={<CustomerPage />} />
        <Route path="/reservation/:reservationNumber" element={<ReservationPublicPage />} />
        <Route path="/suivi" element={<SuiviCommandePage />} />
        <Route path="/suivi/:orderNumber" element={<SuiviCommandePage />} />
        <Route path="/confidentialite" element={<PrivacyPolicyPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/admin/login" element={<PlatformAdminLoginPage />} />
        <Route path="/admin" element={<PlatformAdminDashboardPage />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={
            <ProtectedRoute roles={['manager', 'manager_driver', 'staff']}><DashboardPage /></ProtectedRoute>
          } />
          <Route path="livraison" element={
            <ProtectedRoute roles={['driver', 'manager_driver']}><LivreurPage /></ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute><SettingsPage /></ProtectedRoute>
          } />
        </Route>
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
    </ThemeProvider>
  );
}
