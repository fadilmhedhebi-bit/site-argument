import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../ThemeContext';
import { api } from '../utils/api';
import { shadows } from '../theme';

const STATUS_LABEL = {
  trialing: 'Période d\'essai',
  active: 'Actif',
  past_due: 'Paiement en échec',
  canceled: 'Résilié',
  suspended: 'Suspendu',
};

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuthStore();
  const { t, isDark, toggleTheme, applyBusinessColors } = useTheme();
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(null);
  const [billingErr, setBillingErr] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const [brandColors, setBrandColors] = useState({ primaryColor: '#1C8275', secondaryColor: '#3140A8' });
  const [brandMsg, setBrandMsg] = useState('');
  const [brandErr, setBrandErr] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const isManager = ['manager', 'manager_driver'].includes(user?.role);

  useEffect(() => {
    if (isManager) api.get('/billing/status').then(setBilling).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    if (!isManager) return;
    api.get('/auth/business/branding').then(data => {
      setBrandColors({
        primaryColor: data.primaryColor || '#1C8275',
        secondaryColor: data.secondaryColor || '#3140A8',
      });
    }).catch(() => {});
  }, [isManager]);

  const handleBrandSave = async () => {
    setBrandErr('');
    setBrandMsg('');
    setBrandSaving(true);
    try {
      await api.patch('/auth/business/branding', brandColors);
      applyBusinessColors(brandColors);
      setBrandMsg('Couleurs mises à jour');
    } catch (err) {
      setBrandErr(err.message);
    } finally {
      setBrandSaving(false);
    }
  };

  const goToCheckout = async () => {
    setBillingErr('');
    setBillingLoading(true);
    try {
      const { url } = await api.post('/billing/checkout', {});
      window.location.href = url;
    } catch (err) {
      setBillingErr(err.message);
      setBillingLoading(false);
    }
  };

  const goToPortal = async () => {
    setBillingErr('');
    setBillingLoading(true);
    try {
      const { url } = await api.post('/billing/portal', {});
      window.location.href = url;
    } catch (err) {
      setBillingErr(err.message);
      setBillingLoading(false);
    }
  };

  const avatarUrl = user?.avatarUrl ? `${API_BASE.replace('/api', '')}${user.avatarUrl}` : null;

  const handleProfileSave = async () => {
    setProfileErr('');
    setProfileMsg('');
    if (!profileForm.firstName?.trim() || !profileForm.lastName?.trim()) {
      return setProfileErr('Prénom et nom sont requis');
    }
    setSaving(true);
    try {
      const updated = await api.patch('/auth/profile', profileForm);
      updateUser({ firstName: updated.firstName, lastName: updated.lastName });
      setProfileMsg('Profil mis à jour');
    } catch (err) {
      setProfileErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordErr('');
    setPasswordMsg('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      return setPasswordErr('Tous les champs sont requis');
    }
    if (passwordForm.newPassword.length < 6) {
      return setPasswordErr('6 caractères minimum');
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return setPasswordErr('Les mots de passe ne correspondent pas');
    }
    setSaving(true);
    try {
      await api.patch('/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMsg('Mot de passe modifié');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setProfileErr('Image trop volumineuse (max 2 Mo)');

    setUploading(true);
    setProfileErr('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const result = await api.upload('/auth/avatar', formData);
      updateUser({ avatarUrl: result.avatarUrl });
      setProfileMsg('Photo de profil mise à jour');
    } catch (err) {
      setProfileErr(err.message);
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = { backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: t.text1 }}>Paramètres</h1>
        <button onClick={() => navigate(-1)} className="text-sm hover:underline" style={{ color: t.accent }}>
          Retour
        </button>
      </div>

      {/* Theme */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: shadows.card }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: t.text2 }}>Apparence</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium" style={{ color: t.text1 }}>Mode sombre</p>
            <p className="text-xs mt-0.5" style={{ color: t.text2 }}>
              {isDark ? 'Le mode sombre est activé' : 'Le mode clair est activé'}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="relative w-12 h-7 rounded-full transition-colors"
            style={{ backgroundColor: isDark ? t.accent : t.text3 }}
          >
            <span
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow-sm"
              style={{ left: isDark ? '22px' : '2px' }}
            />
          </button>
        </div>
      </div>

      {/* Branding */}
      {isManager && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: shadows.card }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: t.text2 }}>Couleurs du commerce</h2>
          <p className="text-xs mb-4" style={{ color: t.text2 }}>
            Personnalisez les couleurs affichées à vos clients et sur votre interface.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Couleur primaire</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColors.primaryColor}
                  onChange={e => setBrandColors({ ...brandColors, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: 'transparent' }}
                />
                <input
                  value={brandColors.primaryColor}
                  onChange={e => setBrandColors({ ...brandColors, primaryColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl focus:outline-none text-sm"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Couleur secondaire</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColors.secondaryColor}
                  onChange={e => setBrandColors({ ...brandColors, secondaryColor: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: 'transparent' }}
                />
                <input
                  value={brandColors.secondaryColor}
                  onChange={e => setBrandColors({ ...brandColors, secondaryColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl focus:outline-none text-sm"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
          {brandErr && <p className="text-xs mb-3" style={{ color: '#D97706' }}>{brandErr}</p>}
          {brandMsg && <p className="text-xs mb-3" style={{ color: t.greenText }}>{brandMsg}</p>}
          <button
            onClick={handleBrandSave}
            disabled={brandSaving}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: t.accent, color: '#fff' }}
          >
            {brandSaving ? 'Enregistrement...' : 'Enregistrer les couleurs'}
          </button>
        </div>
      )}

      {/* Profile */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: shadows.card }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: t.text2 }}>Profil</h2>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: t.accent }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: t.accent, color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>
          <div>
            <p className="font-semibold" style={{ color: t.text1 }}>{user?.firstName} {user?.lastName}</p>
            <p className="text-xs" style={{ color: t.text2 }}>{user?.email || user?.username}</p>
            {uploading && <p className="text-xs mt-1" style={{ color: t.accent }}>Upload en cours...</p>}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Prénom</label>
              <input
                value={profileForm.firstName}
                onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Nom</label>
              <input
                value={profileForm.lastName}
                onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
                style={inputStyle}
              />
            </div>
          </div>
          {profileErr && <p className="text-xs" style={{ color: '#D97706' }}>{profileErr}</p>}
          {profileMsg && <p className="text-xs" style={{ color: t.greenText }}>{profileMsg}</p>}
          <button
            onClick={handleProfileSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: t.accent, color: '#fff' }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Facturation */}
      {isManager && billing && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: shadows.card }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: t.text2 }}>Facturation</h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium" style={{ color: t.text1 }}>Statut de l'abonnement</p>
              <p className="text-xs mt-0.5" style={{ color: t.text2 }}>
                {billing.subscription_status === 'trialing' && billing.trial_ends_at
                  ? `Essai jusqu'au ${new Date(billing.trial_ends_at).toLocaleDateString('fr-FR')}`
                  : billing.current_period_end
                  ? `Prochain renouvellement le ${new Date(billing.current_period_end).toLocaleDateString('fr-FR')}`
                  : 'Aucun abonnement Stripe actif'}
              </p>
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={
                billing.subscription_status === 'active'
                  ? { backgroundColor: t.greenBg, color: t.greenText }
                  : ['past_due', 'suspended', 'canceled'].includes(billing.subscription_status)
                  ? { backgroundColor: t.orangeBg, color: t.orangeText }
                  : { backgroundColor: t.blueBg, color: t.blueText }
              }
            >
              {STATUS_LABEL[billing.subscription_status] || billing.subscription_status}
            </span>
          </div>
          {billingErr && <p className="text-xs mb-3" style={{ color: '#D97706' }}>{billingErr}</p>}
          <button
            onClick={billing.subscription_status === 'active' || billing.subscription_status === 'past_due' ? goToPortal : goToCheckout}
            disabled={billingLoading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: t.accent, color: '#fff' }}
          >
            {billingLoading
              ? 'Redirection...'
              : billing.subscription_status === 'active' || billing.subscription_status === 'past_due'
              ? 'Gérer mon abonnement'
              : 'Démarrer mon abonnement'}
          </button>
        </div>
      )}

      {/* Password */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: shadows.card }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: t.text2 }}>Mot de passe</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Mot de passe actuel</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Nouveau mot de passe</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              placeholder="6 caractères minimum"
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Confirmer</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
              style={inputStyle}
            />
          </div>
          {passwordErr && <p className="text-xs" style={{ color: '#D97706' }}>{passwordErr}</p>}
          {passwordMsg && <p className="text-xs" style={{ color: t.greenText }}>{passwordMsg}</p>}
          <button
            onClick={handlePasswordChange}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: t.accent, color: '#fff' }}
          >
            Modifier le mot de passe
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: shadows.card }}>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-colors"
          style={{ backgroundColor: isDark ? '#3B1C1C' : '#FEF2F2', color: '#EF4444' }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
