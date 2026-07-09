import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useNotificationStore } from './stores/notificationStore';
import { ThemeProvider } from './ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import PageSpinner from './components/PageSpinner';

// Chaque page part dans son propre chunk JS, charge a la demande plutot que
// tout regroupe dans un seul bundle initial (recharts/leaflet notamment ne
// sont utilises que par quelques pages, pas la peine de les telecharger pour
// un simple ecran de connexion).
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LivreurPage = lazy(() => import('./pages/LivreurPage'));
const ClientCommandePage = lazy(() => import('./pages/ClientCommandePage'));
const CustomerPage = lazy(() => import('./pages/CustomerPage'));
const SuiviCommandePage = lazy(() => import('./pages/SuiviCommandePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ReservationPublicPage = lazy(() => import('./pages/ReservationPublicPage'));
const PlatformAdminLoginPage = lazy(() => import('./pages/PlatformAdminLoginPage'));
const PlatformAdminDashboardPage = lazy(() => import('./pages/PlatformAdminDashboardPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));


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
      <Suspense fallback={<PageSpinner />}>
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
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
    </ThemeProvider>
  );
}
