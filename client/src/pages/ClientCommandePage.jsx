import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import RestoLabLogo from '../components/RestoLabLogo';
import CartSummary from '../components/CartSummary';
import { useTheme } from '../ThemeContext';
import useCart from '../hooks/useCart';

const menuCategories = [
  { label: 'Entrées' },
  { label: 'Tapas' },
  { label: 'Plats' },
  { label: 'Desserts' },
  { label: 'Cocktails' },
  { label: 'Mocktails' },
  { label: 'Softs' },
];

export default function ClientCommandePage() {
  const { businessId } = useParams();
  const { t, applyBusinessColors } = useTheme();
  const [menu, setMenu] = useState({ business: null, categories: [], products: [] });
  const {
    cart, addToCart, updateQty,
    subtotal, discount, freeDelivery, total, itemCount,
    deliveryFee, promoResult, validatePromo,
    orderType, setOrderType, hasDeliveryFee,
    setBusinessDeliveryFee,
  } = useCart(businessId);
  const [step, setStep] = useState('browse');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    deliveryAddress: '', paymentMethod: 'cash', promoCode: '', deliveryNotes: '',
    tableNumber: '',
  });
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/products/public/${businessId}`)
      .then(data => {
        setMenu(data);
        setBusinessDeliveryFee(parseFloat(data.business?.delivery_fee ?? 0));
        applyBusinessColors({ primaryColor: data.business?.primary_color, secondaryColor: data.business?.secondary_color });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    return () => applyBusinessColors({ primaryColor: null, secondaryColor: null });
  }, [businessId]);

  const submitOrder = async () => {
    if (orderType === 'delivery') {
      if (!form.customerName || !form.customerPhone) return alert('Nom et téléphone requis');
      if (!form.deliveryAddress) return alert('Adresse de livraison requise');
    }
    if (orderType === 'dine_in' && !form.tableNumber) return alert('Numéro de table requis');
    setSubmitting(true);
    try {
      const result = await api.post(`/orders/public/${businessId}`, {
        ...form, orderType, items: cart.map(c => ({ productId: c.id, quantity: c.qty })),
        deliveryFee: hasDeliveryFee ? deliveryFee : 0,
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
            <RestoLabLogo size={28} />
            <div>
              <h1 className="text-lg font-bold tracking-[-0.5px]" style={{ color: t.text1 }}>{menu.business?.name || 'Restaurant'}</h1>
            {menu.business?.address && <p className="text-xs" style={{ color: t.text2 }}>{menu.business.address}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/client/${businessId}`} className="text-xs hover:underline no-underline" style={{ color: t.accent }}>Mon compte</a>
            {cart.length > 0 && (step === 'menu' || step === 'browse') && (
              <button onClick={() => setStep('checkout')} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.accent, color: '#fff' }}>
                Panier ({itemCount}) · {subtotal.toFixed(2)} €
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {step === 'browse' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-heading mb-3" style={{ color: t.text1 }}>Notre carte</h2>
              <div className="flex flex-col gap-2">
                {menuCategories.map(cat => (
                  <button key={cat.label} onClick={() => { setSelectedCategory(cat.label); setStep('menu'); }}
                    className="flex items-center px-4 py-3 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                    <span className="text-sm font-semibold" style={{ color: t.text1 }}>{cat.label}</span>
                  </button>
                ))}
                <button onClick={() => { setSelectedCategory(null); setStep('menu'); }}
                  className="flex items-center px-4 py-3 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ backgroundColor: t.accent, border: `1px solid ${t.accent}` }}>
                  <span className="text-sm font-semibold" style={{ color: '#fff' }}>Tout voir</span>
                </button>
              </div>
            </div>

            {cart.length > 0 && (
              <button onClick={() => setStep('checkout')}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: t.accent, color: '#fff' }}>
                Voir le panier ({itemCount}) · {subtotal.toFixed(2)} €
              </button>
            )}
          </div>
        )}

        {step === 'menu' && (() => {
          const filteredProducts = selectedCategory
            ? menu.products.filter(p => p.category_name === selectedCategory)
            : menu.products;

          return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('browse')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: t.tabBg || t.cardBg, color: t.text1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                </svg>
                Catégories
              </button>
              {selectedCategory && (
                <span className="text-sm font-semibold" style={{ color: t.accent }}>
                  {selectedCategory}
                </span>
              )}
            </div>

            {cart.length > 0 && (
              <button onClick={() => setStep('checkout')}
                className="w-full py-3 rounded-xl font-semibold text-sm sticky top-16 z-30"
                style={{ backgroundColor: t.accent, color: '#fff' }}>
                Voir le panier ({itemCount}) · {subtotal.toFixed(2)} €
              </button>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setSelectedCategory(null)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
                style={!selectedCategory ? { backgroundColor: t.accent, color: '#fff' } : { backgroundColor: t.cardBg, color: t.text1, border: `1px solid ${t.border}` }}>
                Tout
              </button>
              {menuCategories.map(cat => (
                <button key={cat.label} onClick={() => setSelectedCategory(cat.label)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
                  style={selectedCategory === cat.label ? { backgroundColor: t.accent, color: '#fff' } : { backgroundColor: t.cardBg, color: t.text1, border: `1px solid ${t.border}` }}>
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map(p => {
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
                          <button onClick={() => updateQty(p.id, -1)} className="w-8 h-8 rounded-full font-bold" style={{ backgroundColor: t.border, color: t.text1 }}>-</button>
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
            {filteredProducts.length === 0 && <p className="text-center py-12" style={{ color: t.text2 }}>{selectedCategory ? 'Aucun produit dans cette catégorie' : 'Le menu est vide pour le moment'}</p>}
          </div>
          );
        })()}

        {step === 'checkout' && (
          <div className="space-y-6">
            <button onClick={() => setStep('browse')} className="text-sm hover:underline" style={{ color: t.accent }}>← Retour au menu</button>

            <CartSummary cart={cart} updateQty={updateQty} subtotal={subtotal} deliveryFee={deliveryFee} freeDelivery={freeDelivery} discount={discount} total={total} hasDeliveryFee={hasDeliveryFee} />

            <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <h2 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Type de commande</h2>
              <div className="flex gap-2">
                {[{ v: 'dine_in', l: 'Sur place' }, { v: 'takeaway', l: 'Emporter' }, { v: 'delivery', l: 'Livraison' }].map(m => (
                  <button key={m.v} onClick={() => setOrderType(m.v)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={orderType === m.v
                      ? { backgroundColor: t.accent, color: '#fff' }
                      : { backgroundColor: t.bg, color: t.text1, border: `1px solid ${t.border}` }
                    }>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <h2 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Vos informations</h2>
              <div className="space-y-3">
                {orderType === 'delivery' && (
                  <>
                    <input placeholder="Nom complet *" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input placeholder="Téléphone *" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                        className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                      <input placeholder="Email" type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })}
                        className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                    </div>
                  </>
                )}
                {orderType === 'dine_in' && (
                  <input placeholder="Numéro de table *" value={form.tableNumber} onChange={e => setForm({ ...form, tableNumber: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                )}
                {orderType === 'takeaway' && (
                  <p className="text-xs" style={{ color: t.text2 }}>
                    Un numéro de commande vous sera attribué à la validation.
                  </p>
                )}
                {orderType === 'delivery' && (
                  <>
                    <input placeholder="Adresse de livraison *" value={form.deliveryAddress} onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} />
                    <textarea placeholder="Notes (étage, code, etc.)" value={form.deliveryNotes} onChange={e => setForm({ ...form, deliveryNotes: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }} rows={2} />
                  </>
                )}

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
                  <button onClick={() => validatePromo(form.promoCode)} className="px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.border, color: t.text1 }}>Appliquer</button>
                </div>
                {promoResult && (
                  <p className="text-xs" style={{ color: t.greenText }}>
                    Code appliqué : {promoResult.type === 'percentage' ? `${promoResult.value}%` : promoResult.type === 'fixed' ? `${promoResult.value} €` : 'Livraison gratuite'}
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
              <div className="w-16 h-16 rounded-full bg-go/20 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
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
