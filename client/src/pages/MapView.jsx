import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

import 'leaflet/dist/leaflet.css';

const driverIcon = new L.DivIcon({
  html: '<div style="background:#E85D2E;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🚗</div>',
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const stopIcon = new L.DivIcon({
  html: '<div style="background:#C8312B;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions.map((p) => [p.lat, p.lng]), { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
}

export default function MapView() {
  const [tours, setTours] = useState([]);
  const [selectedTour, setSelectedTour] = useState(null);
  const [orders, setOrders] = useState([]);
  const [driverPositions, setDriverPositions] = useState({});
  const user = useAuthStore((s) => s.user);
  const wsRef = useRef(null);

  useEffect(() => {
    api.get('/tours').then(setTours).catch(console.error);
    api.get('/orders?status=in_delivery').then(setOrders).catch(console.error);
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', userId: user?.id }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'position') {
        setDriverPositions((prev) => ({
          ...prev,
          [data.driverId]: { lat: data.latitude, lng: data.longitude, name: data.driverName },
        }));
      }
    };

    return () => ws.close();
  }, [user?.id]);

  const deliveryStops = orders
    .filter((o) => o.delivery_latitude && o.delivery_longitude)
    .map((o) => ({
      lat: parseFloat(o.delivery_latitude),
      lng: parseFloat(o.delivery_longitude),
      name: o.customer_name,
      orderNumber: o.order_number,
      address: o.delivery_address,
    }));

  const allPositions = [
    ...Object.values(driverPositions),
    ...deliveryStops,
  ];

  const defaultCenter = [48.8566, 2.3522];

  return (
    <div>
      <h1 className="text-2xl text-ink mb-4">Carte en temps réel</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        {tours.filter((t) => t.status === 'in_progress').map((t) => (
          <button key={t.id} onClick={() => setSelectedTour(t.id === selectedTour ? null : t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              selectedTour === t.id ? 'bg-route text-paper' : 'bg-kraft text-ink hover:bg-kraft/80'
            }`}>
            {t.name || 'Tournée'} - {t.driver_first_name}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden border border-kraft shadow-lg" style={{ height: 500 }}>
        <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {allPositions.length > 0 && <FitBounds positions={allPositions} />}

          {Object.entries(driverPositions).map(([driverId, pos]) => (
            <Marker key={driverId} position={[pos.lat, pos.lng]} icon={driverIcon}>
              <Popup>{pos.name || 'Livreur'}</Popup>
            </Marker>
          ))}

          {deliveryStops.map((stop, i) => (
            <Marker key={i} position={[stop.lat, stop.lng]} icon={stopIcon}>
              <Popup>
                <strong>{stop.orderNumber}</strong><br />
                {stop.name}<br />
                <span className="text-xs">{stop.address}</span>
              </Popup>
            </Marker>
          ))}

          {deliveryStops.length > 1 && (
            <Polyline
              positions={deliveryStops.map((s) => [s.lat, s.lng])}
              color="#E85D2E"
              weight={3}
              dashArray="8 6"
            />
          )}
        </MapContainer>
      </div>

      <div className="mt-4 bg-white rounded-xl border border-kraft p-4">
        <h2 className="text-sm font-heading text-ink mb-3">Livraisons en cours</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map((o) => (
            <div key={o.id} className="p-3 rounded-lg bg-paper border border-kraft/50 text-sm">
              <div className="font-mono text-route font-bold">{o.order_number}</div>
              <div className="text-ink/70">{o.customer_name}</div>
              <div className="text-xs text-ink/50">{o.delivery_address}</div>
              {o.driver_first_name && (
                <div className="text-xs text-go mt-1">🚗 {o.driver_first_name} {o.driver_last_name}</div>
              )}
            </div>
          ))}
          {orders.length === 0 && <p className="text-ink/40 text-sm">Aucune livraison en cours</p>}
        </div>
      </div>
    </div>
  );
}
