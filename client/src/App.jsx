import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useNotificationStore } from './stores/notificationStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LivreurPage from './pages/LivreurPage';
import ClientCommandePage from './pages/ClientCommandePage';
import CustomerPage from './pages/CustomerPage';
import SuiviCommandePage from './pages/SuiviCommandePage';

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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/commander/:businessId" element={<ClientCommandePage />} />
        <Route path="/client/:businessId" element={<CustomerPage />} />
        <Route path="/suivi" element={<SuiviCommandePage />} />
        <Route path="/suivi/:orderNumber" element={<SuiviCommandePage />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={
            <ProtectedRoute roles={['manager', 'manager_driver']}><DashboardPage /></ProtectedRoute>
          } />
          <Route path="livraison" element={
            <ProtectedRoute roles={['driver', 'manager_driver']}><LivreurPage /></ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
