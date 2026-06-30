import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import 'leaflet/dist/leaflet.css';

const driverIcon = new L.DivIcon({
  html: '<div style="background:#F97316;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🚗</div>',
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
});

const stopIcon = new L.DivIcon({
  html: '<div style="background:#EF4444;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">📍</div>',
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) map.fitBounds(positions.map(p => [p.lat, p.lng]), { padding: [50, 50] });
  }, [positions, map]);
  return null;
}

const statusColors = {
  pending: 'bg-kraft text-ink', confirmed: 'bg-route/20 text-route', preparing: 'bg-route/30 text-route',
  ready: 'bg-go/20 text-go', in_delivery: 'bg-go/30 text-go', delivered: 'bg-go text-paper',
  cancelled: 'bg-stop/20 text-stop', problem: 'bg-stop/20 text-stop',
};
const statusLabels = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En prépa.', ready: 'Prête',
  in_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée', problem: 'Problème',
};

export default function TourneesTab() {
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
    ]).then(([t, o, d]) => { setTours(t); setOrders(o); setDrivers(d); }).catch(console.error);
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
        <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-go/20 text-go' : 'bg-stop/20 text-stop'}`}>
          {connected ? '● Connecté' : '○ Déconnecté'}
        </span>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90">
              Créer tournée ({selected.length})
            </button>
          )}
          <button onClick={closeDay} className="px-4 py-2 bg-ink text-paper rounded-lg text-sm font-semibold hover:bg-ink/80">
            Clôturer la journée
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-kraft shadow-lg h-56 sm:h-72 md:h-[400px]">
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

      {tours.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length > 0 && (
        <div>
          <h3 className="text-sm font-heading text-ink mb-3">Tournées actives</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tours.filter(t => t.status !== 'completed' && t.status !== 'cancelled').map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-kraft p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-ink text-sm">{t.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'in_progress' ? 'bg-go/20 text-go' : 'bg-kraft text-ink/60'}`}>
                    {t.status === 'planned' ? 'Planifiée' : t.status === 'in_progress' ? 'En cours' : t.status}
                  </span>
                </div>
                <p className="text-xs text-ink/50">{t.driver_first_name} {t.driver_last_name} — {t.order_count} arrêts</p>
                <div className="flex gap-2 mt-3">
                  {t.status === 'planned' && (
                    <button onClick={() => updateTourStatus(t.id, 'in_progress')} className="text-xs px-3 py-1.5 bg-go text-paper rounded-lg font-semibold">Démarrer</button>
                  )}
                  {t.status === 'in_progress' && (
                    <button onClick={() => updateTourStatus(t.id, 'completed')} className="text-xs px-3 py-1.5 bg-ink text-paper rounded-lg font-semibold">Terminer</button>
                  )}
                  <button onClick={() => optimizeTour(t.id)} className="text-xs px-3 py-1.5 bg-route/10 text-route rounded-lg font-semibold">Optimiser</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-heading text-ink mb-3">Commandes par livreur</h3>
        <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto pb-4">
          <div className="w-full sm:flex-shrink-0 sm:w-72 bg-kraft/30 rounded-xl p-3">
            <h4 className="font-semibold text-ink text-sm mb-3 flex items-center justify-between">
              Non assignées <span className="text-xs bg-kraft px-2 py-0.5 rounded-full">{unassigned.length}</span>
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {unassigned.map(o => (
                <div key={o.id} onClick={() => toggleSelect(o.id)}
                  className={`bg-white rounded-lg p-3 border cursor-pointer transition-colors ${selected.includes(o.id) ? 'border-route shadow-sm' : 'border-kraft/50 hover:border-kraft'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-route font-bold">{o.order_number}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[o.status]}`}>{statusLabels[o.status]}</span>
                  </div>
                  <p className="text-sm text-ink mt-1">{o.customer_name}</p>
                  <p className="text-xs text-ink/40 truncate">{o.delivery_address}</p>
                  {selected.includes(o.id) && <span className="text-xs text-route font-semibold mt-1 block">✓ Sélectionnée</span>}
                </div>
              ))}
              {unassigned.length === 0 && <p className="text-xs text-ink/30 text-center py-4">Aucune commande</p>}
            </div>
          </div>

          {drivers.map(d => (
            <div key={d.id} className="w-full sm:flex-shrink-0 sm:w-72 bg-kraft/30 rounded-xl p-3">
              <h4 className="font-semibold text-ink text-sm mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-route/20 flex items-center justify-center text-route text-xs font-bold">
                  {d.firstName[0]}{d.lastName[0]}
                </div>
                {d.firstName} {d.lastName}
                <span className="ml-auto text-xs bg-kraft px-2 py-0.5 rounded-full">{(ordersByDriver[d.id] || []).length}</span>
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(ordersByDriver[d.id] || []).map(o => (
                  <div key={o.id} className="bg-white rounded-lg p-3 border border-kraft/50">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-route font-bold">{o.order_number}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[o.status]}`}>{statusLabels[o.status]}</span>
                    </div>
                    <p className="text-sm text-ink mt-1">{o.customer_name}</p>
                    <p className="text-xs text-ink/40 truncate">{o.delivery_address}</p>
                    {o.stop_order && <p className="text-xs text-route mt-1">Arrêt #{o.stop_order}</p>}
                  </div>
                ))}
                {(ordersByDriver[d.id] || []).length === 0 && <p className="text-xs text-ink/30 text-center py-4">Aucune commande</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-4">Nouvelle tournée</h2>
            <p className="text-sm text-ink/50 mb-4">{selected.length} commande(s) sélectionnée(s)</p>
            <div className="space-y-3">
              <input placeholder="Nom de la tournée" value={tourForm.name}
                onChange={e => setTourForm({ ...tourForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <select value={tourForm.driverId} onChange={e => setTourForm({ ...tourForm, driverId: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
                <option value="">Choisir un livreur</option>
                {drivers.filter(d => d.isActive).map(d => (
                  <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
              <button onClick={createTour} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
