import { useTheme } from '../ThemeContext';

export default function CartSummary({ cart, updateQty, subtotal, deliveryFee, freeDelivery, discount, total }) {
  const { t } = useTheme();

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
      <h2 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Votre panier</h2>
      <div className="space-y-2">
        {cart.map(c => (
          <div key={c.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(c.id, -1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full text-xs font-bold" style={{ backgroundColor: t.border, color: t.text1 }}>-</button>
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
        {discount > 0 && <div className="flex justify-between" style={{ color: t.greenText }}><span>Remise</span><span className="font-mono">-{discount.toFixed(2)} €</span></div>}
        <div className="flex justify-between font-bold pt-2" style={{ color: t.text1, borderTop: `1px solid ${t.border}` }}>
          <span>Total</span><span className="font-mono" style={{ color: t.accent }}>{total.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  );
}
