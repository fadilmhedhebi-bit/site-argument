import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', in_delivery: 'En livraison', delivered: 'Livrée',
  problem: 'Problème', cancelled: 'Annulée',
};

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered'];

export default function TrackOrder() {
  const { orderNumber } = useParams();
  const [search, setSearch] = useState(orderNumber || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const track = async (num) => {
    const n = num || search;
    if (!n) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders/track/${n}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrder(data);
    } catch (err) {
      setError(err.message);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderNumber) track(orderNumber);
  }, [orderNumber]);

  useEffect(() => {
    if (!order) return;
    const interval = setInterval(() => track(order.order_number), 15000);
    return () => clearInterval(interval);
  }, [order?.order_number]);

  const currentStep = order ? STATUS_STEPS.indexOf(order.status) : -1;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink text-paper py-6">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-3xl text-route">Suivi de commande</h1>
          <p className="text-kraft text-sm mt-1">Tournée Snack Express</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-8">
          <input
            placeholder="Numéro de commande (ex: CMD-1001)"
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-3 border border-kraft rounded-lg bg-white focus:outline-none focus:border-route font-mono"
          />
          <button onClick={() => track()} disabled={loading}
            className="px-6 py-3 bg-route text-paper rounded-lg font-semibold hover:bg-route/90 disabled:opacity-50">
            {loading ? '...' : 'Suivre'}
          </button>
        </div>

        {error && <div className="bg-stop/10 text-stop text-sm p-4 rounded-lg mb-6">{error}</div>}

        {order && (
          <div>
            <div className="bg-white rounded-xl border border-kraft p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-2xl text-route font-bold">{order.order_number}</h2>
                <span className="text-sm text-ink/50">{new Date(order.created_at).toLocaleString('fr-FR')}</span>
              </div>

              {/* Timeline */}
              {!['problem', 'cancelled'].includes(order.status) && (
                <div className="flex items-center justify-between mb-8 px-2">
                  {STATUS_STEPS.map((step, i) => (
                    <div key={step} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                          i <= currentStep ? 'bg-go border-go text-paper' : 'bg-paper border-kraft text-ink/30'
                        }`}>
                          {i <= currentStep ? '✓' : i + 1}
                        </div>
                        <span className={`text-xs mt-1 text-center ${i <= currentStep ? 'text-go font-semibold' : 'text-ink/30'}`}>
                          {STATUS_LABELS[step]}
                        </span>
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 ${i < currentStep ? 'bg-go' : 'bg-kraft'}`} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {order.status === 'problem' && (
                <div className="bg-stop/10 border border-stop rounded-lg p-4 mb-4 text-center">
                  <p className="text-stop font-bold">Un problème est survenu avec votre commande</p>
                  <p className="text-sm text-ink/60">Veuillez contacter le restaurant</p>
                </div>
              )}

              {order.status === 'cancelled' && (
                <div className="bg-ink/10 border border-ink/30 rounded-lg p-4 mb-4 text-center">
                  <p className="text-ink font-bold">Commande annulée</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-ink/50 text-xs">Client</p>
                  <p className="font-semibold">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-ink/50 text-xs">Adresse</p>
                  <p>{order.delivery_address}</p>
                </div>
                {order.driver_first_name && (
                  <div>
                    <p className="text-ink/50 text-xs">Livreur</p>
                    <p>{order.driver_first_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-ink/50 text-xs">Total</p>
                  <p className="font-mono text-route font-bold">{parseFloat(order.total).toFixed(2)} €</p>
                </div>
              </div>
            </div>

            {order.items?.length > 0 && (
              <div className="bg-white rounded-xl border border-kraft p-6 mb-6">
                <h3 className="text-sm font-heading text-ink mb-3">Articles</h3>
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-kraft/30 last:border-0">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span className="font-mono">{parseFloat(item.total_price).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}

            {order.history?.length > 0 && (
              <div className="bg-white rounded-xl border border-kraft p-6">
                <h3 className="text-sm font-heading text-ink mb-3">Historique</h3>
                <div className="space-y-3">
                  {order.history.map((h, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-route mt-1.5 shrink-0" />
                      <div>
                        <span className="text-sm font-semibold">{STATUS_LABELS[h.status]}</span>
                        <p className="text-xs text-ink/40">{new Date(h.created_at).toLocaleString('fr-FR')}</p>
                        {h.note && <p className="text-xs text-ink/60">{h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
