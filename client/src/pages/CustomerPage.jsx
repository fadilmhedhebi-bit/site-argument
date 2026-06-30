import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import FoodlyLogo from '../components/FoodlyLogo';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function customerRequest(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export default function CustomerPage() {
  const { businessId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(null);
  const [view, setView] = useState('auth');
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });
  const [loyalty, setLoyalty] = useState(null);
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState({ business: null, categories: [], products: [] });
  const [cart, setCart] = useState([]);
  const [orderStep, setOrderStep] = useState('menu');
  const [orderForm, setOrderForm] = useState({ deliveryAddress: '', deliveryNotes: '', paymentMethod: 'cash', promoCode: '' });
  const [promoResult, setPromoResult] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`foodly_customer_${businessId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setToken(data.token);
        setCustomer(data.customer);
        setView('home');
      } catch {}
    }
  }, [businessId]);

  useEffect(() => {
    if (token) {
      loadCustomerData();
    }
  }, [token]);

  const loadCustomerData = async () => {
    try {
      const [profile, loyaltyData, ordersList, menuData] = await Promise.all([
        customerRequest('GET', '/customers/me', null, token),
        customerRequest('GET', '/customers/me/loyalty', null, token),
        customerRequest('GET', '/customers/me/orders', null, token),
        api.get(`/products/public/${businessId}`),
      ]);
      setCustomer(profile);
      setLoyalty(loyaltyData);
      setOrders(ordersList);
      setMenu(menuData);
    } catch (err) {
      if (err.message.includes('Token') || err.message.includes('401')) {
        logout();
      }
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const data = await customerRequest('POST', '/customers/login', { businessId, ...loginForm });
      setToken(data.token);
      setCustomer(data.customer);
      localStorage.setItem(`foodly_customer_${businessId}`, JSON.stringify(data));
      setView('home');
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const data = await customerRequest('POST', '/customers/register', { businessId, ...registerForm });
      setToken(data.token);
      setCustomer(data.customer);
      localStorage.setItem(`foodly_customer_${businessId}`, JSON.stringify(data));
      setView('home');
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const logout = () => {
    setCustomer(null);
    setToken(null);
    setView('auth');
    localStorage.removeItem(`foodly_customer_${businessId}`);
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0));
  };

  const subtotal = cart.reduce((s, c) => s + parseFloat(c.price) * c.qty, 0);
  const deliveryFee = 2.50;
  const discount = promoResult
    ? (promoResult.type === 'percentage' ? subtotal * promoResult.value / 100
      : promoResult.type === 'fixed' ? parseFloat(promoResult.value) : 0)
    : 0;
  const freeDelivery = promoResult?.type === 'free_delivery';
  const total = Math.max(0, subtotal + (freeDelivery ? 0 : deliveryFee) - discount);

  const validatePromo = async () => {
    if (!orderForm.promoCode) return;
    try {
      const result = await api.post('/promos/validate', { code: orderForm.promoCode, subtotal, businessId });
      setPromoResult(result);
    } catch (err) { alert(err.message); setPromoResult(null); }
  };

  const submitOrder = async () => {
    if (!orderForm.deliveryAddress) return alert('Adresse de livraison requise');
    setSubmitting(true);
    try {
      const result = await api.post(`/orders/public/${businessId}`, {
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerPhone: customer.phone || '',
        customerEmail: customer.email,
        deliveryAddress: orderForm.deliveryAddress,
        deliveryNotes: orderForm.deliveryNotes,
        paymentMethod: orderForm.paymentMethod,
        promoCode: orderForm.promoCode,
        items: cart.map(c => ({ productId: c.id, quantity: c.qty })),
        deliveryFee,
        customerId: customer.id,
      });
      setConfirmation(result);
      setOrderStep('confirmed');
      setCart([]);
      loadCustomerData();
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const redeemReward = async (rewardId) => {
    try {
      const result = await customerRequest('POST', '/customers/me/redeem', { rewardId }, token);
      alert(`${result.reward} échangé !${result.promoCode ? ` Code promo: ${result.promoCode}` : ''}`);
      loadCustomerData();
    } catch (err) { alert(err.message); }
  };

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, #1C8275, #0D5650)' }}>
        <div className="bg-white rounded-[14px] shadow-sm w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3"><FoodlyLogo size={48} /></div>
            <h1 className="text-3xl font-bold text-ink tracking-[-1.5px]">foodly</h1>
            <p className="text-ink/40 text-sm mt-1">Espace client</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${authMode === 'login' ? 'bg-route text-paper' : 'bg-kraft/50 text-ink'}`}>
              Connexion
            </button>
            <button onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${authMode === 'register' ? 'bg-route text-paper' : 'bg-kraft/50 text-ink'}`}>
              Inscription
            </button>
          </div>

          {authMode === 'login' ? (
            <div className="space-y-3">
              <input type="email" placeholder="Email" value={loginForm.email}
                onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input type="password" placeholder="Mot de passe" value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <button onClick={handleLogin} disabled={loading}
                className="w-full py-3 bg-route text-paper rounded-lg font-semibold hover:bg-route/90 disabled:opacity-50">
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Prénom *" value={registerForm.firstName}
                  onChange={e => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                  className="px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <input placeholder="Nom *" value={registerForm.lastName}
                  onChange={e => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                  className="px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              </div>
              <input type="email" placeholder="Email *" value={registerForm.email}
                onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input placeholder="Téléphone" value={registerForm.phone}
                onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input type="password" placeholder="Mot de passe (6 car. min) *" value={registerForm.password}
                onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <button onClick={handleRegister} disabled={loading}
                className="w-full py-3 bg-route text-paper rounded-lg font-semibold hover:bg-route/90 disabled:opacity-50">
                {loading ? 'Inscription...' : 'Créer mon compte'}
              </button>
            </div>
          )}

          <p className="text-xs text-ink/30 text-center mt-4">
            <a href={`/commander/${businessId}`} className="text-route hover:underline">Commander sans compte</a>
          </p>
        </div>
      </div>
    );
  }

  const statusLabels = {
    pending: 'En attente', confirmed: 'Confirmée', preparing: 'En prépa.', ready: 'Prête',
    in_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée', problem: 'Problème',
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-white border-b border-[rgba(0,0,0,0.06)] sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FoodlyLogo size={28} />
            <span className="text-lg font-bold text-ink tracking-[-1.5px]">foodly</span>
            <span className="text-xs text-ink/40 ml-1">{customer?.businessName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink/50">{customer?.firstName}</span>
            <button onClick={logout} className="text-xs text-stop hover:underline">Déconnexion</button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { id: 'home', label: 'Accueil', icon: '🏠' },
            { id: 'order', label: 'Commander', icon: '🛒' },
            { id: 'loyalty', label: 'Fidélité', icon: '💳' },
            { id: 'history', label: 'Historique', icon: '📋' },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setView(tab.id); if (tab.id === 'order') setOrderStep('menu'); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                view === tab.id ? 'bg-route text-paper' : 'bg-kraft/50 text-ink hover:bg-kraft'
              }`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {view === 'home' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-kraft p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-route/10 flex items-center justify-center text-2xl mx-auto mb-3">
                {customer?.firstName?.[0]}{customer?.lastName?.[0]}
              </div>
              <h2 className="text-xl font-heading text-ink">Bonjour, {customer?.firstName} !</h2>
              <p className="text-sm text-ink/50 mt-1">{customer?.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-kraft p-4 text-center">
                <p className="text-xs text-ink/50">Points fidélité</p>
                <p className="text-2xl font-heading text-route mt-1">{customer?.loyaltyPoints || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-kraft p-4 text-center">
                <p className="text-xs text-ink/50">Commandes</p>
                <p className="text-2xl font-heading text-ink mt-1">{customer?.totalOrders || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => { setView('order'); setOrderStep('menu'); }}
                className="bg-route text-paper rounded-xl p-4 text-left hover:bg-route/90 transition-colors">
                <span className="text-2xl">🛒</span>
                <p className="font-semibold mt-2">Passer commande</p>
                <p className="text-xs text-paper/70">Parcourir le menu</p>
              </button>
              <button onClick={() => setView('loyalty')}
                className="bg-white border border-kraft rounded-xl p-4 text-left hover:bg-kraft/20 transition-colors">
                <span className="text-2xl">💳</span>
                <p className="font-semibold text-ink mt-2">Ma carte de fidélité</p>
                <p className="text-xs text-ink/50">{customer?.loyaltyPoints || 0} points disponibles</p>
              </button>
            </div>
          </div>
        )}

        {view === 'loyalty' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(160deg, #1C8275, #0D5650)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold opacity-80">Carte de fidélité</span>
                <span className="text-xs opacity-60">foodly</span>
              </div>
              <p className="text-4xl font-heading">{loyalty?.points || 0}</p>
              <p className="text-sm opacity-80 mt-1">points disponibles</p>
              <p className="text-xs opacity-60 mt-3">{customer?.firstName} {customer?.lastName}</p>
              {loyalty?.config && (
                <p className="text-xs opacity-60">+{loyalty.config.points_per_euro} point(s) par euro dépensé</p>
              )}
            </div>

            {loyalty?.rewards?.length > 0 && (
              <div>
                <h3 className="text-sm font-heading text-ink mb-3">Récompenses disponibles</h3>
                <div className="space-y-2">
                  {loyalty.rewards.map(r => (
                    <div key={r.id} className="bg-white rounded-xl border border-kraft p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-ink text-sm">{r.name}</p>
                        {r.description && <p className="text-xs text-ink/50">{r.description}</p>}
                        <p className="text-xs font-mono text-route mt-1">{r.points_cost} points</p>
                      </div>
                      <button onClick={() => redeemReward(r.id)}
                        disabled={(loyalty?.points || 0) < r.points_cost}
                        className="px-4 py-2 bg-route text-paper rounded-lg text-xs font-semibold disabled:opacity-30">
                        Échanger
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loyalty?.transactions?.length > 0 && (
              <div>
                <h3 className="text-sm font-heading text-ink mb-3">Historique des points</h3>
                <div className="bg-white rounded-xl border border-kraft divide-y divide-kraft/30">
                  {loyalty.transactions.map(t => (
                    <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-ink">{t.description}</p>
                        <p className="text-xs text-ink/40">{new Date(t.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <span className={`font-mono text-sm font-bold ${t.points > 0 ? 'text-go' : 'text-stop'}`}>
                        {t.points > 0 ? '+' : ''}{t.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-2">
            <h3 className="text-sm font-heading text-ink mb-3">Mes commandes</h3>
            {orders.length > 0 ? orders.map(o => (
              <div key={o.order_number} className="bg-white rounded-xl border border-kraft p-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-route font-bold text-sm">{o.order_number}</span>
                  <p className="text-xs text-ink/40 mt-0.5">{new Date(o.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-ink">{parseFloat(o.total).toFixed(2)} €</span>
                  <p className={`text-xs mt-0.5 ${o.status === 'delivered' ? 'text-go' : o.status === 'cancelled' ? 'text-stop' : 'text-route'}`}>
                    {statusLabels[o.status] || o.status}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-ink/30">Aucune commande</p>
            )}
          </div>
        )}

        {view === 'order' && orderStep === 'menu' && (
          <div className="space-y-6">
            {cart.length > 0 && (
              <button onClick={() => setOrderStep('checkout')}
                className="w-full py-3 bg-route text-paper rounded-xl font-semibold text-sm sticky top-16 z-30">
                Voir le panier ({cart.reduce((s, c) => s + c.qty, 0)}) · {subtotal.toFixed(2)} €
              </button>
            )}

            {menu.categories.length > 0 ? menu.categories.map(cat => {
              const catProducts = menu.products.filter(p => p.category_id === cat.id);
              if (catProducts.length === 0) return null;
              return (
                <div key={cat.id}>
                  <h2 className="text-lg font-heading text-ink mb-3">{cat.name}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catProducts.map(p => {
                      const inCart = cart.find(c => c.id === p.id);
                      return (
                        <div key={p.id} className="bg-white rounded-xl border border-kraft p-4 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-ink text-sm">{p.name}</h3>
                            {p.description && <p className="text-xs text-ink/50 mt-0.5 truncate">{p.description}</p>}
                            <p className="font-mono text-route font-bold mt-1">{parseFloat(p.price).toFixed(2)} €</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {inCart ? (
                              <>
                                <button onClick={() => updateQty(p.id, -1)} className="w-8 h-8 rounded-full bg-kraft text-ink font-bold">-</button>
                                <span className="font-mono w-6 text-center">{inCart.qty}</span>
                                <button onClick={() => updateQty(p.id, 1)} className="w-8 h-8 rounded-full bg-route text-paper font-bold">+</button>
                              </>
                            ) : (
                              <button onClick={() => addToCart(p)} className="w-8 h-8 rounded-full bg-route text-paper font-bold text-lg">+</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {menu.products.map(p => {
                  const inCart = cart.find(c => c.id === p.id);
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-kraft p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink text-sm">{p.name}</h3>
                        {p.description && <p className="text-xs text-ink/50 truncate">{p.description}</p>}
                        <p className="font-mono text-route font-bold mt-1">{parseFloat(p.price).toFixed(2)} €</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {inCart ? (
                          <>
                            <button onClick={() => updateQty(p.id, -1)} className="w-8 h-8 rounded-full bg-kraft text-ink font-bold">-</button>
                            <span className="font-mono w-6 text-center">{inCart.qty}</span>
                            <button onClick={() => updateQty(p.id, 1)} className="w-8 h-8 rounded-full bg-route text-paper font-bold">+</button>
                          </>
                        ) : (
                          <button onClick={() => addToCart(p)} className="w-8 h-8 rounded-full bg-route text-paper font-bold text-lg">+</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {menu.products.length === 0 && <p className="text-center py-12 text-ink/40">Le menu est vide</p>}
          </div>
        )}

        {view === 'order' && orderStep === 'checkout' && (
          <div className="space-y-4">
            <button onClick={() => setOrderStep('menu')} className="text-sm text-route hover:underline">← Retour au menu</button>

            <div className="bg-white rounded-xl border border-kraft p-5">
              <h2 className="text-sm font-heading text-ink mb-3">Votre panier</h2>
              <div className="space-y-2">
                {cart.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(c.id, -1)} className="w-7 h-7 rounded-full bg-kraft text-ink text-xs font-bold">-</button>
                        <span className="font-mono w-6 text-center text-xs">{c.qty}</span>
                        <button onClick={() => updateQty(c.id, 1)} className="w-7 h-7 rounded-full bg-kraft text-ink text-xs font-bold">+</button>
                      </div>
                      <span className="text-ink">{c.name}</span>
                    </div>
                    <span className="font-mono text-ink">{(parseFloat(c.price) * c.qty).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-kraft mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-ink/50">Sous-total</span><span className="font-mono">{subtotal.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span className="text-ink/50">Livraison</span><span className="font-mono">{freeDelivery ? '0.00' : deliveryFee.toFixed(2)} €</span></div>
                {discount > 0 && <div className="flex justify-between text-go"><span>Remise</span><span className="font-mono">-{discount.toFixed(2)} €</span></div>}
                <div className="flex justify-between font-bold text-ink border-t border-kraft pt-2">
                  <span>Total</span><span className="font-mono text-route">{total.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-kraft p-5">
              <h2 className="text-sm font-heading text-ink mb-3">Livraison</h2>
              <div className="space-y-3">
                <input placeholder="Adresse de livraison *" value={orderForm.deliveryAddress}
                  onChange={e => setOrderForm({ ...orderForm, deliveryAddress: e.target.value })}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <textarea placeholder="Notes (étage, code...)" value={orderForm.deliveryNotes}
                  onChange={e => setOrderForm({ ...orderForm, deliveryNotes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" rows={2} />
                <div>
                  <p className="text-xs text-ink/50 mb-2">Mode de paiement</p>
                  <div className="flex gap-2">
                    {[{ v: 'cash', l: 'Espèces' }, { v: 'card', l: 'Carte' }, { v: 'meal_voucher', l: 'Ticket resto' }].map(m => (
                      <button key={m.v} onClick={() => setOrderForm({ ...orderForm, paymentMethod: m.v })}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          orderForm.paymentMethod === m.v ? 'bg-route text-paper' : 'bg-kraft/50 text-ink hover:bg-kraft'
                        }`}>
                        {m.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input placeholder="Code promo" value={orderForm.promoCode}
                    onChange={e => setOrderForm({ ...orderForm, promoCode: e.target.value })}
                    className="flex-1 px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm font-mono uppercase" />
                  <button onClick={validatePromo} className="px-4 py-2.5 bg-kraft text-ink rounded-lg text-sm font-semibold">Appliquer</button>
                </div>
                {promoResult && (
                  <p className="text-xs text-go">
                    Code appliqué : {promoResult.type === 'percentage' ? `${promoResult.value}%` : promoResult.type === 'fixed' ? `${promoResult.value} €` : 'Livraison gratuite'}
                  </p>
                )}
              </div>
            </div>

            <button onClick={submitOrder} disabled={submitting || cart.length === 0}
              className="w-full py-3 bg-go text-paper rounded-xl font-semibold hover:bg-go/90 disabled:opacity-50 transition-colors">
              {submitting ? 'Envoi...' : `Commander · ${total.toFixed(2)} €`}
            </button>
          </div>
        )}

        {view === 'order' && orderStep === 'confirmed' && confirmation && (
          <div className="text-center py-12">
            <div className="bg-white rounded-2xl border border-kraft p-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-go/20 flex items-center justify-center text-3xl mx-auto mb-4">✓</div>
              <h2 className="text-xl font-heading text-ink mb-2">Commande confirmée !</h2>
              <p className="text-3xl font-mono font-bold text-route mb-4">{confirmation.orderNumber}</p>
              <p className="text-sm text-ink/50 mb-6">Des points de fidélité ont été ajoutés à votre compte !</p>
              <div className="flex gap-3">
                <a href={`/suivi/${confirmation.orderNumber}`}
                  className="flex-1 py-3 bg-route text-paper rounded-lg font-semibold text-sm text-center no-underline">
                  Suivre
                </a>
                <button onClick={() => { setView('home'); setOrderStep('menu'); setConfirmation(null); setPromoResult(null); setOrderForm({ deliveryAddress: '', deliveryNotes: '', paymentMethod: 'cash', promoCode: '' }); }}
                  className="flex-1 py-3 bg-kraft text-ink rounded-lg font-semibold text-sm">
                  Accueil
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
