import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

const statusColors = {
  pending: 'bg-kraft text-ink', confirmed: 'bg-route/20 text-route', preparing: 'bg-route/30 text-route',
  ready: 'bg-go/20 text-go', in_delivery: 'bg-go/30 text-go', delivered: 'bg-go text-paper',
  cancelled: 'bg-stop/20 text-stop', problem: 'bg-stop/20 text-stop',
};
const statusLabels = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En prépa.', ready: 'Prête',
  in_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée', problem: 'Problème',
};
const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered'];

export default function CommandesTab() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('active');
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadOrders = () => {
    api.get('/orders?limit=200').then(setOrders).catch(console.error);
  };

  useEffect(() => {
    loadOrders();
    api.get('/products').then(setProducts).catch(console.error);
    api.get('/auth/drivers').then(setDrivers).catch(console.error);
  }, []);

  const filtered = orders.filter(o => {
    if (filter === 'active') return !['delivered', 'cancelled'].includes(o.status);
    if (filter === 'delivered') return o.status === 'delivered';
    if (filter === 'cancelled') return o.status === 'cancelled';
    return o.status === filter;
  });

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      loadOrders();
      if (detail?.id === id) loadDetail(id);
    } catch (err) { alert(err.message); }
  };

  const assignDriver = async (orderId, driverId) => {
    try {
      await api.patch(`/orders/${orderId}/assign`, { driverId });
      loadOrders();
      if (detail?.id === orderId) loadDetail(orderId);
    } catch (err) { alert(err.message); }
  };

  const deleteOrder = async (id) => {
    if (!confirm('Supprimer cette commande ?')) return;
    try {
      await api.delete(`/orders/${id}`);
      loadOrders();
      if (detail?.id === id) setDetail(null);
    } catch (err) { alert(err.message); }
  };

  const loadDetail = async (id) => {
    try {
      const data = await api.get(`/orders/${id}`);
      setDetail(data);
    } catch (err) { alert(err.message); }
  };

  const nextStatus = (current) => {
    const idx = statusFlow.indexOf(current);
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
          {[
            { id: 'active', label: 'Actives' },
            { id: 'pending', label: 'En attente' },
            { id: 'confirmed', label: 'Confirmées' },
            { id: 'preparing', label: 'En prépa.' },
            { id: 'ready', label: 'Prêtes' },
            { id: 'in_delivery', label: 'Livraison' },
            { id: 'delivered', label: 'Livrées' },
            { id: 'cancelled', label: 'Annulées' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f.id ? 'bg-route text-paper' : 'bg-kraft/50 text-ink hover:bg-kraft'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-go text-paper rounded-lg text-sm font-semibold hover:bg-go/90">
          + Nouvelle commande
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${detail ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-2`}>
          {filtered.length === 0 && (
            <p className="text-center py-8 text-ink/30 text-sm">Aucune commande</p>
          )}
          {filtered.map(o => (
            <div key={o.id} onClick={() => loadDetail(o.id)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-colors hover:border-route ${
                detail?.id === o.id ? 'border-route shadow-sm' : 'border-kraft'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-route font-bold">{o.order_number}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[o.status]}`}>
                    {statusLabels[o.status]}
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-ink">{parseFloat(o.total).toFixed(2)} €</span>
              </div>
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>{o.customer_name} — {o.customer_phone}</span>
                <span>{new Date(o.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {o.delivery_address && (
                <p className="text-xs text-ink/40 mt-1 truncate">{o.delivery_address}</p>
              )}
              <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {o.driver_first_name ? (
                    <span className="text-xs bg-route/10 text-route px-2 py-1 rounded-full">
                      {o.driver_first_name} {o.driver_last_name}
                    </span>
                  ) : (
                    <select onClick={e => e.stopPropagation()}
                      onChange={e => { if (e.target.value) assignDriver(o.id, e.target.value); }}
                      value="" className="text-xs bg-kraft/50 text-ink rounded-lg px-2 py-2 border-none">
                      <option value="">Assigner livreur</option>
                      {drivers.filter(d => d.isActive).map(d => (
                        <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                  {nextStatus(o.status) && (
                    <button onClick={() => updateStatus(o.id, nextStatus(o.status))}
                      className="text-xs px-3 py-1.5 bg-go/20 text-go rounded-lg font-semibold hover:bg-go/30">
                      {statusLabels[nextStatus(o.status)]}
                    </button>
                  )}
                  {!['delivered', 'cancelled'].includes(o.status) && (
                    <button onClick={() => updateStatus(o.id, 'cancelled')}
                      className="text-xs px-3 py-1.5 bg-stop/10 text-stop rounded-lg font-semibold hover:bg-stop/20">
                      Annuler
                    </button>
                  )}
                  {o.status === 'pending' && (
                    <button onClick={() => deleteOrder(o.id)}
                      className="text-xs px-3 py-1.5 bg-stop/10 text-stop rounded-lg font-semibold hover:bg-stop/20">
                      Suppr.
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {detail && (
          <div className="fixed inset-0 bg-ink/40 z-40 lg:static lg:bg-transparent lg:col-span-1" onClick={() => setDetail(null)}>
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white p-5 overflow-y-auto lg:static lg:max-w-none lg:rounded-xl lg:border lg:border-kraft lg:sticky lg:top-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-route font-bold">{detail.order_number}</h3>
                <button onClick={() => setDetail(null)} className="text-ink/30 hover:text-ink text-2xl p-1">&times;</button>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[detail.status]}`}>
                {statusLabels[detail.status]}
              </span>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[10px] text-ink/40 uppercase tracking-wide">Client</p>
                  <p className="text-sm text-ink font-semibold">{detail.customer_name}</p>
                  <p className="text-xs text-ink/60">{detail.customer_phone}</p>
                  {detail.customer_email && <p className="text-xs text-ink/60">{detail.customer_email}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-ink/40 uppercase tracking-wide">Adresse</p>
                  <p className="text-xs text-ink/60">{detail.delivery_address}</p>
                  {detail.delivery_notes && <p className="text-xs text-ink/40 italic mt-0.5">{detail.delivery_notes}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-ink/40 uppercase tracking-wide mb-1">Articles</p>
                  {detail.items?.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-ink py-0.5">
                      <span>{it.quantity}x {it.product_name}</span>
                      <span className="font-mono">{parseFloat(it.total_price).toFixed(2)} €</span>
                    </div>
                  ))}
                  <div className="border-t border-kraft mt-2 pt-2 space-y-0.5 text-xs">
                    <div className="flex justify-between text-ink/50">
                      <span>Sous-total</span><span className="font-mono">{parseFloat(detail.subtotal).toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-ink/50">
                      <span>Livraison</span><span className="font-mono">{parseFloat(detail.delivery_fee).toFixed(2)} €</span>
                    </div>
                    {parseFloat(detail.discount_amount) > 0 && (
                      <div className="flex justify-between text-go">
                        <span>Remise</span><span className="font-mono">-{parseFloat(detail.discount_amount).toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-ink border-t border-kraft pt-1">
                      <span>Total</span><span className="font-mono text-route">{parseFloat(detail.total).toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-ink/40 uppercase tracking-wide">Paiement</p>
                  <p className="text-xs text-ink/60">
                    {{ cash: 'Espèces', card: 'Carte', meal_voucher: 'Ticket resto' }[detail.payment_method] || detail.payment_method}
                    {' — '}
                    {{ pending: 'En attente', paid: 'Payé', refunded: 'Remboursé' }[detail.payment_status] || detail.payment_status}
                  </p>
                </div>
                {detail.history?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-ink/40 uppercase tracking-wide mb-1">Historique</p>
                    <div className="space-y-1">
                      {detail.history.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className={`px-1.5 py-0.5 rounded ${statusColors[h.status]}`}>{statusLabels[h.status]}</span>
                          <span className="text-ink/40">
                            {new Date(h.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {h.first_name && <span className="text-ink/40">par {h.first_name}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateOrderModal
          products={products}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadOrders(); }}
        />
      )}
    </div>
  );
}

function CreateOrderModal({ products, onClose, onCreated }) {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    deliveryAddress: '', deliveryNotes: '', paymentMethod: 'cash',
  });
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const available = products.filter(p => p.is_available && p.stock_quantity > 0);
  const searchFiltered = search
    ? available.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : available;

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) return prev.map(c => c.id === product.id ? { ...c, qty: Math.min(c.qty + 1, product.stock_quantity) } : c);
      return [...prev, { id: product.id, name: product.name, price: parseFloat(product.price), qty: 1, maxStock: product.stock_quantity }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const next = c.qty + delta;
      if (next <= 0) return null;
      return { ...c, qty: Math.min(next, c.maxStock) };
    }).filter(Boolean));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const deliveryFee = 2.50;
  const total = subtotal + deliveryFee;

  const submit = async () => {
    if (!form.customerName.trim()) return alert('Nom du client requis');
    if (!form.customerPhone.trim()) return alert('Téléphone requis');
    if (!form.deliveryAddress.trim()) return alert('Adresse de livraison requise');
    if (cart.length === 0) return alert('Ajoutez au moins un article');

    setSubmitting(true);
    try {
      await api.post('/orders', {
        ...form,
        items: cart.map(c => ({ productId: c.id, quantity: c.qty })),
      });
      onCreated();
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-paper rounded-xl shadow-xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-kraft">
          <h2 className="text-lg font-heading text-ink">Nouvelle commande</h2>
          <button onClick={onClose} className="text-ink/30 hover:text-ink text-xl">&times;</button>
        </div>

        <div className="p-5 space-y-5 max-h-[85vh] sm:max-h-[70vh] overflow-y-auto">
          <div>
            <h3 className="text-sm font-semibold text-ink mb-2">Produits</h3>
            <input placeholder="Rechercher un produit..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-kraft rounded-lg bg-paper text-sm mb-2 focus:outline-none focus:border-route" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {searchFiltered.map(p => {
                const inCart = cart.find(c => c.id === p.id);
                return (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${
                      inCart ? 'border-route bg-route/5' : 'border-kraft hover:border-route/50'
                    }`}>
                    <p className="text-xs font-semibold text-ink truncate">{p.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-xs text-route font-bold">{parseFloat(p.price).toFixed(2)} €</span>
                      {inCart && <span className="text-[10px] bg-route text-paper px-1.5 rounded-full font-bold">{inCart.qty}</span>}
                      {!inCart && <span className="text-[10px] text-ink/30">stock: {p.stock_quantity}</span>}
                    </div>
                  </button>
                );
              })}
              {searchFiltered.length === 0 && <p className="col-span-full text-xs text-ink/30 text-center py-4">Aucun produit trouvé</p>}
            </div>
          </div>

          {cart.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Panier</h3>
              <div className="space-y-1.5">
                {cart.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-kraft/20 rounded-lg px-3 py-2">
                    <span className="text-sm text-ink flex-1 min-w-0 truncate">{c.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateQty(c.id, -1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-kraft text-ink text-xs font-bold">−</button>
                      <span className="font-mono text-sm w-5 text-center">{c.qty}</span>
                      <button onClick={() => updateQty(c.id, 1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-kraft text-ink text-xs font-bold">+</button>
                      <span className="font-mono text-sm text-ink w-16 text-right">{(c.price * c.qty).toFixed(2)} €</span>
                      <button onClick={() => removeFromCart(c.id)} className="text-stop/60 hover:text-stop text-sm ml-1">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-kraft mt-2 pt-2 text-sm space-y-0.5">
                <div className="flex justify-between text-ink/50"><span>Sous-total</span><span className="font-mono">{subtotal.toFixed(2)} €</span></div>
                <div className="flex justify-between text-ink/50"><span>Livraison</span><span className="font-mono">{deliveryFee.toFixed(2)} €</span></div>
                <div className="flex justify-between font-bold text-ink"><span>Total</span><span className="font-mono text-route">{total.toFixed(2)} €</span></div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-ink mb-2">Informations client</h3>
            <div className="space-y-2">
              <input placeholder="Nom complet *" value={form.customerName}
                onChange={e => setForm({ ...form, customerName: e.target.value })}
                className="w-full px-3 py-2 border border-kraft rounded-lg bg-paper text-sm focus:outline-none focus:border-route" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input placeholder="Téléphone *" value={form.customerPhone}
                  onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                  className="px-3 py-2 border border-kraft rounded-lg bg-paper text-sm focus:outline-none focus:border-route" />
                <input placeholder="Email" type="email" value={form.customerEmail}
                  onChange={e => setForm({ ...form, customerEmail: e.target.value })}
                  className="px-3 py-2 border border-kraft rounded-lg bg-paper text-sm focus:outline-none focus:border-route" />
              </div>
              <input placeholder="Adresse de livraison *" value={form.deliveryAddress}
                onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                className="w-full px-3 py-2 border border-kraft rounded-lg bg-paper text-sm focus:outline-none focus:border-route" />
              <textarea placeholder="Notes (étage, code, etc.)" value={form.deliveryNotes}
                onChange={e => setForm({ ...form, deliveryNotes: e.target.value })}
                className="w-full px-3 py-2 border border-kraft rounded-lg bg-paper text-sm focus:outline-none focus:border-route" rows={2} />
              <div>
                <p className="text-xs text-ink/50 mb-1.5">Mode de paiement</p>
                <div className="flex gap-2">
                  {[{ v: 'cash', l: 'Espèces' }, { v: 'card', l: 'Carte' }, { v: 'meal_voucher', l: 'Ticket resto' }].map(m => (
                    <button key={m.v} onClick={() => setForm({ ...form, paymentMethod: m.v })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        form.paymentMethod === m.v ? 'bg-route text-paper' : 'bg-kraft/50 text-ink hover:bg-kraft'
                      }`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-kraft">
          <button onClick={onClose} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
          <button onClick={submit} disabled={submitting || cart.length === 0}
            className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm disabled:opacity-50">
            {submitting ? 'Création...' : `Créer · ${total.toFixed(2)} €`}
          </button>
        </div>
      </div>
    </div>
  );
}
