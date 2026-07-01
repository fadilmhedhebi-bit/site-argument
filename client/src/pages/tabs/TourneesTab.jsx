import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useTheme } from '../../ThemeContext';
import 'leaflet/dist/leaflet.css';

const driverIcon = new L.DivIcon({
  html: '<div style="background:#3140A8;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🚗</div>',
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
});

const stopIcon = new L.DivIcon({
  html: '<div style="background:#9472D4;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">📍</div>',
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) map.fitBounds(positions.map(p => [p.lat, p.lng]), { padding: [50, 50] });
  }, [positions, map]);
  return null;
}

const statusLabels = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En prépa.', ready: 'Prête',
  in_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée', problem: 'Problème',
};

function getStatusStyle(status, t) {
  switch (status) {
    case 'pending':
      return { backgroundColor: t.tabBg, color: t.text2 };
    case 'confirmed':
    case 'preparing':
      return { backgroundColor: t.blueBg, color: t.blueText };
    case 'ready':
    case 'in_delivery':
      return { backgroundColor: t.greenBg, color: t.greenText };
    case 'delivered':
      return { backgroundColor: t.greenText, color: '#fff' };
    case 'cancelled':
    case 'problem':
      return { backgroundColor: t.orangeBg, color: t.orangeText };
    default:
      return { backgroundColor: t.tabBg, color: t.text2 };
  }
}

export default function TourneesTab() {
  const { t } = useTheme();
  const [tours, setTours] = useState([]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverPositions, setDriverPositions] = useState({});
  const [connected, setConnected] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState([]);
  const [tourForm, setTourForm] = useState({ driverId: '', name: '' });
  const { token } = useAuthStore();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const socketRef = useRef(null);

  const loadData = () => {
    Promise.all([
      api.get('/tours'),
      api.get('/orders?limit=200'),
      api.get('/auth/drivers'),
    ]).then(([tr, o, d]) => { setTours(tr); setOrders(o); setDrivers(d); }).catch(console.error);
  };

  useEffect(loadData, []);

  useEffect(() => {
    if (!token) return;
    const socket = io(import.meta.env.VITE_API_URL || '/', { auth: { token }, path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => { setConnected(true); socket.emit('positions:request'); });
    socket.on('disconnect', () => setConnected(false));

    socket.on('positions:all', (positions) => {
      const map = {};
      for (const p of positions) map[p.driver_id] = { lat: p.latitude, lng: p.longitude, name: `${p.first_name} ${p.last_name}` };
      setDriverPositions(map);
    });

    socket.on('position:updated', (data) => {
      setDriverPositions(prev => ({
        ...prev, [data.driverId]: { lat: data.latitude, lng: data.longitude, name: prev[data.driverId]?.name || 'Livreur' },
      }));
    });

    socket.on('driver:offline', (data) => {
      setDriverPositions(prev => { const next = { ...prev }; delete next[data.driverId]; return next; });
    });

    socket.on('order:new', (data) => {
      addNotification({ title: 'Nouvelle commande', message: `${data.orderNumber} - ${data.customerName}` });
      loadData();
    });

    socket.on('order:status', () => loadData());
    socket.on('tour:created', () => loadData());
    socket.on('tour:status', () => loadData());

    return () => socket.disconnect();
  }, [token]);

  const unassigned = orders.filter(o => !o.driver_id && ['pending', 'confirmed'].includes(o.status));
  const ordersByDriver = {};
  drivers.forEach(d => { ordersByDriver[d.id] = []; });
  orders.filter(o => o.driver_id && o.status !== 'delivered' && o.status !== 'cancelled').forEach(o => {
    if (ordersByDriver[o.driver_id]) ordersByDriver[o.driver_id].push(o);
  });

  const activeStops = orders
    .filter(o => ['confirmed', 'preparing', 'ready', 'in_delivery'].includes(o.status) && o.delivery_latitude && o.delivery_longitude)
    .map(o => ({ lat: parseFloat(o.delivery_latitude), lng: parseFloat(o.delivery_longitude), name: o.customer_name, orderNumber: o.order_number }));
  const allPositions = [...Object.values(driverPositions), ...activeStops];

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const createTour = async () => {
    if (!tourForm.driverId || selected.length === 0) return;
    try {
      let startLatitude, startLongitude;
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        startLatitude = pos.coords.latitude;
        startLongitude = pos.coords.longitude;
      } catch {}
      await api.post('/tours', { driverId: tourForm.driverId, name: tourForm.name, orderIds: selected, startLatitude, startLongitude });
      setShowCreate(false);
      setSelected([]);
      setTourForm({ driverId: '', name: '' });
      loadData();
    } catch (err) { alert(err.message); }
  };

  const closeDay = async () => {
    if (!confirm('Clôturer la journée ?')) return;
    try { await api.post('/stats/close-day', {}); alert('Journée clôturée'); } catch (err) { alert(err.message); }
  };

  const updateTourStatus = async (id, status) => {
    try { await api.patch(`/tours/${id}/status`, { status }); loadData(); } catch (err) { alert(err.message); }
  };

  const optimizeTour = async (id) => {
    try { await api.post(`/tours/${id}/optimize`); loadData(); alert('Itinéraire optimisé !'); } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs px-2 py-1 rounded-full"
          style={connected ? { backgroundColor: t.greenBg, color: t.greenText } : { backgroundColor: t.orangeBg, color: t.orangeText }}>
          {connected ? '● Connecté' : '○ Déconnecté'}
        </span>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: t.accent, color: '#fff' }}>
              Créer tournée ({selected.length})
            </button>
          )}
          <button onClick={closeDay} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: t.text1, color: t.cardBg }}>
            Clôturer la journée
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden shadow-lg h-56 sm:h-72 md:h-[400px]"
        style={{ border: `1px solid ${t.border}` }}>
        <MapContainer center={[48.8566, 2.3522]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {allPositions.length > 0 && <FitBounds positions={allPositions} />}
          {Object.entries(driverPositions).map(([id, pos]) => (
            <Marker key={id} position={[pos.lat, pos.lng]} icon={driverIcon}>
              <Popup>{pos.name}</Popup>
            </Marker>
          ))}
          {activeStops.map((s, i) => (
            <Marker key={`stop-${i}`} position={[s.lat, s.lng]} icon={stopIcon}>
              <Popup><strong>{s.orderNumber}</strong><br />{s.name}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {tours.filter(tr => tr.status !== 'completed' && tr.status !== 'cancelled').length > 0 && (
        <div>
          <h3 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Tournées actives</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tours.filter(tr => tr.status !== 'completed' && tr.status !== 'cancelled').map(tr => (
              <div key={tr.id} className="rounded-xl p-4"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm" style={{ color: t.text1 }}>{tr.name}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={tr.status === 'in_progress' ? { backgroundColor: t.greenBg, color: t.greenText } : { backgroundColor: t.tabBg, color: t.text2 }}>
                    {tr.status === 'planned' ? 'Planifiée' : tr.status === 'in_progress' ? 'En cours' : tr.status}
                  </span>
                </div>
                <p className="text-xs" style={{ color: t.text2 }}>{tr.driver_first_name} {tr.driver_last_name} — {tr.order_count} arrêts</p>
                <div className="flex gap-2 mt-3">
                  {tr.status === 'planned' && (
                    <button onClick={() => updateTourStatus(tr.id, 'in_progress')} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ backgroundColor: t.greenText, color: '#fff' }}>Démarrer</button>
                  )}
                  {tr.status === 'in_progress' && (
                    <button onClick={() => updateTourStatus(tr.id, 'completed')} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ backgroundColor: t.text1, color: t.cardBg }}>Terminer</button>
                  )}
                  <button onClick={() => optimizeTour(tr.id)} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{ backgroundColor: t.accentBg, color: t.accent }}>Optimiser</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Commandes par livreur</h3>
        <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto pb-4">
          <div className="w-full sm:flex-shrink-0 sm:w-72 rounded-xl p-3" style={{ backgroundColor: t.tabBg }}>
            <h4 className="font-semibold text-sm mb-3 flex items-center justify-between" style={{ color: t.text1 }}>
              Non assignées <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: t.tabBg, color: t.text2 }}>{unassigned.length}</span>
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {unassigned.map(o => (
                <div key={o.id} onClick={() => toggleSelect(o.id)}
                  className="rounded-lg p-3 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: t.cardBg,
                    border: selected.includes(o.id) ? `1px solid ${t.accent}` : `1px solid ${t.border}`,
                    boxShadow: selected.includes(o.id) ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold" style={{ color: t.accent }}>{o.order_number}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={getStatusStyle(o.status, t)}>{statusLabels[o.status]}</span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: t.text1 }}>{o.customer_name}</p>
                  <p className="text-xs truncate" style={{ color: t.text2 }}>{o.delivery_address}</p>
                  {selected.includes(o.id) && <span className="text-xs font-semibold mt-1 block" style={{ color: t.accent }}>✓ Sélectionnée</span>}
                </div>
              ))}
              {unassigned.length === 0 && <p className="text-xs text-center py-4" style={{ color: t.text3 }}>Aucune commande</p>}
            </div>
          </div>

          {drivers.map(d => (
            <div key={d.id} className="w-full sm:flex-shrink-0 sm:w-72 rounded-xl p-3" style={{ backgroundColor: t.tabBg }}>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: t.text1 }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: t.accentBg, color: t.accent }}>
                  {d.firstName[0]}{d.lastName[0]}
                </div>
                {d.firstName} {d.lastName}
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: t.tabBg, color: t.text2 }}>{(ordersByDriver[d.id] || []).length}</span>
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(ordersByDriver[d.id] || []).map(o => (
                  <div key={o.id} className="rounded-lg p-3"
                    style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold" style={{ color: t.accent }}>{o.order_number}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={getStatusStyle(o.status, t)}>{statusLabels[o.status]}</span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: t.text1 }}>{o.customer_name}</p>
                    <p className="text-xs truncate" style={{ color: t.text2 }}>{o.delivery_address}</p>
                    {o.stop_order && <p className="text-xs mt-1" style={{ color: t.accent }}>Arrêt #{o.stop_order}</p>}
                  </div>
                ))}
                {(ordersByDriver[d.id] || []).length === 0 && <p className="text-xs text-center py-4" style={{ color: t.text3 }}>Aucune commande</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowCreate(false)}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>Nouvelle tournée</h2>
            <p className="text-sm mb-4" style={{ color: t.text2 }}>{selected.length} commande(s) sélectionnée(s)</p>
            <div className="space-y-3">
              <input placeholder="Nom de la tournée" value={tourForm.name}
                onChange={e => setTourForm({ ...tourForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
              <select value={tourForm.driverId} onChange={e => setTourForm({ ...tourForm, driverId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }}>
                <option value="">Choisir un livreur</option>
                {drivers.filter(d => d.isActive).map(d => (
                  <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm"
                style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={createTour} className="flex-1 py-2.5 rounded-lg font-semibold text-sm"
                style={{ backgroundColor: t.accent, color: '#fff' }}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
