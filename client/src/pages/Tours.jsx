import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

const STATUS_LABELS = { planned: 'Planifiée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée' };
const STATUS_COLORS = { planned: 'bg-kraft text-ink', in_progress: 'bg-route/20 text-route', completed: 'bg-go/20 text-go', cancelled: 'bg-ink/20 text-ink/60' };

export default function Tours() {
  const [tours, setTours] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'manager' || user?.role === 'manager_driver';

  const load = () => api.get('/tours').then(setTours).catch(console.error);
  useEffect(load, []);

  const updateStatus = async (tourId, status) => {
    await api.patch(`/tours/${tourId}/status`, { status });
    load();
  };

  const optimize = async (tourId) => {
    try {
      await api.post(`/tours/${tourId}/optimize`);
      load();
      alert('Itinéraire optimisé !');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-ink">Tournées</h1>
        {isManager && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90 transition-colors">
            + Nouvelle tournée
          </button>
        )}
      </div>

      <div className="space-y-4">
        {tours.map((tour) => (
          <div key={tour.id} className="bg-white rounded-xl border border-kraft p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading text-ink">{tour.name || 'Tournée'}</h3>
                <p className="text-sm text-ink/60">
                  {tour.driver_first_name} {tour.driver_last_name} - {tour.order_count} arrêt(s)
                </p>
                <p className="text-xs text-ink/40">{new Date(tour.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[tour.status]}`}>
                  {STATUS_LABELS[tour.status]}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {tour.status === 'planned' && (
                <>
                  <button onClick={() => updateStatus(tour.id, 'in_progress')}
                    className="px-3 py-1.5 bg-go/20 text-go rounded text-xs font-semibold">Démarrer</button>
                  {isManager && (
                    <button onClick={() => optimize(tour.id)}
                      className="px-3 py-1.5 bg-route/20 text-route rounded text-xs font-semibold">Optimiser</button>
                  )}
                </>
              )}
              {tour.status === 'in_progress' && (
                <button onClick={() => updateStatus(tour.id, 'completed')}
                  className="px-3 py-1.5 bg-go/20 text-go rounded text-xs font-semibold">Terminer</button>
              )}
              {['planned', 'in_progress'].includes(tour.status) && (
                <button onClick={() => updateStatus(tour.id, 'cancelled')}
                  className="px-3 py-1.5 bg-stop/20 text-stop rounded text-xs font-semibold">Annuler</button>
              )}
            </div>
          </div>
        ))}
        {tours.length === 0 && <p className="text-center py-8 text-ink/40">Aucune tournée</p>}
      </div>

      {showCreate && <CreateTourModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateTourModal({ onClose, onCreated }) {
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ driverId: '', name: '', orderIds: [], startLatitude: '', startLongitude: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/drivers').then(setDrivers).catch(console.error);
    api.get('/orders?status=confirmed').then((data) => {
      const ready = data.filter((o) => !o.tour_id);
      setOrders(ready);
    }).catch(console.error);
  }, []);

  const toggleOrder = (id) => {
    setForm((f) => ({
      ...f,
      orderIds: f.orderIds.includes(id) ? f.orderIds.filter((x) => x !== id) : [...f.orderIds, id],
    }));
  };

  const submit = async () => {
    if (!form.driverId || form.orderIds.length === 0) return alert('Sélectionnez un livreur et des commandes');
    setLoading(true);
    try {
      await api.post('/tours', form);
      onCreated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const useMyPosition = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setForm((f) => ({ ...f, startLatitude: pos.coords.latitude, startLongitude: pos.coords.longitude }));
    });
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-paper rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-heading text-ink mb-4">Nouvelle tournée</h2>
        <div className="space-y-4">
          <input placeholder="Nom de la tournée" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />

          <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
            <option value="">Choisir un livreur</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
          </select>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ink/50 uppercase">Point de départ (optionnel)</label>
              <button onClick={useMyPosition} className="text-xs text-route hover:underline">Ma position</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Latitude" type="number" step="any" value={form.startLatitude} onChange={(e) => setForm({ ...form, startLatitude: e.target.value })}
                className="px-3 py-2 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input placeholder="Longitude" type="number" step="any" value={form.startLongitude} onChange={(e) => setForm({ ...form, startLongitude: e.target.value })}
                className="px-3 py-2 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink/50 uppercase mb-2 block">Commandes confirmées</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {orders.map((o) => (
                <label key={o.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-kraft/50 cursor-pointer hover:border-route text-sm">
                  <input type="checkbox" checked={form.orderIds.includes(o.id)} onChange={() => toggleOrder(o.id)} className="accent-route" />
                  <div>
                    <span className="font-mono text-route">{o.order_number}</span>
                    <span className="ml-2 text-ink/70">{o.customer_name}</span>
                    <span className="block text-xs text-ink/50">{o.delivery_address}</span>
                  </div>
                </label>
              ))}
              {orders.length === 0 && <p className="text-sm text-ink/40">Aucune commande confirmée disponible</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm disabled:opacity-50">
            {loading ? 'Création...' : 'Créer la tournée'}
          </button>
        </div>
      </div>
    </div>
  );
}
