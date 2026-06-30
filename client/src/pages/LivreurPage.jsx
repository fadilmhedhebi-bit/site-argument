import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import 'leaflet/dist/leaflet.css';

const myIcon = new L.DivIcon({
  html: '<div style="background:#E85D2E;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🚗</div>',
  className: '', iconSize: [36, 36], iconAnchor: [18, 18],
});

function makeStopIcon(n) {
  return new L.DivIcon({
    html: `<div style="background:#C8312B;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${n}</div>`,
    className: '', iconSize: [28, 28], iconAnchor: [14, 14],
  });
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) map.fitBounds(positions, { padding: [50, 50] });
  }, [positions, map]);
  return null;
}

const statusLabels = {
  confirmed: 'Confirmée', preparing: 'En prépa.', ready: 'Prête',
  in_delivery: 'En livraison', delivered: 'Livrée', pending: 'En attente',
};

function nextAction(status) {
  switch (status) {
    case 'confirmed': return { label: 'Préparer', next: 'preparing' };
    case 'preparing': return { label: 'Prête', next: 'ready' };
    case 'ready': return { label: 'En livraison', next: 'in_delivery' };
    case 'in_delivery': return { label: 'Livrée ✓', next: 'delivered' };
    default: return null;
  }
}

export default function LivreurPage() {
  const [orders, setOrders] = useState([]);
  const [myPos, setMyPos] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const { token, user } = useAuthStore();
  const socketRef = useRef(null);
  const watchRef = useRef(null);

  const loadOrders = () => {
    api.get(`/orders?driverId=${user.id}&limit=200`).then(setOrders).catch(console.error);
  };

  useEffect(loadOrders, [user.id]);

  useEffect(() => {
    if (!token) return;
    const socket = io(import.meta.env.VITE_API_URL || '/', { auth: { token }, path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('order:status', () => loadOrders());
    socket.on('tour:created', () => loadOrders());

    return () => socket.disconnect();
  }, [token]);

  const startGps = () => {
    if (!navigator.geolocation || !socketRef.current) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPos(p);
        socketRef.current.emit('position:update', {
          latitude: p.lat, longitude: p.lng,
          heading: pos.coords.heading, speed: pos.coords.speed,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setGpsActive(true);
  };

  const stopGps = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setGpsActive(false);
  };

  const updateStatus = async (orderId, status) => {
    try { await api.patch(`/orders/${orderId}/status`, { status }); loadOrders(); } catch (err) { alert(err.message); }
  };

  const activeOrders = orders
    .filter(o => ['confirmed', 'preparing', 'ready', 'in_delivery'].includes(o.status))
    .sort((a, b) => (a.stop_order || 999) - (b.stop_order || 999));

  const deliveredToday = orders.filter(o =>
    o.status === 'delivered' && new Date(o.updated_at).toDateString() === new Date().toDateString()
  );

  const cashTotal = deliveredToday.filter(o => o.payment_method === 'cash').reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const cardTotal = deliveredToday.filter(o => o.payment_method === 'card').reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const voucherTotal = deliveredToday.filter(o => o.payment_method === 'meal_voucher').reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const grandTotal = cashTotal + cardTotal + voucherTotal;

  const stopPositions = activeOrders
    .filter(o => o.delivery_latitude && o.delivery_longitude)
    .map(o => [parseFloat(o.delivery_latitude), parseFloat(o.delivery_longitude)]);
  const allBounds = [...stopPositions];
  if (myPos) allBounds.push([myPos.lat, myPos.lng]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading text-ink">Ma tournée</h1>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-go/20 text-go' : 'bg-stop/20 text-stop'}`}>
            {connected ? '● Connecté' : '○ Déconnecté'}
          </span>
          <button
            onClick={gpsActive ? stopGps : startGps}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${gpsActive ? 'bg-stop text-paper' : 'bg-go text-paper'}`}
          >
            {gpsActive ? '■ Arrêter GPS' : '▶ Partager GPS'}
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-kraft shadow-lg h-56 sm:h-72 md:h-[350px]">
        <MapContainer
          center={myPos ? [myPos.lat, myPos.lng] : [48.8566, 2.3522]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {allBounds.length > 0 && <FitBounds positions={allBounds} />}
          {myPos && (
            <Marker position={[myPos.lat, myPos.lng]} icon={myIcon}>
              <Popup>Ma position</Popup>
            </Marker>
          )}
          {activeOrders.filter(o => o.delivery_latitude && o.delivery_longitude).map((o, i) => (
            <Marker
              key={o.id}
              position={[parseFloat(o.delivery_latitude), parseFloat(o.delivery_longitude)]}
              icon={makeStopIcon(o.stop_order || i + 1)}
            >
              <Popup>
                <strong>{o.order_number}</strong><br />
                {o.customer_name}<br />
                <span style={{ fontSize: '11px' }}>{o.delivery_address}</span>
              </Popup>
            </Marker>
          ))}
          {stopPositions.length > 1 && (
            <Polyline
              positions={myPos ? [[myPos.lat, myPos.lng], ...stopPositions] : stopPositions}
              color="#E85D2E" weight={3} dashArray="8 6"
            />
          )}
        </MapContainer>
      </div>

      <div className="bg-white rounded-xl border border-kraft p-5">
        <h2 className="text-sm font-heading text-ink mb-3">Ma caisse du jour</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-paper rounded-lg p-3 text-center">
            <p className="text-xs text-ink/40">Espèces</p>
            <p className="font-mono text-lg font-bold text-ink">{cashTotal.toFixed(2)} €</p>
          </div>
          <div className="bg-paper rounded-lg p-3 text-center">
            <p className="text-xs text-ink/40">Carte</p>
            <p className="font-mono text-lg font-bold text-ink">{cardTotal.toFixed(2)} €</p>
          </div>
          <div className="bg-paper rounded-lg p-3 text-center">
            <p className="text-xs text-ink/40">Ticket resto</p>
            <p className="font-mono text-lg font-bold text-ink">{voucherTotal.toFixed(2)} €</p>
          </div>
          <div className="bg-route/10 rounded-lg p-3 text-center">
            <p className="text-xs text-route">Total</p>
            <p className="font-mono text-lg font-bold text-route">{grandTotal.toFixed(2)} €</p>
          </div>
        </div>
        <p className="text-xs text-ink/40 mt-2">{deliveredToday.length} livraison(s) effectuée(s) aujourd'hui</p>
      </div>

      <div>
        <h2 className="text-sm font-heading text-ink mb-3">
          Feuille de route ({activeOrders.length} arrêt{activeOrders.length !== 1 ? 's' : ''})
        </h2>
        <div className="space-y-3">
          {activeOrders.map((o, i) => {
            const action = nextAction(o.status);
            return (
              <div key={o.id} className="bg-white rounded-xl border border-kraft p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-route flex items-center justify-center text-paper font-bold text-sm flex-shrink-0 mt-0.5">
                    {o.stop_order || i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-mono text-route font-bold text-sm">{o.order_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        o.status === 'in_delivery' ? 'bg-go/20 text-go' : 'bg-kraft text-ink/60'
                      }`}>{statusLabels[o.status]}</span>
                    </div>
                    <p className="font-semibold text-ink text-sm mt-1">{o.customer_name}</p>
                    <p className="text-xs text-ink/50">{o.delivery_address}</p>
                    {o.customer_phone && <p className="text-xs text-ink/40 mt-0.5">{o.customer_phone}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-mono text-sm text-ink">
                        {parseFloat(o.total || 0).toFixed(2)} € · {
                          o.payment_method === 'cash' ? 'Espèces' :
                          o.payment_method === 'card' ? 'Carte' : 'Ticket resto'
                        }
                      </span>
                      {action && (
                        <button
                          onClick={() => updateStatus(o.id, action.next)}
                          className={`px-4 py-2.5 sm:py-1.5 rounded-lg text-sm sm:text-xs font-semibold ${
                            action.next === 'delivered' ? 'bg-go text-paper' : 'bg-route text-paper'
                          }`}
                        >
                          {action.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {activeOrders.length === 0 && (
            <p className="text-center py-8 text-ink/40">Aucune livraison en cours</p>
          )}
        </div>
      </div>
    </div>
  );
}
