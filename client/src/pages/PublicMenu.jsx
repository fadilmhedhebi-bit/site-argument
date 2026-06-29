import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function PublicMenu() {
  const { businessId } = useParams();
  const [data, setData] = useState(null);
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', deliveryAddress: '', paymentMethod: 'cash', promoCode: '' });
  const [step, setStep] = useState('menu');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/products/public/${businessId}`).then((r) => r.json()).then(setData).catch(console.error);
  }, [businessId]);

  const addToCart = (product) => {
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      setCart(cart.map((c) => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, price: parseFloat(product.price), quantity: 1 }]);
    }
  };

  const updateQty = (productId, delta) => {
    setCart(cart.map((c) => c.productId === productId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter((c) => c.quantity > 0));
  };

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const deliveryFee = 2.50;

  const submit = async () => {
    if (!form.customerName || !form.customerPhone || !form.deliveryAddress) return setError('Remplissez tous les champs obligatoires');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders/public/${businessId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setStep('confirmation');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!data) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink/50">Chargement...</div>;
  if (!data.business) return <div className="min-h-screen bg-paper flex items-center justify-center text-stop">Commerce non trouvé</div>;

  const grouped = {};
  data.products.forEach((p) => {
    const cat = p.category_name || 'Autres';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink text-paper py-6">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl text-route">{data.business.name}</h1>
          {data.business.address && <p className="text-kraft text-sm mt-1">{data.business.address}</p>}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {step === 'menu' && (
          <>
            {Object.entries(grouped).map(([cat, products]) => (
              <div key={cat} className="mb-8">
                <h2 className="text-lg text-ink border-b-2 border-route pb-2 mb-4">{cat}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl border border-kraft p-4 flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-ink">{p.name}</h3>
                        {p.description && <p className="text-xs text-ink/50 mt-0.5">{p.description}</p>}
                        <p className="font-mono text-route font-bold mt-1">{parseFloat(p.price).toFixed(2)} €</p>
                      </div>
                      <button onClick={() => addToCart(p)}
                        className="px-3 py-2 bg-route text-paper rounded-lg text-sm font-bold hover:bg-route/90 shrink-0">
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-ink text-paper p-4 shadow-lg z-40">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-kraft">{cart.reduce((s, c) => s + c.quantity, 0)} article(s)</span>
                      <span className="ml-3 font-mono font-bold text-route">{(total + deliveryFee).toFixed(2)} €</span>
                    </div>
                    <button onClick={() => setStep('checkout')}
                      className="px-6 py-2 bg-route text-paper rounded-lg font-semibold hover:bg-route/90">
                      Commander
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {step === 'checkout' && (
          <div>
            <button onClick={() => setStep('menu')} className="text-sm text-route mb-4 hover:underline">&larr; Retour au menu</button>

            <h2 className="text-xl font-heading text-ink mb-4">Votre commande</h2>

            <div className="bg-white rounded-xl border border-kraft p-4 mb-6">
              {cart.map((c) => (
                <div key={c.productId} className="flex items-center justify-between py-2 border-b border-kraft/30 last:border-0">
                  <span className="text-sm">{c.name}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQty(c.productId, -1)} className="w-7 h-7 rounded-full bg-kraft text-ink font-bold text-sm">-</button>
                    <span className="font-mono w-6 text-center">{c.quantity}</span>
                    <button onClick={() => updateQty(c.productId, 1)} className="w-7 h-7 rounded-full bg-route text-paper font-bold text-sm">+</button>
                    <span className="font-mono ml-2 w-16 text-right">{(c.price * c.quantity).toFixed(2)} €</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 text-sm space-y-1">
                <div className="flex justify-between"><span>Sous-total</span><span className="font-mono">{total.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span>Livraison</span><span className="font-mono">{deliveryFee.toFixed(2)} €</span></div>
                <div className="flex justify-between font-bold text-route border-t border-kraft pt-1">
                  <span>Total</span><span className="font-mono">{(total + deliveryFee).toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {error && <div className="bg-stop/10 text-stop text-sm p-3 rounded-lg mb-4">{error}</div>}

            <div className="space-y-3 mb-6">
              <input placeholder="Votre nom *" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input placeholder="Téléphone *" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input placeholder="Email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input placeholder="Adresse de livraison *" value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
                <option value="cash">Espèces</option>
                <option value="card">Carte bancaire</option>
                <option value="meal_voucher">Ticket restaurant</option>
              </select>
              <input placeholder="Code promo (optionnel)" value={form.promoCode} onChange={(e) => setForm({ ...form, promoCode: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm font-mono" />
            </div>

            <button onClick={submit} disabled={loading}
              className="w-full py-3 bg-go text-paper font-semibold rounded-lg text-lg hover:bg-go/90 disabled:opacity-50">
              {loading ? 'Envoi...' : 'Confirmer la commande'}
            </button>
          </div>
        )}

        {step === 'confirmation' && result && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">&#10003;</div>
            <h2 className="text-2xl font-heading text-go mb-2">Commande envoyée !</h2>
            <p className="text-lg font-mono text-route mb-4">{result.orderNumber}</p>
            <p className="text-ink/60 mb-6">Total: {parseFloat(result.total).toFixed(2)} €</p>
            <a href={`/track/${result.orderNumber}`}
              className="inline-block px-6 py-3 bg-route text-paper rounded-lg font-semibold hover:bg-route/90">
              Suivre ma commande
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
