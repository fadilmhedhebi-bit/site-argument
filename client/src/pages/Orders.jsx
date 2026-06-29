import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', in_delivery: 'En livraison', delivered: 'Livrée',
  problem: 'Problème', cancelled: 'Annulée',
};

const STATUS_COLORS = {
  pending: 'bg-kraft text-ink', confirmed: 'bg-go/20 text-go', preparing: 'bg-route/20 text-route',
  ready: 'bg-go/20 text-go', in_delivery: 'bg-route/20 text-route', delivered: 'bg-go text-paper',
  problem: 'bg-stop/20 text-stop', cancelled: 'bg-ink/20 text-ink/60',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'manager' || user?.role === 'manager_driver';

  const load = () => {
    const params = filter ? `?status=${filter}` : '';
    api.get(`/orders${params}`).then(setOrders).catch(console.error);
    if (isManager) api.get('/auth/drivers').then(setDrivers).catch(() => {});
  };

  useEffect(load, [filter]);

  const updateStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      load();
      if (selected?.id === orderId) {
        const detail = await api.get(`/orders/${orderId}`);
        setSelected(detail);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const assignDriver = async (orderId, driverId) => {
    try {
      await api.patch(`/orders/${orderId}/assign`, { driverId });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const viewDetail = async (orderId) => {
    const detail = await api.get(`/orders/${orderId}`);
    setSelected(detail);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-ink">Commandes</h1>
        {isManager && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90 transition-colors">
            + Nouvelle commande
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterBtn active={filter === ''} onClick={() => setFilter('')}>Toutes</FilterBtn>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <FilterBtn key={key} active={filter === key} onClick={() => setFilter(key)}>{label}</FilterBtn>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-kraft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-kraft/30">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-ink/70">N°</th>
                <th className="text-left px-4 py-3 font-semibold text-ink/70">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-ink/70">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-ink/70">Livreur</th>
                <th className="text-left px-4 py-3 font-semibold text-ink/70">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-ink/70">Paiement</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-kraft/50 hover:bg-paper/50 cursor-pointer" onClick={() => viewDetail(order.id)}>
                  <td className="px-4 py-3 font-mono text-route font-bold">{order.order_number}</td>
                  <td className="px-4 py-3">
                    <div>{order.customer_name}</div>
                    <div className="text-xs text-ink/50">{order.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {order.driver_first_name ? `${order.driver_first_name} ${order.driver_last_name}` : (
                      isManager && (
                        <select className="text-xs border border-kraft rounded px-2 py-1 bg-paper" onChange={(e) => { e.stopPropagation(); assignDriver(order.id, e.target.value); }} onClick={(e) => e.stopPropagation()} defaultValue="">
                          <option value="" disabled>Assigner</option>
                          {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
                        </select>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">{parseFloat(order.total).toFixed(2)} €</td>
                  <td className="px-4 py-3 text-xs text-ink/50">
                    {order.payment_method === 'cash' ? 'Espèces' : order.payment_method === 'card' ? 'Carte' : 'Ticket resto'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {order.status === 'pending' && <StatusBtn onClick={() => updateStatus(order.id, 'confirmed')} color="go">Confirmer</StatusBtn>}
                      {order.status === 'confirmed' && <StatusBtn onClick={() => updateStatus(order.id, 'preparing')} color="route">Préparer</StatusBtn>}
                      {order.status === 'preparing' && <StatusBtn onClick={() => updateStatus(order.id, 'ready')} color="go">Prêt</StatusBtn>}
                      {order.status === 'ready' && <StatusBtn onClick={() => updateStatus(order.id, 'in_delivery')} color="route">En livraison</StatusBtn>}
                      {order.status === 'in_delivery' && <StatusBtn onClick={() => updateStatus(order.id, 'delivered')} color="go">Livrée</StatusBtn>}
                      {!['delivered', 'cancelled', 'problem'].includes(order.status) && (
                        <StatusBtn onClick={() => updateStatus(order.id, 'problem')} color="stop">!</StatusBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/40">Aucune commande</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? 'bg-route text-paper' : 'bg-kraft/50 text-ink hover:bg-kraft'}`}>
      {children}
    </button>
  );
}

function StatusBtn({ onClick, color, children }) {
  return (
    <button onClick={onClick}
      className={`px-2 py-1 rounded text-xs font-semibold bg-${color}/20 text-${color} hover:bg-${color}/30 transition-colors`}>
      {children}
    </button>
  );
}

function OrderDetail({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-paper rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg text-route font-heading">{order.order_number}</h2>
            <p className="text-sm text-ink/50">{new Date(order.created_at).toLocaleString('fr-FR')}</p>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-ink/50 uppercase mb-1">Client</h3>
            <p className="text-sm">{order.customer_name} - {order.customer_phone}</p>
            <p className="text-xs text-ink/60">{order.delivery_address}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink/50 uppercase mb-1">Articles</h3>
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-kraft/30">
                <span>{item.quantity}x {item.product_name}</span>
                <span className="font-mono">{parseFloat(item.total_price).toFixed(2)} €</span>
              </div>
            ))}
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>Sous-total</span><span className="font-mono">{parseFloat(order.subtotal).toFixed(2)} €</span></div>
              <div className="flex justify-between"><span>Livraison</span><span className="font-mono">{parseFloat(order.delivery_fee).toFixed(2)} €</span></div>
              {parseFloat(order.discount_amount) > 0 && (
                <div className="flex justify-between text-go"><span>Réduction</span><span className="font-mono">-{parseFloat(order.discount_amount).toFixed(2)} €</span></div>
              )}
              <div className="flex justify-between font-bold border-t border-kraft pt-1">
                <span>Total</span><span className="font-mono text-route">{parseFloat(order.total).toFixed(2)} €</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink/50 uppercase mb-1">Historique</h3>
            <div className="space-y-2">
              {order.history?.map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-route mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold">{STATUS_LABELS[h.status] || h.status}</span>
                    {h.first_name && <span className="text-ink/50 ml-2">par {h.first_name}</span>}
                    <p className="text-xs text-ink/40">{new Date(h.created_at).toLocaleString('fr-FR')}</p>
                    {h.note && <p className="text-xs text-ink/60 mt-0.5">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateOrderModal({ onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', deliveryAddress: '', paymentMethod: 'cash', promoCode: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/products').then(setProducts).catch(console.error);
  }, []);

  const addToCart = (product) => {
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      setCart(cart.map((c) => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, price: parseFloat(product.price), quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((c) => c.productId !== productId));
  };

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const submit = async () => {
    if (!form.customerName || !form.customerPhone || !form.deliveryAddress || cart.length === 0) {
      return setError('Remplissez tous les champs et ajoutez des produits');
    }
    setLoading(true);
    try {
      await api.post('/orders', {
        ...form,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-paper rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-heading text-ink">Nouvelle commande</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl">&times;</button>
        </div>

        {error && <div className="bg-stop/10 text-stop text-sm p-3 rounded-lg mb-4">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input placeholder="Nom du client *" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
          <input placeholder="Téléphone *" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
            className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
          <input placeholder="Adresse de livraison *" value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
            className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm md:col-span-2" />
          <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
            <option value="cash">Espèces</option>
            <option value="card">Carte</option>
            <option value="meal_voucher">Ticket restaurant</option>
          </select>
          <input placeholder="Code promo" value={form.promoCode} onChange={(e) => setForm({ ...form, promoCode: e.target.value })}
            className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold text-ink/50 uppercase mb-2">Produits</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {products.filter((p) => p.is_available && p.stock_quantity > 0).map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-2 border border-kraft/50 text-sm">
                  <div>
                    <span>{p.name}</span>
                    <span className="ml-2 font-mono text-route">{parseFloat(p.price).toFixed(2)} €</span>
                  </div>
                  <button onClick={() => addToCart(p)} className="px-2 py-1 bg-go/20 text-go rounded text-xs font-bold">+</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-ink/50 uppercase mb-2">Panier</h3>
            {cart.length === 0 ? <p className="text-sm text-ink/40">Vide</p> : (
              <div className="space-y-2">
                {cart.map((c) => (
                  <div key={c.productId} className="flex items-center justify-between text-sm bg-white rounded-lg p-2 border border-kraft/50">
                    <span>{c.quantity}x {c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{(c.price * c.quantity).toFixed(2)} €</span>
                      <button onClick={() => removeFromCart(c.productId)} className="text-stop text-xs">✕</button>
                    </div>
                  </div>
                ))}
                <div className="text-right font-bold font-mono text-route">Total: {total.toFixed(2)} €</div>
              </div>
            )}
          </div>
        </div>

        <button onClick={submit} disabled={loading}
          className="w-full mt-4 py-3 bg-go text-paper font-semibold rounded-lg hover:bg-go/90 transition-colors disabled:opacity-50">
          {loading ? 'Création...' : 'Créer la commande'}
        </button>
      </div>
    </div>
  );
}
