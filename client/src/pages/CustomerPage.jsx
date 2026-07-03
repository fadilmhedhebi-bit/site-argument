import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import FoodlyLogo from '../components/FoodlyLogo';
import CartSummary from '../components/CartSummary';
import { useTheme } from '../ThemeContext';
import { colors } from '../theme';
import useCart from '../hooks/useCart';

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
  const [searchParams] = useSearchParams();
  const { t, isDark, toggleTheme } = useTheme();
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(null);
  const [view, setView] = useState('auth');
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });
  const [loyalty, setLoyalty] = useState(null);
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState({ business: null, categories: [], products: [] });
  const {
    cart, addToCart, updateQty, clearCart,
    subtotal, discount, freeDelivery, total, itemCount,
    deliveryFee, promoResult, validatePromo, resetPromo,
    orderType, setOrderType, hasDeliveryFee,
  } = useCart(businessId);
  const [orderStep, setOrderStep] = useState('menu');
  const [orderForm, setOrderForm] = useState({ deliveryAddress: '', deliveryNotes: '', paymentMethod: 'cash', promoCode: '', tableNumber: '' });
  const [confirmation, setConfirmation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetForm, setResetForm] = useState({ password: '', confirm: '' });
  const [resetMsg, setResetMsg] = useState('');
  const [verifyNotice, setVerifyNotice] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  useEffect(() => {
    const verifyToken = searchParams.get('verify');
    const resetT = searchParams.get('reset');

    if (verifyToken) {
      customerRequest('GET', `/customers/verify-email/${verifyToken}`)
        .then(data => {
          setToken(data.token);
          setCustomer(data.customer);
          localStorage.setItem(`foodly_customer_${businessId}`, JSON.stringify(data));
          setView('home');
        })
        .catch(() => { setView('auth'); });
      return;
    }

    if (resetT) {
      setResetMode(true);
      setResetToken(resetT);
      return;
    }

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
    if (token) loadCustomerData();
  }, [token]);

  useEffect(() => {
    if (customer) {
      setProfileForm({ firstName: customer.firstName || '', lastName: customer.lastName || '', phone: customer.phone || '' });
    }
  }, [customer]);

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
      if (err.message.includes('Token') || err.message.includes('401')) logout();
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
    } catch (err) {
      if (err.message.includes('vérifier votre adresse email')) {
        setVerifyNotice(true);
        setVerifyEmail(loginForm.email);
      } else {
        alert(err.message);
      }
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const data = await customerRequest('POST', '/customers/register', { businessId, ...registerForm });
      if (data.token && data.customer) {
        setToken(data.token);
        setCustomer(data.customer);
        localStorage.setItem(`foodly_customer_${businessId}`, JSON.stringify(data));
        setView('home');
      } else {
        setVerifyNotice(true);
        setVerifyEmail(registerForm.email);
      }
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    setLoading(true);
    try {
      const result = await customerRequest('POST', '/customers/forgot-password', { email: forgotEmail, businessId });
      setForgotMsg(result.message);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMsg('');
    if (resetForm.password.length < 6) return setResetMsg('6 caractères minimum');
    if (resetForm.password !== resetForm.confirm) return setResetMsg('Les mots de passe ne correspondent pas');
    setLoading(true);
    try {
      await customerRequest('POST', '/customers/reset-password', { token: resetToken, password: resetForm.password });
      setResetMsg('Mot de passe modifié ! Vous pouvez vous connecter.');
      setTimeout(() => { setResetMode(false); setResetToken(''); }, 2000);
    } catch (err) { setResetMsg(err.message); }
    finally { setLoading(false); }
  };

  const handleResendVerification = async () => {
    setResendMsg('');
    try {
      const result = await customerRequest('POST', '/customers/resend-verification', { email: verifyEmail, businessId });
      setResendMsg(result.message);
    } catch (err) { setResendMsg(err.message); }
  };

  const handleProfileSave = async () => {
    setProfileErr(''); setProfileMsg('');
    if (!profileForm.firstName?.trim() || !profileForm.lastName?.trim()) return setProfileErr('Prénom et nom requis');
    try {
      const updated = await customerRequest('PATCH', '/customers/me/profile', profileForm, token);
      setCustomer(updated);
      localStorage.setItem(`foodly_customer_${businessId}`, JSON.stringify({ token, customer: updated }));
      setProfileMsg('Profil mis à jour');
    } catch (err) { setProfileErr(err.message); }
  };

  const handlePasswordChange = async () => {
    setPasswordErr(''); setPasswordMsg('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword) return setPasswordErr('Tous les champs sont requis');
    if (passwordForm.newPassword.length < 6) return setPasswordErr('6 caractères minimum');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return setPasswordErr('Les mots de passe ne correspondent pas');
    try {
      await customerRequest('PATCH', '/customers/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }, token);
      setPasswordMsg('Mot de passe modifié');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { setPasswordErr(err.message); }
  };

  const logout = () => {
    setCustomer(null);
    setToken(null);
    setView('auth');
    localStorage.removeItem(`foodly_customer_${businessId}`);
  };

  const submitOrder = async () => {
    if (orderType === 'delivery' && !orderForm.deliveryAddress) return alert('Adresse de livraison requise');
    if (orderType === 'dine_in' && !orderForm.tableNumber) return alert('Numéro de table requis');
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
        orderType,
        tableNumber: orderForm.tableNumber,
        items: cart.map(c => ({ productId: c.id, quantity: c.qty })),
        deliveryFee: hasDeliveryFee ? deliveryFee : 0,
        customerId: customer.id,
      });
      setConfirmation(result);
      setOrderStep('confirmed');
      clearCart();
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

  const authGradient = isDark
    ? `linear-gradient(160deg, ${colors.tealDark}, #0C0A14)`
    : 'linear-gradient(160deg, #1C8275, #0D5650)';

  const inputStyle = { backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 };

  if (resetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: authGradient }}>
        <div className="rounded-[14px] shadow-sm w-full max-w-md p-8" style={{ backgroundColor: t.cardBg }}>
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3"><FoodlyLogo size={48} /></div>
            <h2 className="text-xl font-bold" style={{ color: t.text1 }}>Nouveau mot de passe</h2>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-3">
            <input type="password" placeholder="Nouveau mot de passe (6 car. min)" value={resetForm.password}
              onChange={e => setResetForm({ ...resetForm, password: e.target.value })}
              className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
            <input type="password" placeholder="Confirmer" value={resetForm.confirm}
              onChange={e => setResetForm({ ...resetForm, confirm: e.target.value })}
              className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
            {resetMsg && <p className="text-xs text-center" style={{ color: resetMsg.includes('modifié') ? t.greenText : colors.orange }}>{resetMsg}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: t.accent, color: '#fff' }}>
              {loading ? 'Modification...' : 'Modifier'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (verifyNotice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: authGradient }}>
        <div className="rounded-[14px] shadow-sm w-full max-w-md p-8 text-center" style={{ backgroundColor: t.cardBg }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: t.accentBg, color: t.accent }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: t.text1 }}>Vérifiez votre email</h2>
          <p className="text-sm mb-4" style={{ color: t.text2 }}>Un email de confirmation a été envoyé à <strong>{verifyEmail}</strong>. Cliquez sur le lien pour activer votre compte.</p>
          <button onClick={handleResendVerification} className="text-sm font-semibold hover:underline" style={{ color: t.accent }}>
            Renvoyer l'email
          </button>
          {resendMsg && <p className="text-xs mt-2" style={{ color: t.greenText }}>{resendMsg}</p>}
          <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
            <button onClick={() => { setVerifyNotice(false); setResendMsg(''); }}
              className="text-sm font-semibold hover:underline" style={{ color: t.accent }}>
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'auth') {
    if (forgotMode) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: authGradient }}>
          <div className="rounded-[14px] shadow-sm w-full max-w-md p-8" style={{ backgroundColor: t.cardBg }}>
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3"><FoodlyLogo size={48} /></div>
              <h2 className="text-xl font-bold" style={{ color: t.text1 }}>Mot de passe oublié</h2>
              <p className="text-sm mt-1" style={{ color: t.text2 }}>Entrez votre email pour recevoir un lien de réinitialisation.</p>
            </div>
            {forgotMsg ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: t.greenBg, color: t.greenText }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-sm mb-4" style={{ color: t.text1 }}>{forgotMsg}</p>
                <button onClick={() => { setForgotMode(false); setForgotMsg(''); setForgotEmail(''); }}
                  className="text-sm font-semibold hover:underline" style={{ color: t.accent }}>Retour à la connexion</button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input type="email" placeholder="Votre adresse email" value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                <button type="submit" disabled={loading || !forgotEmail}
                  className="w-full py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: t.accent, color: '#fff' }}>
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </form>
            )}
            <p className="text-center text-sm mt-4">
              <button onClick={() => { setForgotMode(false); setForgotMsg(''); }}
                className="font-semibold hover:underline" style={{ color: t.accent }}>Retour</button>
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: authGradient }}>
        <div className="rounded-[14px] shadow-sm w-full max-w-md p-8" style={{ backgroundColor: t.cardBg }}>
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3"><FoodlyLogo size={48} /></div>
            <h1 className="text-3xl font-bold tracking-[-1.5px]" style={{ color: t.text1 }}>foodly</h1>
            <p className="text-sm mt-1" style={{ color: t.text2 }}>Espace client</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button onClick={() => setAuthMode('login')}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={authMode === 'login' ? { backgroundColor: t.accent, color: '#fff' } : { backgroundColor: t.bg, color: t.text1 }}>
              Connexion
            </button>
            <button onClick={() => setAuthMode('register')}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={authMode === 'register' ? { backgroundColor: t.accent, color: '#fff' } : { backgroundColor: t.bg, color: t.text1 }}>
              Inscription
            </button>
          </div>

          {authMode === 'login' ? (
            <div className="space-y-3">
              <input type="email" placeholder="Email" value={loginForm.email}
                onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              <input type="password" placeholder="Mot de passe" value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              <div className="text-right">
                <button onClick={() => setForgotMode(true)} className="text-xs hover:underline" style={{ color: t.accent }}>
                  Mot de passe oublié ?
                </button>
              </div>
              <button onClick={handleLogin} disabled={loading}
                className="w-full py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: t.accent, color: '#fff' }}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Prénom *" value={registerForm.firstName}
                  onChange={e => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                  className="px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                <input placeholder="Nom *" value={registerForm.lastName}
                  onChange={e => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                  className="px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              </div>
              <input type="email" placeholder="Email *" value={registerForm.email}
                onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              <input placeholder="Téléphone" value={registerForm.phone}
                onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              <input type="password" placeholder="Mot de passe (6 car. min) *" value={registerForm.password}
                onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              <button onClick={handleRegister} disabled={loading}
                className="w-full py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: t.accent, color: '#fff' }}>
                {loading ? 'Inscription...' : 'Créer mon compte'}
              </button>
            </div>
          )}

          <p className="text-xs text-center mt-4" style={{ color: t.text3 }}>
            <a href={`/commander/${businessId}`} className="hover:underline" style={{ color: t.accent }}>Commander sans compte</a>
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
    <div style={{ backgroundColor: t.bg, minHeight: '100vh' }}>
      <header className="sticky top-0 z-40" style={{ backgroundColor: t.navBg, borderBottom: `1px solid ${t.border}` }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FoodlyLogo size={28} />
            <span className="text-lg font-bold tracking-[-1.5px]" style={{ color: t.text1 }}>foodly</span>
            <span className="text-xs ml-1" style={{ color: t.text2 }}>{customer?.businessName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: t.text2 }}>{customer?.firstName}</span>
            <button onClick={logout} className="text-xs text-stop hover:underline">Déconnexion</button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { id: 'home', label: 'Accueil' },
            { id: 'order', label: 'Commander' },
            { id: 'loyalty', label: 'Fidélité' },
            { id: 'history', label: 'Historique' },
            { id: 'settings', label: 'Paramètres' },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setView(tab.id); if (tab.id === 'order') setOrderStep('menu'); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors"
              style={view === tab.id
                ? { backgroundColor: t.accent, color: '#fff' }
                : { backgroundColor: t.bg, color: t.text1 }
              }>
              {tab.label}
            </button>
          ))}
        </div>

        {view === 'home' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-3" style={{ backgroundColor: t.accentBg, color: t.accent }}>
                {customer?.firstName?.[0]}{customer?.lastName?.[0]}
              </div>
              <h2 className="text-xl font-heading" style={{ color: t.text1 }}>Bonjour, {customer?.firstName} !</h2>
              <p className="text-sm mt-1" style={{ color: t.text2 }}>{customer?.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <p className="text-xs" style={{ color: t.text2 }}>Points fidélité</p>
                <p className="text-2xl font-heading mt-1" style={{ color: t.accent }}>{customer?.loyaltyPoints || 0}</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <p className="text-xs" style={{ color: t.text2 }}>Commandes</p>
                <p className="text-2xl font-heading mt-1" style={{ color: t.text1 }}>{customer?.totalOrders || 0}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Notre carte</h3>
              <div className="flex flex-col gap-2">
                {['Entrées', 'Tapas', 'Plats', 'Desserts', 'Cocktails', 'Mocktails', 'Softs'].map(label => (
                  <button key={label} onClick={() => { setView('order'); setOrderStep('menu'); }}
                    className="flex items-center px-4 py-3 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                    <span className="text-sm font-semibold" style={{ color: t.text1 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => { setView('order'); setOrderStep('menu'); }}
                className="rounded-xl p-4 text-left hover:opacity-90 transition-colors"
                style={{ backgroundColor: t.accent, color: '#fff' }}>
                <p className="font-semibold">Passer commande</p>
                <p className="text-xs mt-1" style={{ opacity: 0.7 }}>Parcourir le menu</p>
              </button>
              <button onClick={() => setView('loyalty')}
                className="rounded-xl p-4 text-left transition-colors"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <p className="font-semibold" style={{ color: t.text1 }}>Ma carte de fidélité</p>
                <p className="text-xs mt-1" style={{ color: t.text2 }}>{customer?.loyaltyPoints || 0} points disponibles</p>
              </button>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: t.text2 }}>Apparence</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm" style={{ color: t.text1 }}>Mode sombre</p>
                  <p className="text-xs" style={{ color: t.text2 }}>{isDark ? 'Activé' : 'Désactivé'}</p>
                </div>
                <button onClick={toggleTheme}
                  className="relative w-12 h-7 rounded-full transition-colors"
                  style={{ backgroundColor: isDark ? t.accent : t.text3 }}>
                  <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow-sm"
                    style={{ left: isDark ? '22px' : '2px' }} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: t.text2 }}>Profil</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Prénom</label>
                    <input value={profileForm.firstName} onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Nom</label>
                    <input value={profileForm.lastName} onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Téléphone</label>
                  <input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                </div>
                {profileErr && <p className="text-xs" style={{ color: colors.orange }}>{profileErr}</p>}
                {profileMsg && <p className="text-xs" style={{ color: t.greenText }}>{profileMsg}</p>}
                <button onClick={handleProfileSave}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: t.accent, color: '#fff' }}>
                  Enregistrer
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: t.text2 }}>Mot de passe</h3>
              <div className="space-y-3">
                <input type="password" placeholder="Mot de passe actuel" value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                <input type="password" placeholder="Nouveau mot de passe (6 car. min)" value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                <input type="password" placeholder="Confirmer" value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                {passwordErr && <p className="text-xs" style={{ color: colors.orange }}>{passwordErr}</p>}
                {passwordMsg && <p className="text-xs" style={{ color: t.greenText }}>{passwordMsg}</p>}
                <button onClick={handlePasswordChange}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: t.accent, color: '#fff' }}>
                  Modifier le mot de passe
                </button>
              </div>
            </div>

            <button onClick={logout}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: isDark ? '#3B1C1C' : '#FEF2F2', color: '#EF4444' }}>
              Se déconnecter
            </button>
          </div>
        )}

        {view === 'loyalty' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-6 text-white" style={{ background: isDark ? `linear-gradient(160deg, ${colors.tealDark}, #0C0A14)` : 'linear-gradient(160deg, #1C8275, #0D5650)' }}>
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
                <h3 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Récompenses disponibles</h3>
                <div className="space-y-2">
                  {loyalty.rewards.map(r => (
                    <div key={r.id} className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: t.text1 }}>{r.name}</p>
                        {r.description && <p className="text-xs" style={{ color: t.text2 }}>{r.description}</p>}
                        <p className="text-xs font-mono mt-1" style={{ color: t.accent }}>{r.points_cost} points</p>
                      </div>
                      <button onClick={() => redeemReward(r.id)}
                        disabled={(loyalty?.points || 0) < r.points_cost}
                        className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-30"
                        style={{ backgroundColor: t.accent, color: '#fff' }}>
                        Échanger
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loyalty?.transactions?.length > 0 && (
              <div>
                <h3 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Historique des points</h3>
                <div className="rounded-xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                  {loyalty.transactions.map((txn, i) => (
                    <div key={txn.id} className="px-4 py-3 flex items-center justify-between" style={i > 0 ? { borderTop: `1px solid ${t.border}` } : undefined}>
                      <div>
                        <p className="text-sm" style={{ color: t.text1 }}>{txn.description}</p>
                        <p className="text-xs" style={{ color: t.text2 }}>{new Date(txn.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <span className="font-mono text-sm font-bold" style={{ color: txn.points > 0 ? t.greenText : '#EF4444' }}>
                        {txn.points > 0 ? '+' : ''}{txn.points}
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
            <h3 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>Mes commandes</h3>
            {orders.length > 0 ? orders.map(o => (
              <div key={o.order_number} className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <div>
                  <span className="font-mono font-bold text-sm" style={{ color: t.accent }}>{o.order_number}</span>
                  <p className="text-xs mt-0.5" style={{ color: t.text2 }}>{new Date(o.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm" style={{ color: t.text1 }}>{parseFloat(o.total).toFixed(2)} €</span>
                  <p className="text-xs mt-0.5"
                    style={{ color: o.status === 'delivered' ? t.greenText : o.status === 'cancelled' ? '#EF4444' : t.accent }}>
                    {statusLabels[o.status] || o.status}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-center py-8" style={{ color: t.text3 }}>Aucune commande</p>
            )}
          </div>
        )}

        {view === 'order' && orderStep === 'menu' && (
          <div className="space-y-6">
            {cart.length > 0 && (
              <button onClick={() => setOrderStep('checkout')}
                className="w-full py-3 rounded-xl font-semibold text-sm sticky top-16 z-30"
                style={{ backgroundColor: t.accent, color: '#fff' }}>
                Voir le panier ({itemCount}) · {subtotal.toFixed(2)} €
              </button>
            )}

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
            )}
            {menu.products.length === 0 && <p className="text-center py-12" style={{ color: t.text2 }}>Le menu est vide</p>}
          </div>
        )}

        {view === 'order' && orderStep === 'checkout' && (
          <div className="space-y-4">
            <button onClick={() => setOrderStep('menu')} className="text-sm hover:underline" style={{ color: t.accent }}>← Retour au menu</button>

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
              <h2 className="text-sm font-heading mb-3" style={{ color: t.text1 }}>
                {orderType === 'dine_in' ? 'Sur place' : orderType === 'takeaway' ? 'À emporter' : 'Livraison'}
              </h2>
              <div className="space-y-3">
                {orderType === 'dine_in' && (
                  <input placeholder="Numéro de table *" value={orderForm.tableNumber}
                    onChange={e => setOrderForm({ ...orderForm, tableNumber: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                )}
                {orderType === 'delivery' && (
                  <>
                    <input placeholder="Adresse de livraison *" value={orderForm.deliveryAddress}
                      onChange={e => setOrderForm({ ...orderForm, deliveryAddress: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                    <textarea placeholder="Notes (étage, code...)" value={orderForm.deliveryNotes}
                      onChange={e => setOrderForm({ ...orderForm, deliveryNotes: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} rows={2} />
                  </>
                )}
                <div>
                  <p className="text-xs mb-2" style={{ color: t.text2 }}>Mode de paiement</p>
                  <div className="flex gap-2">
                    {[{ v: 'cash', l: 'Espèces' }, { v: 'card', l: 'Carte' }, { v: 'meal_voucher', l: 'Ticket resto' }].map(m => (
                      <button key={m.v} onClick={() => setOrderForm({ ...orderForm, paymentMethod: m.v })}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                        style={orderForm.paymentMethod === m.v
                          ? { backgroundColor: t.accent, color: '#fff' }
                          : { backgroundColor: t.bg, color: t.text1 }
                        }>
                        {m.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input placeholder="Code promo" value={orderForm.promoCode}
                    onChange={e => setOrderForm({ ...orderForm, promoCode: e.target.value })}
                    className="flex-1 px-4 py-2.5 rounded-lg focus:outline-none text-sm font-mono uppercase" style={inputStyle} />
                  <button onClick={() => validatePromo(orderForm.promoCode)} className="px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.border, color: t.text1 }}>Appliquer</button>
                </div>
                {promoResult && (
                  <p className="text-xs" style={{ color: t.greenText }}>
                    Code appliqué : {promoResult.type === 'percentage' ? `${promoResult.value}%` : promoResult.type === 'fixed' ? `${promoResult.value} €` : 'Livraison gratuite'}
                  </p>
                )}
              </div>
            </div>

            <button onClick={submitOrder} disabled={submitting || cart.length === 0}
              className="w-full py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
              style={{ backgroundColor: t.accent, color: '#fff' }}>
              {submitting ? 'Envoi...' : `Commander · ${total.toFixed(2)} €`}
            </button>
          </div>
        )}

        {view === 'order' && orderStep === 'confirmed' && confirmation && (
          <div className="text-center py-12">
            <div className="rounded-2xl p-8 max-w-md mx-auto" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: t.greenBg, color: t.greenText }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-xl font-heading mb-2" style={{ color: t.text1 }}>Commande confirmée !</h2>
              <p className="text-3xl font-mono font-bold mb-4" style={{ color: t.accent }}>{confirmation.orderNumber}</p>
              <p className="text-sm mb-6" style={{ color: t.text2 }}>Des points de fidélité ont été ajoutés à votre compte !</p>
              <div className="flex gap-3">
                <a href={`/suivi/${confirmation.orderNumber}`}
                  className="flex-1 py-3 rounded-lg font-semibold text-sm text-center no-underline"
                  style={{ backgroundColor: t.accent, color: '#fff' }}>
                  Suivre
                </a>
                <button onClick={() => { setView('home'); setOrderStep('menu'); setConfirmation(null); resetPromo(); setOrderType('delivery'); setOrderForm({ deliveryAddress: '', deliveryNotes: '', paymentMethod: 'cash', promoCode: '', tableNumber: '' }); }}
                  className="flex-1 py-3 rounded-lg font-semibold text-sm"
                  style={{ backgroundColor: t.border, color: t.text1 }}>
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
