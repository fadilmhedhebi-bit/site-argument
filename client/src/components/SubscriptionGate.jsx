import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useTheme } from '../ThemeContext';
import { useAuthStore } from '../stores/authStore';

function daysLeft(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)));
}

const READ_ONLY_REASON = {
  trialing: "Votre période d'essai est terminée",
  past_due: "L'échec de paiement dépasse la période de grâce",
  canceled: 'Votre abonnement est résilié',
  suspended: 'Votre abonnement est suspendu',
};

export default function SubscriptionGate({ children }) {
  const { t } = useTheme();
  const navigate = useNavigate();
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
  const readOnly = ['canceled', 'suspended'].includes(billing.subscription_status)
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

  const showTrialBanner = billing.subscription_status === 'trialing' && !trialExpired && daysLeft(billing.trial_ends_at) <= 7;
  const showGraceBanner = billing.subscription_status === 'past_due' && inGrace;

  return (
    <>
      {readOnly && (
        <div
          className="px-4 py-2.5 text-sm text-center font-medium flex items-center justify-center gap-3 flex-wrap"
          style={{ backgroundColor: t.redBg, color: t.redText }}
        >
          <span>
            {READ_ONLY_REASON[billing.subscription_status] || 'Abonnement inactif'} — accès en lecture seule, les actions sont désactivées.
          </span>
          {isManager ? (
            <button onClick={startCheckout} disabled={actionLoading} className="underline font-semibold">
              {actionLoading ? 'Redirection...' : 'Démarrer / régulariser mon abonnement'}
            </button>
          ) : (
            <span className="text-xs opacity-80">Contactez votre gestionnaire</span>
          )}
        </div>
      )}
      {!readOnly && (showTrialBanner || showGraceBanner) && (
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
