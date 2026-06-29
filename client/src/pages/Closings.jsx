import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Closings() {
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/stats/closings').then(setClosings).catch(console.error);
  useEffect(load, []);

  const closeDay = async () => {
    if (!confirm('Clôturer la journée ?')) return;
    setLoading(true);
    try {
      await api.post('/stats/close-day', {});
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-ink">Clôtures journalières</h1>
        <button onClick={closeDay} disabled={loading}
          className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90 transition-colors disabled:opacity-50">
          {loading ? 'En cours...' : 'Clôturer aujourd\'hui'}
        </button>
      </div>

      <div className="space-y-4">
        {closings.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-kraft p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading text-ink">{new Date(c.closing_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                {c.first_name && <p className="text-xs text-ink/50">Clôturé par {c.first_name} {c.last_name}</p>}
              </div>
              <span className="text-2xl font-heading text-route">{parseFloat(c.revenue_total).toFixed(2)} €</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="bg-paper rounded-lg p-3 text-center">
                <p className="text-ink/50 text-xs">Commandes</p>
                <p className="font-bold text-lg">{c.total_orders}</p>
              </div>
              <div className="bg-paper rounded-lg p-3 text-center">
                <p className="text-ink/50 text-xs">Livrées</p>
                <p className="font-bold text-lg text-go">{c.total_delivered}</p>
              </div>
              <div className="bg-paper rounded-lg p-3 text-center">
                <p className="text-ink/50 text-xs">Annulées</p>
                <p className="font-bold text-lg text-ink/60">{c.total_cancelled}</p>
              </div>
              <div className="bg-paper rounded-lg p-3 text-center">
                <p className="text-ink/50 text-xs">Problèmes</p>
                <p className="font-bold text-lg text-stop">{c.total_problems}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div className="text-center">
                <p className="text-ink/50 text-xs">Espèces</p>
                <p className="font-mono font-semibold">{parseFloat(c.revenue_cash).toFixed(2)} €</p>
              </div>
              <div className="text-center">
                <p className="text-ink/50 text-xs">Carte</p>
                <p className="font-mono font-semibold">{parseFloat(c.revenue_card).toFixed(2)} €</p>
              </div>
              <div className="text-center">
                <p className="text-ink/50 text-xs">Tickets resto</p>
                <p className="font-mono font-semibold">{parseFloat(c.revenue_meal_voucher).toFixed(2)} €</p>
              </div>
            </div>

            {(parseFloat(c.total_discount) > 0 || parseFloat(c.total_delivery_fees) > 0) && (
              <div className="flex gap-6 mt-3 text-xs text-ink/50">
                <span>Réductions: {parseFloat(c.total_discount).toFixed(2)} €</span>
                <span>Frais livraison: {parseFloat(c.total_delivery_fees).toFixed(2)} €</span>
              </div>
            )}

            {c.notes && <p className="mt-3 text-sm text-ink/60 italic">{c.notes}</p>}
          </div>
        ))}
        {closings.length === 0 && <p className="text-center py-8 text-ink/40">Aucune clôture</p>}
      </div>
    </div>
  );
}
