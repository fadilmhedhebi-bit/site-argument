import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useNotificationStore } from './stores/notificationStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Tours from './pages/Tours';
import MapView from './pages/MapView';
import Products from './pages/Products';
import Drivers from './pages/Drivers';
import Promos from './pages/Promos';
import Closings from './pages/Closings';
import PublicMenu from './pages/PublicMenu';
import TrackOrder from './pages/TrackOrder';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink/50">Chargement...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const init = useAuthStore((s) => s.init);
  const requestPermission = useNotificationStore((s) => s.requestPermission);

  useEffect(() => {
    init();
    requestPermission();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/menu/:businessId" element={<PublicMenu />} />
        <Route path="/track" element={<TrackOrder />} />
        <Route path="/track/:orderNumber" element={<TrackOrder />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="tours" element={<Tours />} />
          <Route path="map" element={<MapView />} />
          <Route path="products" element={<Products />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="promos" element={<Promos />} />
          <Route path="closings" element={<Closings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
