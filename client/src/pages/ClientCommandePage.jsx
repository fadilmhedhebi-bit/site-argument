import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import FoodlyLogo from '../components/FoodlyLogo';
import { useTheme } from '../ThemeContext';

export default function ClientCommandePage() {
  const { businessId } = useParams();
  const { t } = useTheme();
  const [menu, setMenu] = useState({ business: null, categories: [], products: [] });
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState('menu');
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    deliveryAddress: '', paymentMethod: 'cash', promoCode: '', deliveryNotes: '',
  });
  const [promoResult, setPromoResult] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/products/public/${businessId}`)
      .then(setMenu)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [businessId]);

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
    if (!form.promoCode) return;
    try {
      const result = await api.post('/promos/validate', { code: form.promoCode, subtotal, businessId });
      setPromoResult(result);
    } catch (err) { alert(err.message); setPromoResult(null); }
  };

  const submitOrder = async () => {
    if (!form.customerName || !form.customerPhone || !form.deliveryAddress) {
      return alert('Nom, téléphone et adresse requis');
    }
    setSubmitting(true);
    try {
      const result = await api.post(`/orders/public/${businessId}`, {
        ...form, items: cart.map(c => ({ productId: c.id, quantity: c.qty })), deliveryFee,
      });
      setConfirmation(result);
      setStep('confirmed');
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center" style={{ backgroundColor: t.bg, minHeight: '100vh', color: t.text2 }}>
      Chargement du menu...
    </div>
  );

  return (
    <div style={{ backgroundColor: t.bg, minHeight: '100vh' }}>
      <header style={{ backgroundColor: t.navBg, borderBottom: `1px solid ${t.border}` }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FoodlyLogo size={28} />
            <div>
              <h1 className="text-lg font-bold tracking-[-0.5px]" style={{ color: t.text1 }}>{menu.business?.name || 'Restaurant'}</h1>
            {menu.business?.address && <p className="text-xs" style={{ color: t.text2 }}>{menu.business.address}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/client/${businessId}`} className="text-xs hover:underline no-underline" style={{ color: t.accent }}>Mon compte</a>
            {cart.length > 0 && step === 'menu' && (
              <button onClick={() => setStep('checkout')} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.accent, color: '#fff' }}>
                Panier ({cart.reduce((s, c) => s + c.qty, 0)}) · {subtotal.toFixed(2)} €
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {step === 'menu' && (
          <div className="space-y-8">
            {menu.categories.length > 0 ? menu.categories.map(cat => {
              const catProducts = menu.products.filter(p => p.category_id === cat.id);
              if (catProducts.length === 0) return null;
              return (
                <div key={cat.id}>
                  <h2 className="text-lg font-heading mb-3" style={{ color: t.text1 }}>{cat.name}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catProducts.map(p => {
                      const inCart = cart.find(c => c.id === p.id);
                      return (
                        <div key={p.id} className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm" style={{ color: t.text1 }}>{p.name}</h3>
                            {p.description && <p className="text-xs mt-0.5 truncate" style={{ color: t.text2 }}>{p.description}</p>}
                            <p className="font-mono font-bold mt-1" style={{ color: t.accent }}>{parseFloat(p.price).toFixed(2)} €</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {inCart ? (
                              <>
                                <button onClick={() => updateQty(p.id, -1)} className="w-8 h-8 rounded-full font-bold" style={{ backgroundColor: t.border, color: t.text1 }}>−</button>
                                <span className="font-mono w-6 text-center" style={{ color: t.text1 }}>{inCart.qty}</span>
                                <button onClick={() => updateQty(p.id, 1)} className="w-8 h-8 rounded-full font-bold" style={{ backgroundColor: t.accent, color: '#fff' }}>+</button>
                              </>
                            ) : (
                              <button onClick={() => addToCart(p)} className="w-8 h-8 rounded-full font-bold text-lg" style={{ backgroundColor: t.accent, color: '#fff' }}>+</button>
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
                    <div key={p.id} className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm" style={{ color: t.text1 }}>{p.name}</h3>
                        {p.description && <p className="text-xs truncate" style={{ color: t.text2 }}>{p.description}</p>}
                        <p className="font-mono font-bold mt-1" style={{ color: t.accent }}>{parseFloat(p.price).toFixed(2)} €</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {inCart ? (
                          <>
                            <button onClick={() => updateQty(p.id, -1)} className="w-8 h-8 rounded-full font-bold" style={{ backgroundColor: t.border, color: t.text1 }}>−</button>
                            <span className="font-mono w-6 text-center" style={{ color: t.text1 }}>{inCart.qty}</span>
                            <button onClick={() => updateQty(p.id, 1)} className="w-8 h-8 rounded-full font-bold" style={{ backgroundColor: t.accent, color: '#fff' }}>+</button>
                          </>
                        ) : (
                          <button onClick={() => addToCart(p)} className="w-8 h-8 rounded-full font-bold text-lg" style={{ backgroundColor: t.accent, color: '#fff' }}>+</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {menu.products.length === 0 && <p className="text-center py-12" style={{ color: t.text2 }}>Le menu est vide pour le moment</p>}
          </div>
        )}

        {step === 'checkout' && (
          <div className="space-y-6">
            <button onClick={() => setStep('menu')} className="text-sm hover:underline" style={{ color: t.accent }}>← Retour au menu</button>

            <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <h2 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Votre panier</h2>
              <div className="space-y-2">
                {cart.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(c.id, -1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full text-xs font-bold" style={{ backgroundColor: t.border, color: t.text1 }}>−</button>
                        <span className="font-mono w-6 text-center text-xs" style={{ color: t.text1 }}>{c.qty}</span>
                        <button onClick={() => updateQty(c.id, 1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full text-xs font-bold" style={{ backgroundColor: t.border, color: t.text1 }}>+</button>
                      </div>
                      <span style={{ color: t.text1 }}>{c.name}</span>
                    </div>
                    <span className="font-mono" style={{ color: t.text1 }}>{(parseFloat(c.price) * c.qty).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 space-y-1 text-sm" style={{ borderTop: `1px solid ${t.border}` }}>
                <div className="flex justify-between"><span style={{ color: t.text2 }}>Sous-total</span><span className="font-mono" style={{ color: t.text1 }}>{subtotal.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span style={{ color: t.text2 }}>Livraison</span><span className="font-mono" style={{ color: t.text1 }}>{freeDelivery ? '0.00' : deliveryFee.toFixed(2)} €</span></div>
                {discount > 0 && <div className="flex justify-between text-go"><span>Remise</span><span className="font-mono">-{discount.toFixed(2)} €</span></div>}
                <div className="flex justify-between font-bold pt-2" style={{ color: t.text1, borderTop: `1px solid ${t.border}` }}>
                  <span>Total</span><span className="font-mono" style={{ color: t.accent }}>{total.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <h2 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Informations de livraison</h2>
              <div className="space-y-3">
                <input placeholder="Nom complet *" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Téléphone *" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                    className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                  <input placeholder="Email" type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })}
                    className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                </div>
                <input placeholder="Adresse de livraison *" value={form.deliveryAddress} onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                <textarea placeholder="Notes (étage, code, etc.)" value={form.deliveryNotes} onChange={e => setForm({ ...form, deliveryNotes: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} rows={2} />

                <div>
                  <p className="text-xs mb-2" style={{ color: t.text2 }}>Mode de paiement</p>
                  <div className="flex gap-2">
                    {[{ v: 'cash', l: 'Espèces' }, { v: 'card', l: 'Carte' }, { v: 'meal_voucher', l: 'Ticket resto' }].map(m => (
                      <button key={m.v} onClick={() => setForm({ ...form, paymentMethod: m.v })}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                        style={form.paymentMethod === m.v
                          ? { backgroundColor: t.accent, color: '#fff' }
                          : { backgroundColor: t.bg, color: t.text1 }
                        }>
                        {m.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input placeholder="Code promo" value={form.promoCode} onChange={e => setForm({ ...form, promoCode: e.target.value })}
                    className="flex-1 px-4 py-2.5 rounded-lg focus:outline-none text-sm font-mono uppercase" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                  <button onClick={validatePromo} className="px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.border, color: t.text1 }}>Appliquer</button>
                </div>
                {promoResult && (
                  <p className="text-xs" style={{ color: t.greenText }}>
                    ✓ Code appliqué : {promoResult.type === 'percentage' ? `${promoResult.value}%` : promoResult.type === 'fixed' ? `${promoResult.value} €` : 'Livraison gratuite'}
                  </p>
                )}
              </div>
            </div>

            <button onClick={submitOrder} disabled={submitting || cart.length === 0}
              className="w-full py-3 bg-go text-paper rounded-xl font-semibold hover:bg-go/90 disabled:opacity-50 transition-colors">
              {submitting ? 'Envoi en cours...' : `Commander · ${total.toFixed(2)} €`}
            </button>
          </div>
        )}

        {step === 'confirmed' && confirmation && (
          <div className="text-center py-12">
            <div className="rounded-2xl p-8 max-w-md mx-auto" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <div className="w-16 h-16 rounded-full bg-go/20 flex items-center justify-center text-3xl mx-auto mb-4">✓</div>
              <h2 className="text-xl font-heading mb-2" style={{ color: t.text1 }}>Commande confirmée !</h2>
              <p className="text-sm mb-4" style={{ color: t.text2 }}>Votre numéro de commande :</p>
              <p className="text-3xl font-mono font-bold mb-6" style={{ color: t.accent }}>{confirmation.order_number || confirmation.orderNumber}</p>
              <p className="text-sm mb-6" style={{ color: t.text2 }}>Conservez ce numéro pour suivre votre commande</p>
              <a href={`/suivi/${confirmation.order_number || confirmation.orderNumber}`}
                className="inline-block px-6 py-3 rounded-lg font-semibold text-sm hover:opacity-90 no-underline" style={{ backgroundColor: t.accent, color: '#fff' }}>
                Suivre ma commande
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
