import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

export default function HistoriqueTab() {
  const { t } = useTheme();
  const [closings, setClosings] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/closings').then(setClosings).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12" style={{ color: t.text2 }}>Chargement...</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>Historique des clôtures</h3>

      {closings.map(c => {
        const isOpen = expanded === c.id;
        const revTotal = parseFloat(c.revenue_total || 0);
        const revCash = parseFloat(c.revenue_cash || 0);
        const revCard = parseFloat(c.revenue_card || 0);
        const revVoucher = parseFloat(c.revenue_meal_voucher || 0);

        return (
          <div key={c.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
            <button
              onClick={() => setExpanded(isOpen ? null : c.id)}
              className="w-full px-5 py-4 text-left flex items-center justify-between transition-colors hover:opacity-80"
            >
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-heading" style={{ color: t.text1 }}>
                  {new Date(c.closing_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <span className="font-mono font-bold" style={{ color: t.accent }}>{revTotal.toFixed(2)} €</span>
                <span className="text-xs" style={{ color: t.text2 }}>{c.total_orders} cmd</span>
              </div>
              <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: t.text3 }}>▼</span>
            </button>

            {isOpen && (
              <div className="px-5 pb-5" style={{ borderTop: `1px solid ${t.border}` }}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                    <p className="text-xs" style={{ color: t.text2 }}>Livrées</p>
                    <p className="text-xl font-heading" style={{ color: t.greenText }}>{c.total_delivered}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                    <p className="text-xs" style={{ color: t.text2 }}>Annulées</p>
                    <p className="text-xl font-heading" style={{ color: t.orangeText }}>{c.total_cancelled}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                    <p className="text-xs" style={{ color: t.text2 }}>Problèmes</p>
                    <p className="text-xl font-heading" style={{ color: t.orangeText }}>{c.total_problems}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                    <p className="text-xs" style={{ color: t.text2 }}>Total commandes</p>
                    <p className="text-xl font-heading" style={{ color: t.text1 }}>{c.total_orders}</p>
                  </div>
                </div>

                <h4 className="text-sm font-heading mt-4 mb-2" style={{ color: t.text1 }}>Encaissements</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                    <p className="text-xs" style={{ color: t.text2 }}>Espèces</p>
                    <p className="font-mono font-semibold" style={{ color: t.text1 }}>{revCash.toFixed(2)} €</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                    <p className="text-xs" style={{ color: t.text2 }}>Carte</p>
                    <p className="font-mono font-semibold" style={{ color: t.text1 }}>{revCard.toFixed(2)} €</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                    <p className="text-xs" style={{ color: t.text2 }}>Ticket resto</p>
                    <p className="font-mono font-semibold" style={{ color: t.text1 }}>{revVoucher.toFixed(2)} €</p>
                  </div>
                </div>

                {(parseFloat(c.total_discount || 0) > 0 || parseFloat(c.total_delivery_fees || 0) > 0) && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                      <p className="text-xs" style={{ color: t.text2 }}>Remises</p>
                      <p className="font-mono font-semibold" style={{ color: t.orangeText }}>-{parseFloat(c.total_discount).toFixed(2)} €</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
                      <p className="text-xs" style={{ color: t.text2 }}>Frais de livraison</p>
                      <p className="font-mono font-semibold" style={{ color: t.greenText }}>{parseFloat(c.total_delivery_fees).toFixed(2)} €</p>
                    </div>
                  </div>
                )}

                {c.first_name && (
                  <p className="text-xs mt-3" style={{ color: t.text2 }}>Clôturé par {c.first_name} {c.last_name}</p>
                )}
                {c.notes && <p className="text-xs mt-1 italic" style={{ color: t.text3 }}>{c.notes}</p>}
              </div>
            )}
          </div>
        );
      })}

      {closings.length === 0 && (
        <div className="text-center py-12" style={{ color: t.text2 }}>
          <p className="text-lg mb-2">Aucune clôture</p>
          <p className="text-sm">Utilisez le bouton « Clôturer la journée » dans l'onglet Tournées</p>
        </div>
      )}
    </div>
  );
}
