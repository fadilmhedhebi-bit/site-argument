import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

function useStatusStyles() {
  const { t } = useTheme();
  return {
    pending: { backgroundColor: t.tabBg, color: t.text2 },
    confirmed: { backgroundColor: t.blueBg, color: t.blueText },
    preparing: { backgroundColor: t.blueBg, color: t.blueText },
    ready: { backgroundColor: t.greenBg, color: t.greenText },
    in_delivery: { backgroundColor: t.greenBg, color: t.greenText },
    delivered: { backgroundColor: t.greenText, color: '#fff' },
    cancelled: { backgroundColor: t.orangeBg, color: t.orangeText },
    problem: { backgroundColor: t.orangeBg, color: t.orangeText },
  };
}
const statusLabels = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En prépa.', ready: 'Prête',
  in_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée', problem: 'Problème',
};
const orderTypeLabels = { dine_in: 'Sur place', takeaway: 'Emporter', delivery: 'Livraison' };
const statusFlowByType = {
  dine_in: ['preparing', 'ready'],
  takeaway: ['preparing', 'ready'],
  delivery: ['preparing', 'in_delivery'],
};

export default function CommandesTab() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [businessDeliveryFee, setBusinessDeliveryFee] = useState(0);
  const { t } = useTheme();
  const statusStyles = useStatusStyles();

  const loadOrders = () => {
    api.get('/orders?limit=200').then(setOrders).catch(console.error);
  };

  useEffect(() => {
    loadOrders();
    api.get('/products').then(setProducts).catch(console.error);
    api.get('/auth/drivers').then(setDrivers).catch(console.error);
    api.get('/auth/business/delivery-fee').then(data => setBusinessDeliveryFee(data.deliveryFee)).catch(console.error);
  }, []);

  const activeOrders = orders.filter(o => {
    if (['delivered', 'cancelled'].includes(o.status)) return false;
    if (['dine_in', 'takeaway'].includes(o.order_type) && o.status === 'ready') return false;
    return true;
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

  const nextStatus = (current, orderType) => {
    const flow = statusFlowByType[orderType] || statusFlowByType.delivery;
    const idx = flow.indexOf(current);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-heading" style={{ color: t.text1 }}>
          Commandes actives ({activeOrders.length})
        </h2>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-go text-paper rounded-lg text-sm font-semibold hover:bg-go/90">
          + Nouvelle commande
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${detail ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-2`}>
          {activeOrders.length === 0 && (
            <p className="text-center py-8 text-ink/30 text-sm">Aucune commande active</p>
          )}
          {activeOrders.map(o => (
            <div key={o.id} onClick={() => loadDetail(o.id)}
              className="rounded-xl p-4 cursor-pointer transition-colors"
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${detail?.id === o.id ? t.accent : t.border}`,
                boxShadow: detail?.id === o.id ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
              }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold" style={{ color: t.accent }}>{o.order_number}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={statusStyles[o.status]}>
                    {statusLabels[o.status]}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      backgroundColor: o.order_type === 'delivery' ? t.blueBg : o.order_type === 'dine_in' ? t.greenBg : t.orangeBg,
                      color: o.order_type === 'delivery' ? t.blueText : o.order_type === 'dine_in' ? t.greenText : t.orangeText,
                    }}>
                    {orderTypeLabels[o.order_type] || 'Livraison'}
                  </span>
                </div>
                <span className="font-mono text-sm font-bold" style={{ color: t.text1 }}>{parseFloat(o.total).toFixed(2)} €</span>
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: t.text2 }}>
                <span>{o.customer_name} — {o.customer_phone}</span>
                <span>{new Date(o.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {o.order_type === 'dine_in' && o.table_number && (
                <p className="text-xs mt-1" style={{ color: t.accent }}>Table {o.table_number}</p>
              )}
              {o.order_type === 'delivery' && o.delivery_address && (
                <p className="text-xs mt-1 truncate" style={{ color: t.text3 }}>{o.delivery_address}</p>
              )}
              <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {o.order_type === 'delivery' && (
                    o.driver_first_name ? (
                      <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: t.accentBg, color: t.accent }}>
                        {o.driver_first_name} {o.driver_last_name}
                      </span>
                    ) : (
                      <select onClick={e => e.stopPropagation()}
                        onChange={e => { if (e.target.value) assignDriver(o.id, e.target.value); }}
                        value="" className="text-xs rounded-lg px-2 py-2 border-none"
                        style={{ backgroundColor: t.tabBg, color: t.text1 }}>
                        <option value="">Assigner livreur</option>
                        {drivers.filter(d => d.isActive).map(d => (
                          <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                        ))}
                      </select>
                    )
                  )}
                </div>
                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                  {nextStatus(o.status, o.order_type) && (
                    <button onClick={() => updateStatus(o.id, nextStatus(o.status, o.order_type))}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ backgroundColor: t.greenBg, color: t.greenText }}>
                      {statusLabels[nextStatus(o.status, o.order_type)]}
                    </button>
                  )}
                  {!['delivered', 'cancelled'].includes(o.status) && (
                    <button onClick={() => updateStatus(o.id, 'cancelled')}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ backgroundColor: t.orangeBg, color: t.orangeText }}>
                      Annuler
                    </button>
                  )}
                  {o.status === 'pending' && (
                    <button onClick={() => deleteOrder(o.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ backgroundColor: t.orangeBg, color: t.orangeText }}>
                      Suppr.
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {detail && (
          <div className="fixed inset-0 z-40 lg:static lg:bg-transparent lg:col-span-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setDetail(null)}>
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm p-5 overflow-y-auto lg:static lg:max-w-none lg:rounded-xl lg:sticky lg:top-4"
              style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono font-bold" style={{ color: t.accent }}>{detail.order_number}</h3>
                <button onClick={() => setDetail(null)} className="text-2xl p-1" style={{ color: t.text3 }}>&times;</button>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs px-2 py-0.5 rounded-full" style={statusStyles[detail.status]}>
                  {statusLabels[detail.status]}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    backgroundColor: detail.order_type === 'delivery' ? t.blueBg : detail.order_type === 'dine_in' ? t.greenBg : t.orangeBg,
                    color: detail.order_type === 'delivery' ? t.blueText : detail.order_type === 'dine_in' ? t.greenText : t.orangeText,
                  }}>
                  {orderTypeLabels[detail.order_type] || 'Livraison'}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: t.text3 }}>Client</p>
                  <p className="text-sm font-semibold" style={{ color: t.text1 }}>{detail.customer_name}</p>
                  <p className="text-xs" style={{ color: t.text2 }}>{detail.customer_phone}</p>
                  {detail.customer_email && <p className="text-xs" style={{ color: t.text2 }}>{detail.customer_email}</p>}
                </div>
                {detail.order_type === 'dine_in' && detail.table_number && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: t.text3 }}>Table</p>
                    <p className="text-sm font-semibold" style={{ color: t.accent }}>Table {detail.table_number}</p>
                  </div>
                )}
                {detail.order_type === 'delivery' && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: t.text3 }}>Adresse</p>
                    <p className="text-xs" style={{ color: t.text2 }}>{detail.delivery_address}</p>
                    {detail.delivery_notes && <p className="text-xs italic mt-0.5" style={{ color: t.text3 }}>{detail.delivery_notes}</p>}
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: t.text3 }}>Articles</p>
                  {detail.items?.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5" style={{ color: t.text1 }}>
                      <span>{it.quantity}x {it.product_name}</span>
                      <span className="font-mono">{parseFloat(it.total_price).toFixed(2)} €</span>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 space-y-0.5 text-xs" style={{ borderTop: `1px solid ${t.border}` }}>
                    <div className="flex justify-between" style={{ color: t.text2 }}>
                      <span>Sous-total</span><span className="font-mono">{parseFloat(detail.subtotal).toFixed(2)} €</span>
                    </div>
                    {parseFloat(detail.delivery_fee) > 0 && (
                      <div className="flex justify-between" style={{ color: t.text2 }}>
                        <span>Livraison</span><span className="font-mono">{parseFloat(detail.delivery_fee).toFixed(2)} €</span>
                      </div>
                    )}
                    {parseFloat(detail.discount_amount) > 0 && (
                      <div className="flex justify-between" style={{ color: t.greenText }}>
                        <span>Remise</span><span className="font-mono">-{parseFloat(detail.discount_amount).toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-1" style={{ color: t.text1, borderTop: `1px solid ${t.border}` }}>
                      <span>Total</span><span className="font-mono" style={{ color: t.accent }}>{parseFloat(detail.total).toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: t.text3 }}>Paiement</p>
                  <p className="text-xs" style={{ color: t.text2 }}>
                    {{ cash: 'Espèces', card: 'Carte', meal_voucher: 'Ticket resto' }[detail.payment_method] || detail.payment_method}
                    {' — '}
                    {{ pending: 'En attente', paid: 'Payé', refunded: 'Remboursé' }[detail.payment_status] || detail.payment_status}
                  </p>
                </div>
                {detail.history?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: t.text3 }}>Historique</p>
                    <div className="space-y-1">
                      {detail.history.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className="px-1.5 py-0.5 rounded" style={statusStyles[h.status]}>{statusLabels[h.status]}</span>
                          <span style={{ color: t.text3 }}>
                            {new Date(h.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {h.first_name && <span style={{ color: t.text3 }}>par {h.first_name}</span>}
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
          businessDeliveryFee={businessDeliveryFee}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadOrders(); }}
        />
      )}
    </div>
  );
}

function CreateOrderModal({ products, businessDeliveryFee = 0, onClose, onCreated }) {
  const { t } = useTheme();
  const [step, setStep] = useState('type');
  const [orderType, setOrderType] = useState(null);
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    deliveryAddress: '', deliveryNotes: '', paymentMethod: 'cash',
    tableNumber: '',
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const available = products.filter(p => p.is_available && p.stock_quantity > 0);
  const categories = [...new Set(available.map(p => p.category_name).filter(Boolean))];
  const searchFiltered = available.filter(p => {
    if (selectedCategory && p.category_name !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
  const deliveryFee = orderType === 'delivery' ? businessDeliveryFee : 0;
  const total = subtotal + deliveryFee;

  const submit = async () => {
    if (!form.customerName.trim()) return alert('Nom du client requis');
    if (!form.customerPhone.trim()) return alert('Telephone requis');
    if (orderType === 'delivery' && !form.deliveryAddress.trim()) return alert('Adresse de livraison requise');
    if (orderType === 'dine_in' && !form.tableNumber.trim()) return alert('Numero de table requis');
    if (cart.length === 0) return alert('Ajoutez au moins un article');

    setSubmitting(true);
    try {
      await api.post('/orders', {
        ...form,
        orderType,
        tableNumber: orderType === 'dine_in' ? form.tableNumber : undefined,
        deliveryAddress: orderType === 'delivery' ? form.deliveryAddress : undefined,
        deliveryNotes: orderType === 'delivery' ? form.deliveryNotes : undefined,
        items: cart.map(c => ({ productId: c.id, quantity: c.qty })),
      });
      onCreated();
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const typeOptions = [
    { id: 'dine_in', label: 'Sur place', desc: 'Le client mange au restaurant', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
      </svg>
    )},
    { id: 'takeaway', label: 'Emporter', desc: 'Le client emporte sa commande', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    )},
    { id: 'delivery', label: 'Livraison', desc: businessDeliveryFee > 0 ? `Livraison a domicile (+${businessDeliveryFee.toFixed(2)} EUR)` : 'Livraison a domicile', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    )},
  ];

  if (step === 'type') {
    return (
      <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="rounded-xl shadow-xl w-full max-w-md" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${t.border}` }}>
            <h2 className="text-lg font-heading" style={{ color: t.text1 }}>Nouvelle commande</h2>
            <button onClick={onClose} className="text-xl p-1" style={{ color: t.text3 }}>&times;</button>
          </div>
          <div className="p-5">
            <p className="text-sm mb-4" style={{ color: t.text2 }}>Quel type de commande ?</p>
            <div className="space-y-3">
              {typeOptions.map(opt => (
                <button key={opt.id} onClick={() => { setOrderType(opt.id); setStep('order'); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors"
                  style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}>
                  <div style={{ color: t.accent }}>{opt.icon}</div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: t.text1 }}>{opt.label}</p>
                    <p className="text-xs" style={{ color: t.text2 }}>{opt.desc}</p>
                  </div>
                  <svg className="ml-auto flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.text3 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="rounded-xl shadow-xl w-full max-w-2xl my-8" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('type')} className="p-1" style={{ color: t.text2 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h2 className="text-lg font-heading" style={{ color: t.text1 }}>
              {orderType === 'dine_in' ? 'Sur place' : orderType === 'takeaway' ? 'Emporter' : 'Livraison'}
            </h2>
          </div>
          <button onClick={onClose} className="text-xl p-1" style={{ color: t.text3 }}>&times;</button>
        </div>

        <div className="p-5 space-y-5 max-h-[85vh] sm:max-h-[70vh] overflow-y-auto">
          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: t.text1 }}>Produits</h3>
            <input placeholder="Rechercher un produit..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none"
              style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
            {categories.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                <button onClick={() => setSelectedCategory(null)}
                  className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                  style={!selectedCategory ? { backgroundColor: t.accent, color: '#fff' } : { backgroundColor: t.tabBg, color: t.text2 }}>
                  Tout
                </button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                    className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                    style={selectedCategory === cat ? { backgroundColor: t.accent, color: '#fff' } : { backgroundColor: t.tabBg, color: t.text2 }}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {searchFiltered.map(p => {
                const inCart = cart.find(c => c.id === p.id);
                return (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="text-left p-2.5 rounded-lg transition-colors"
                    style={{
                      border: `1px solid ${inCart ? t.accent : t.border}`,
                      backgroundColor: inCart ? t.accentBg : t.bg,
                    }}>
                    <p className="text-xs font-semibold truncate" style={{ color: t.text1 }}>{p.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-xs font-bold" style={{ color: t.accent }}>{parseFloat(p.price).toFixed(2)} €</span>
                      {inCart && <span className="text-[10px] px-1.5 rounded-full font-bold" style={{ backgroundColor: t.accent, color: '#fff' }}>{inCart.qty}</span>}
                      {!inCart && <span className="text-[10px]" style={{ color: t.text3 }}>stock: {p.stock_quantity}</span>}
                    </div>
                  </button>
                );
              })}
              {searchFiltered.length === 0 && <p className="col-span-full text-xs text-center py-4" style={{ color: t.text3 }}>Aucun produit trouve</p>}
            </div>
          </div>

          {cart.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: t.text1 }}>Panier</h3>
              <div className="space-y-1.5">
                {cart.map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: t.bg }}>
                    <span className="text-sm flex-1 min-w-0 truncate" style={{ color: t.text1 }}>{c.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateQty(c.id, -1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full text-xs font-bold" style={{ backgroundColor: t.tabBg, color: t.text1 }}>-</button>
                      <span className="font-mono text-sm w-5 text-center" style={{ color: t.text1 }}>{c.qty}</span>
                      <button onClick={() => updateQty(c.id, 1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full text-xs font-bold" style={{ backgroundColor: t.tabBg, color: t.text1 }}>+</button>
                      <span className="font-mono text-sm w-16 text-right" style={{ color: t.text1 }}>{(c.price * c.qty).toFixed(2)} €</span>
                      <button onClick={() => removeFromCart(c.id)} className="text-sm ml-1" style={{ color: t.orangeText }}>&times;</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 text-sm space-y-0.5" style={{ borderTop: `1px solid ${t.border}` }}>
                <div className="flex justify-between" style={{ color: t.text2 }}><span>Sous-total</span><span className="font-mono">{subtotal.toFixed(2)} €</span></div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between" style={{ color: t.text2 }}><span>Livraison</span><span className="font-mono">{deliveryFee.toFixed(2)} €</span></div>
                )}
                <div className="flex justify-between font-bold" style={{ color: t.text1 }}><span>Total</span><span className="font-mono" style={{ color: t.accent }}>{total.toFixed(2)} €</span></div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: t.text1 }}>Informations client</h3>
            <div className="space-y-2">
              <input placeholder="Nom complet *" value={form.customerName}
                onChange={e => setForm({ ...form, customerName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input placeholder="Telephone *" value={form.customerPhone}
                  onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                <input placeholder="Email" type="email" value={form.customerEmail}
                  onChange={e => setForm({ ...form, customerEmail: e.target.value })}
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
              </div>

              {orderType === 'dine_in' && (
                <input placeholder="Numero de table *" value={form.tableNumber}
                  onChange={e => setForm({ ...form, tableNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
              )}

              {orderType === 'delivery' && (
                <>
                  <input placeholder="Adresse de livraison *" value={form.deliveryAddress}
                    onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                  <textarea placeholder="Notes (etage, code, etc.)" value={form.deliveryNotes}
                    onChange={e => setForm({ ...form, deliveryNotes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} rows={2} />
                </>
              )}

              <div>
                <p className="text-xs mb-1.5" style={{ color: t.text2 }}>Mode de paiement</p>
                <div className="flex gap-2">
                  {[{ v: 'cash', l: 'Especes' }, { v: 'card', l: 'Carte' }, { v: 'meal_voucher', l: 'Ticket resto' }].map(m => (
                    <button key={m.v} onClick={() => setForm({ ...form, paymentMethod: m.v })}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: form.paymentMethod === m.v ? t.accent : t.tabBg,
                        color: form.paymentMethod === m.v ? '#fff' : t.text2,
                      }}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
          <button onClick={submit} disabled={submitting || cart.length === 0}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: t.accent, color: '#fff' }}>
            {submitting ? 'Creation...' : `Creer · ${total.toFixed(2)} €`}
          </button>
        </div>
      </div>
    </div>
  );
}
