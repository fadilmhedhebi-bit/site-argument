import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';

export default function ClientCommandePage() {
  const { businessId } = useParams();
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

  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink/40">Chargement du menu...</div>;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink text-paper border-b-4 border-route">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading text-route">{menu.business?.name || 'Restaurant'}</h1>
            {menu.business?.address && <p className="text-xs text-kraft">{menu.business.address}</p>}
          </div>
          {cart.length > 0 && step === 'menu' && (
            <button onClick={() => setStep('checkout')} className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold">
              Panier ({cart.reduce((s, c) => s + c.qty, 0)}) · {subtotal.toFixed(2)} €
            </button>
          )}
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
                                <button onClick={() => updateQty(p.id, -1)} className="w-8 h-8 rounded-full bg-kraft text-ink font-bold">−</button>
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
                            <button onClick={() => updateQty(p.id, -1)} className="w-8 h-8 rounded-full bg-kraft text-ink font-bold">−</button>
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
            {menu.products.length === 0 && <p className="text-center py-12 text-ink/40">Le menu est vide pour le moment</p>}
          </div>
        )}

        {step === 'checkout' && (
          <div className="space-y-6">
            <button onClick={() => setStep('menu')} className="text-sm text-route hover:underline">← Retour au menu</button>

            <div className="bg-white rounded-xl border border-kraft p-5">
              <h2 className="text-sm font-heading text-ink mb-3">Votre panier</h2>
              <div className="space-y-2">
                {cart.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(c.id, -1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-kraft text-ink text-xs font-bold">−</button>
                        <span className="font-mono w-6 text-center text-xs">{c.qty}</span>
                        <button onClick={() => updateQty(c.id, 1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-kraft text-ink text-xs font-bold">+</button>
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
              <h2 className="text-sm font-heading text-ink mb-3">Informations de livraison</h2>
              <div className="space-y-3">
                <input placeholder="Nom complet *" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Téléphone *" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                    className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                  <input placeholder="Email" type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })}
                    className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                </div>
                <input placeholder="Adresse de livraison *" value={form.deliveryAddress} onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <textarea placeholder="Notes (étage, code, etc.)" value={form.deliveryNotes} onChange={e => setForm({ ...form, deliveryNotes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" rows={2} />

                <div>
                  <p className="text-xs text-ink/50 mb-2">Mode de paiement</p>
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

                <div className="flex gap-2">
                  <input placeholder="Code promo" value={form.promoCode} onChange={e => setForm({ ...form, promoCode: e.target.value })}
                    className="flex-1 px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm font-mono uppercase" />
                  <button onClick={validatePromo} className="px-4 py-2.5 bg-kraft text-ink rounded-lg text-sm font-semibold hover:bg-kraft/80">Appliquer</button>
                </div>
                {promoResult && (
                  <p className="text-xs text-go">
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
            <div className="bg-white rounded-2xl border border-kraft p-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-go/20 flex items-center justify-center text-3xl mx-auto mb-4">✓</div>
              <h2 className="text-xl font-heading text-ink mb-2">Commande confirmée !</h2>
              <p className="text-sm text-ink/60 mb-4">Votre numéro de commande :</p>
              <p className="text-3xl font-mono font-bold text-route mb-6">{confirmation.order_number || confirmation.orderNumber}</p>
              <p className="text-sm text-ink/50 mb-6">Conservez ce numéro pour suivre votre commande</p>
              <a href={`/suivi/${confirmation.order_number || confirmation.orderNumber}`}
                className="inline-block px-6 py-3 bg-route text-paper rounded-lg font-semibold text-sm hover:bg-route/90 no-underline">
                Suivre ma commande
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
