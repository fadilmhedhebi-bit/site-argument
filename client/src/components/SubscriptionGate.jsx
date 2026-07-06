import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useTheme } from '../ThemeContext';
import { useAuthStore } from '../stores/authStore';
import RestoLabLogo from './RestoLabLogo';

function daysLeft(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)));
}

export default function SubscriptionGate({ children }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const user = useAuthStore((s) => s.user);
  const [billing, setBilling] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    api.get('/billing/status').then(setBilling).catch(() => {});
  }, []);

  if (!billing) return children;

  const isManager = ['manager', 'manager_driver'].includes(user?.role);

  const graceEnd = billing.payment_failed_at
    ? new Date(new Date(billing.payment_failed_at).getTime() + billing.gracePeriodDays * 86400000)
    : null;
  const inGrace = billing.subscription_status === 'past_due' && graceEnd && graceEnd > new Date();
  const trialExpired = billing.subscription_status === 'trialing' && daysLeft(billing.trial_ends_at) === 0;
  const blocked = ['canceled', 'suspended'].includes(billing.subscription_status)
    || (billing.subscription_status === 'past_due' && !inGrace)
    || trialExpired;

  const startCheckout = async () => {
    setActionLoading(true);
    try {
      const { url } = await api.post('/billing/checkout', {});
      window.location.href = url;
    } catch (err) {
      alert(err.message);
      setActionLoading(false);
    }
  };

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: t.bg }}>
        <div className="max-w-md w-full text-center p-8 rounded-2xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <div className="flex justify-center mb-4"><RestoLabLogo size={48} /></div>
          <h1 className="text-lg font-bold mb-2" style={{ color: t.text1 }}>Accès suspendu</h1>
          <p className="text-sm mb-6" style={{ color: t.text2 }}>
            {trialExpired
              ? "Votre période d'essai est terminée. Démarrez votre abonnement pour continuer à utiliser RestoLab."
              : "Le paiement de l'abonnement de votre commerce a échoué et la période de grâce est dépassée."}
          </p>
          {isManager ? (
            <button
              onClick={startCheckout}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl font-semibold text-white mb-3"
              style={{ backgroundColor: t.accent }}
            >
              {actionLoading ? 'Redirection...' : 'Démarrer / régulariser mon abonnement'}
            </button>
          ) : (
            <p className="text-xs mb-3" style={{ color: t.text2 }}>Contactez votre gestionnaire pour régulariser l'abonnement.</p>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} className="text-xs underline" style={{ color: t.text2 }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const showTrialBanner = billing.subscription_status === 'trialing' && daysLeft(billing.trial_ends_at) <= 7;
  const showGraceBanner = billing.subscription_status === 'past_due' && inGrace;

  return (
    <>
      {(showTrialBanner || showGraceBanner) && (
        <div
          className="px-4 py-2 text-sm text-center font-medium flex items-center justify-center gap-3 flex-wrap"
          style={showGraceBanner ? { backgroundColor: t.orangeBg, color: t.orangeText } : { backgroundColor: t.blueBg, color: t.blueText }}
        >
          <span>
            {showGraceBanner
              ? "Échec de paiement : votre accès passera en lecture seule bientôt. Mettez à jour votre moyen de paiement."
              : `Essai gratuit : ${daysLeft(billing.trial_ends_at)} jour(s) restant(s).`}
          </span>
          {isManager && (
            <button onClick={() => navigate('/settings')} className="underline font-semibold">
              Gérer mon abonnement
            </button>
          )}
        </div>
      )}
      {children}
    </>
  );
}
