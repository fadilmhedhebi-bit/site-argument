import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function HistoriqueTab() {
  const [closings, setClosings] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/closings').then(setClosings).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-ink/40">Chargement...</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-heading text-ink mb-4">Historique des clôtures</h3>

      {closings.map(c => {
        const isOpen = expanded === c.id;
        const revTotal = parseFloat(c.revenue_total || 0);
        const revCash = parseFloat(c.revenue_cash || 0);
        const revCard = parseFloat(c.revenue_card || 0);
        const revVoucher = parseFloat(c.revenue_meal_voucher || 0);

        return (
          <div key={c.id} className="bg-white rounded-xl border border-kraft overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : c.id)}
              className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-kraft/10 transition-colors"
            >
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-heading text-ink">
                  {new Date(c.closing_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <span className="font-mono text-route font-bold">{revTotal.toFixed(2)} €</span>
                <span className="text-xs text-ink/40">{c.total_orders} cmd</span>
              </div>
              <span className={`text-ink/30 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 border-t border-kraft/30">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div className="bg-paper rounded-lg p-3">
                    <p className="text-xs text-ink/40">Livrées</p>
                    <p className="text-xl font-heading text-go">{c.total_delivered}</p>
                  </div>
                  <div className="bg-paper rounded-lg p-3">
                    <p className="text-xs text-ink/40">Annulées</p>
                    <p className="text-xl font-heading text-stop">{c.total_cancelled}</p>
                  </div>
                  <div className="bg-paper rounded-lg p-3">
                    <p className="text-xs text-ink/40">Problèmes</p>
                    <p className="text-xl font-heading text-stop">{c.total_problems}</p>
                  </div>
                  <div className="bg-paper rounded-lg p-3">
                    <p className="text-xs text-ink/40">Total commandes</p>
                    <p className="text-xl font-heading text-ink">{c.total_orders}</p>
                  </div>
                </div>

                <h4 className="text-sm font-heading text-ink mt-4 mb-2">Encaissements</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-paper rounded-lg p-3">
                    <p className="text-xs text-ink/40">Espèces</p>
                    <p className="font-mono text-ink font-semibold">{revCash.toFixed(2)} €</p>
                  </div>
                  <div className="bg-paper rounded-lg p-3">
                    <p className="text-xs text-ink/40">Carte</p>
                    <p className="font-mono text-ink font-semibold">{revCard.toFixed(2)} €</p>
                  </div>
                  <div className="bg-paper rounded-lg p-3">
                    <p className="text-xs text-ink/40">Ticket resto</p>
                    <p className="font-mono text-ink font-semibold">{revVoucher.toFixed(2)} €</p>
                  </div>
                </div>

                {(parseFloat(c.total_discount || 0) > 0 || parseFloat(c.total_delivery_fees || 0) > 0) && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-paper rounded-lg p-3">
                      <p className="text-xs text-ink/40">Remises</p>
                      <p className="font-mono text-stop font-semibold">-{parseFloat(c.total_discount).toFixed(2)} €</p>
                    </div>
                    <div className="bg-paper rounded-lg p-3">
                      <p className="text-xs text-ink/40">Frais de livraison</p>
                      <p className="font-mono text-go font-semibold">{parseFloat(c.total_delivery_fees).toFixed(2)} €</p>
                    </div>
                  </div>
                )}

                {c.first_name && (
                  <p className="text-xs text-ink/40 mt-3">Clôturé par {c.first_name} {c.last_name}</p>
                )}
                {c.notes && <p className="text-xs text-ink/50 mt-1 italic">{c.notes}</p>}
              </div>
            )}
          </div>
        );
      })}

      {closings.length === 0 && (
        <div className="text-center py-12 text-ink/40">
          <p className="text-lg mb-2">Aucune clôture</p>
          <p className="text-sm">Utilisez le bouton « Clôturer la journée » dans l'onglet Tournées</p>
        </div>
      )}
    </div>
  );
}
