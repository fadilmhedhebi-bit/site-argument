import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../ThemeContext';
import 'leaflet/dist/leaflet.css';

const myIcon = new L.DivIcon({
  html: '<div style="background:#3140A8;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🚗</div>',
  className: '', iconSize: [36, 36], iconAnchor: [18, 18],
});

function makeStopIcon(n) {
  return new L.DivIcon({
    html: `<div style="background:#9472D4;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${n}</div>`,
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
  const { t } = useTheme();
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
        <h1 className="text-2xl font-heading" style={{ color: t.text1 }}>Ma tournée</h1>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-1 rounded-full"
            style={connected
              ? { backgroundColor: t.greenBg, color: t.greenText }
              : { backgroundColor: t.orangeBg, color: t.orangeText }
            }
          >
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

      <div className="rounded-xl overflow-hidden shadow-lg h-56 sm:h-72 md:h-[350px]" style={{ border: `1px solid ${t.border}` }}>
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
              color="#3140A8" weight={3} dashArray="8 6" opacity={0.5}
            />
          )}
        </MapContainer>
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
        <h2 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Ma caisse du jour</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: t.bg }}>
            <p className="text-xs" style={{ color: t.text2 }}>Espèces</p>
            <p className="font-mono text-lg font-bold" style={{ color: t.text1 }}>{cashTotal.toFixed(2)} €</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: t.bg }}>
            <p className="text-xs" style={{ color: t.text2 }}>Carte</p>
            <p className="font-mono text-lg font-bold" style={{ color: t.text1 }}>{cardTotal.toFixed(2)} €</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: t.bg }}>
            <p className="text-xs" style={{ color: t.text2 }}>Ticket resto</p>
            <p className="font-mono text-lg font-bold" style={{ color: t.text1 }}>{voucherTotal.toFixed(2)} €</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: t.accentBg }}>
            <p className="text-xs" style={{ color: t.accent }}>Total</p>
            <p className="font-mono text-lg font-bold" style={{ color: t.accent }}>{grandTotal.toFixed(2)} €</p>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: t.text2 }}>{deliveredToday.length} livraison(s) effectuée(s) aujourd'hui</p>
      </div>

      <div>
        <h2 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>
          Feuille de route ({activeOrders.length} arrêt{activeOrders.length !== 1 ? 's' : ''})
        </h2>
        <div className="space-y-3">
          {activeOrders.map((o, i) => {
            const action = nextAction(o.status);
            return (
              <div key={o.id} className="rounded-xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: t.accent, color: '#fff' }}
                  >
                    {o.stop_order || i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-mono font-bold text-sm" style={{ color: t.accent }}>{o.order_number}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={o.status === 'in_delivery'
                          ? { backgroundColor: t.greenBg, color: t.greenText }
                          : { backgroundColor: t.tabBg, color: t.text2 }
                        }
                      >{statusLabels[o.status]}</span>
                    </div>
                    <p className="font-semibold text-sm mt-1" style={{ color: t.text1 }}>{o.customer_name}</p>
                    <p className="text-xs" style={{ color: t.text2 }}>{o.delivery_address}</p>
                    {o.customer_phone && <p className="text-xs mt-0.5" style={{ color: t.text2 }}>{o.customer_phone}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-mono text-sm" style={{ color: t.text1 }}>
                        {parseFloat(o.total || 0).toFixed(2)} € · {
                          o.payment_method === 'cash' ? 'Espèces' :
                          o.payment_method === 'card' ? 'Carte' : 'Ticket resto'
                        }
                      </span>
                      {action && (
                        <button
                          onClick={() => updateStatus(o.id, action.next)}
                          className={`px-4 py-2.5 sm:py-1.5 rounded-lg text-sm sm:text-xs font-semibold ${
                            action.next === 'delivered' ? 'bg-go text-paper' : ''
                          }`}
                          style={action.next !== 'delivered' ? { backgroundColor: t.accent, color: '#fff' } : undefined}
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
            <p className="text-center py-8" style={{ color: t.text2 }}>Aucune livraison en cours</p>
          )}
        </div>
      </div>
    </div>
  );
}
