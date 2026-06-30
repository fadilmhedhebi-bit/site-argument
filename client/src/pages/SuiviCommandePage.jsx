import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';

const STEPS = [
  { key: 'received', label: 'Commande reçue', statuses: ['pending', 'confirmed'] },
  { key: 'preparing', label: 'En préparation', statuses: ['preparing', 'ready'] },
  { key: 'delivering', label: 'En livraison', statuses: ['in_delivery', 'delivered'] },
];

export default function SuiviCommandePage() {
  const { orderNumber: paramOrder } = useParams();
  const [search, setSearch] = useState(paramOrder || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchOrder = (num) => {
    const orderNum = num || search;
    if (!orderNum) return;
    setLoading(true);
    setError('');
    api.get(`/orders/track/${orderNum.toUpperCase()}`)
      .then(setOrder)
      .catch(err => { setError(err.message); setOrder(null); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (paramOrder) fetchOrder(paramOrder); }, [paramOrder]);

  useEffect(() => {
    if (!order || order.status === 'delivered' || order.status === 'cancelled') return;
    const interval = setInterval(() => fetchOrder(order.order_number), 15000);
    return () => clearInterval(interval);
  }, [order?.order_number, order?.status]);

  const currentStepIndex = order ? STEPS.findIndex(s => s.statuses.includes(order.status)) : -1;
  const isDelivered = order?.status === 'delivered';
  const isCancelled = order?.status === 'cancelled';
  const isProblem = order?.status === 'problem';

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-white border-b border-kraft">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-heading text-ink">Suivi de commande</h1>
          <p className="text-xs text-ink/40">Foodly</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-8">
          <input
            placeholder="CMD-XXXX"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchOrder()}
            className="flex-1 px-4 py-3 border border-kraft rounded-lg bg-white text-sm font-mono uppercase focus:outline-none focus:border-route"
          />
          <button
            onClick={() => fetchOrder()}
            disabled={loading}
            className="px-6 py-3 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90 disabled:opacity-50"
          >
            {loading ? '...' : 'Suivre'}
          </button>
        </div>

        {error && <p className="text-center text-stop mb-4">{error}</p>}

        {order && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-kraft p-6">
              {isCancelled ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-stop/20 flex items-center justify-center text-2xl mx-auto mb-3">✕</div>
                  <p className="font-heading text-stop text-lg">Commande annulée</p>
                </div>
              ) : isProblem ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-stop/20 flex items-center justify-center text-2xl mx-auto mb-3">!</div>
                  <p className="font-heading text-stop text-lg">Problème signalé</p>
                  <p className="text-sm text-ink/50 mt-1">Contactez le restaurant</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    {STEPS.map((step, i) => {
                      const done = isDelivered || i < currentStepIndex;
                      const active = !isDelivered && i === currentStepIndex;
                      return (
                        <div key={step.key} className="flex-1 flex flex-col items-center relative">
                          {i > 0 && (
                            <div className={`absolute top-4 right-1/2 w-full h-0.5 -z-10 ${done || active ? 'bg-go' : 'bg-kraft'}`} />
                          )}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 ${
                            done ? 'bg-go text-paper' : active ? 'bg-route text-paper animate-pulse' : 'bg-kraft text-ink/30'
                          }`}>
                            {done ? '✓' : i + 1}
                          </div>
                          <p className={`text-xs mt-2 text-center ${done || active ? 'text-ink font-semibold' : 'text-ink/30'}`}>
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {isDelivered && (
                    <div className="text-center mt-6">
                      <div className="w-14 h-14 rounded-full bg-go/20 flex items-center justify-center text-2xl mx-auto mb-2">✓</div>
                      <p className="font-heading text-go text-lg">Livrée !</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-white rounded-xl border border-kraft p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-route font-bold text-lg">{order.order_number}</span>
                <span className="text-xs text-ink/40">{new Date(order.created_at).toLocaleString('fr-FR')}</span>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="text-ink/40">Client :</span> {order.customer_name}</p>
                <p><span className="text-ink/40">Adresse :</span> {order.delivery_address}</p>
                {order.driver_first_name && (
                  <p><span className="text-ink/40">Livreur :</span> {order.driver_first_name} {order.driver_last_name}</p>
                )}
              </div>

              {order.items && order.items.length > 0 && (
                <div className="border-t border-kraft mt-3 pt-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span>{item.quantity}× {item.product_name}</span>
                      <span className="font-mono text-ink/60">{parseFloat(item.total_price || item.unit_price * item.quantity).toFixed(2)} €</span>
                    </div>
                  ))}
                  <div className="border-t border-kraft mt-2 pt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-ink/50">
                      <span>Sous-total</span>
                      <span className="font-mono">{parseFloat(order.subtotal).toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-ink/50">
                      <span>Livraison</span>
                      <span className="font-mono">{parseFloat(order.delivery_fee).toFixed(2)} €</span>
                    </div>
                    {parseFloat(order.discount_amount) > 0 && (
                      <div className="flex justify-between text-go">
                        <span>Remise</span>
                        <span className="font-mono">-{parseFloat(order.discount_amount).toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t border-kraft pt-1">
                      <span>Total</span>
                      <span className="font-mono text-route">{parseFloat(order.total).toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-ink/30">Mise à jour automatique toutes les 15 secondes</p>
          </div>
        )}

        {!order && !error && !loading && (
          <div className="text-center py-12 text-ink/30">
            <p className="text-lg mb-2">Entrez votre numéro de commande</p>
            <p className="text-sm">Format : CMD-XXXX</p>
          </div>
        )}
      </main>
    </div>
  );
}
