import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RestoLabLogo from '../components/RestoLabLogo';
import { useTheme } from '../ThemeContext';
import { shadows } from '../theme';
import { api, setApiToken } from '../utils/api';

const STORAGE_KEY = 'restolab-platform-admin-token';

const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'canceled', 'suspended'];
const STATUS_LABEL = {
  trialing: 'Essai',
  active: 'Actif',
  past_due: 'Paiement échoué',
  canceled: 'Résilié',
  suspended: 'Suspendu',
};

function statusStyle(status, t) {
  if (status === 'active') return { backgroundColor: t.greenBg, color: t.greenText };
  if (['past_due', 'suspended', 'canceled'].includes(status)) return { backgroundColor: t.orangeBg, color: t.orangeText };
  return { backgroundColor: t.blueBg, color: t.blueText };
}

export default function PlatformAdminDashboardPage() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = (status) => {
    api.get(`/platform-admin/businesses${status ? `?status=${status}` : ''}`)
      .then(setBusinesses)
      .catch(err => {
        setError(err.message);
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem(STORAGE_KEY);
          navigate('/admin/login');
        }
      });
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return navigate('/admin/login');
    setApiToken(saved);
    load('');
  }, []);

  const applyOverride = async (id, subscriptionStatus) => {
    setSavingId(id);
    try {
      await api.patch(`/platform-admin/businesses/${id}/subscription`, { subscriptionStatus });
      load(filter);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiToken(null);
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: t.bg }}>
      <header className="sticky top-0 z-10" style={{ backgroundColor: t.navBg, borderBottom: `1px solid ${t.border}` }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <RestoLabLogo size={28} />
            <span className="text-lg font-bold" style={{ color: t.text1 }}>restolab admin</span>
          </div>
          <button onClick={logout} className="text-xs" style={{ color: t.text2 }}>Déconnexion</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-xl font-bold" style={{ color: t.text1 }}>Commerces ({businesses?.length ?? '...'})</h1>
          <select
            value={filter}
            onChange={e => { setFilter(e.target.value); load(e.target.value); }}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }}
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#D97706' }}>{error}</p>}

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: shadows.card }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: t.tabBg }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: t.text2 }}>Commerce</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: t.text2 }}>Statut</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: t.text2 }}>Échéance</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: t.text2 }}>Échec paiement</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: t.text2 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(businesses || []).map(b => (
                <tr key={b.id} style={{ borderTop: `1px solid ${t.border}` }}>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: t.text1 }}>{b.name}</p>
                    <p className="text-xs" style={{ color: t.text2 }}>{b.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-semibold" style={statusStyle(b.subscription_status, t)}>
                      {STATUS_LABEL[b.subscription_status] || b.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: t.text2 }}>
                    {b.subscription_status === 'trialing' && b.trial_ends_at
                      ? new Date(b.trial_ends_at).toLocaleDateString('fr-FR')
                      : b.current_period_end
                      ? new Date(b.current_period_end).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: t.text2 }}>
                    {b.payment_failed_at ? new Date(b.payment_failed_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={savingId === b.id}
                      value=""
                      onChange={e => e.target.value && applyOverride(b.id, e.target.value)}
                      className="px-2 py-1.5 rounded-lg text-xs"
                      style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }}
                    >
                      <option value="">Forcer le statut...</option>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {businesses?.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: t.text2 }}>Aucun commerce</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
