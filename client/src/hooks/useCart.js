import { useState } from 'react';
import { api } from '../utils/api';

const DELIVERY_FEE = 2.50;

export default function useCart(businessId) {
  const [cart, setCart] = useState([]);
  const [promoResult, setPromoResult] = useState(null);

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

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((s, c) => s + parseFloat(c.price) * c.qty, 0);
  const discount = promoResult
    ? (promoResult.type === 'percentage' ? subtotal * promoResult.value / 100
      : promoResult.type === 'fixed' ? parseFloat(promoResult.value) : 0)
    : 0;
  const freeDelivery = promoResult?.type === 'free_delivery';
  const total = Math.max(0, subtotal + (freeDelivery ? 0 : DELIVERY_FEE) - discount);
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);

  const validatePromo = async (promoCode) => {
    if (!promoCode) return;
    try {
      const result = await api.post('/promos/validate', { code: promoCode, subtotal, businessId });
      setPromoResult(result);
    } catch (err) { alert(err.message); setPromoResult(null); }
  };

  const resetPromo = () => setPromoResult(null);

  return {
    cart, addToCart, updateQty, clearCart,
    subtotal, discount, freeDelivery, total, itemCount,
    deliveryFee: DELIVERY_FEE,
    promoResult, validatePromo, resetPromo,
  };
}
