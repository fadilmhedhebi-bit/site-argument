import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import { api } from '../utils/api';
import FoodlyLogo from '../components/FoodlyLogo';
import { colors, shadows } from '../theme';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, isDark } = useTheme();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('6 caractères minimum');
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark
    ? `linear-gradient(160deg, ${colors.tealDark}, #0C0A14)`
    : 'linear-gradient(160deg, #1C8275, #0D5650)';

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
        <div className="w-full max-w-md rounded-2xl p-8 text-center" style={{ backgroundColor: t.cardBg }}>
          <p className="text-sm" style={{ color: t.text2 }}>Lien invalide</p>
          <button onClick={() => navigate('/login')} className="mt-4 px-6 py-3 rounded-xl font-semibold text-sm text-white" style={{ backgroundColor: t.accent }}>
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><FoodlyLogo size={64} /></div>
          <h1 className="text-3xl font-bold text-white tracking-[-1.5px]">foodly</h1>
        </div>

        <div className="rounded-2xl p-8" style={{ backgroundColor: t.cardBg }}>
          {success ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: t.greenBg, color: t.greenText }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: t.text1 }}>Mot de passe modifié</h2>
              <p className="text-sm mb-6" style={{ color: t.text2 }}>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
              <button onClick={() => navigate('/login')} className="w-full py-3 rounded-xl font-semibold text-sm text-white" style={{ background: 'linear-gradient(160deg, #1C8275, #0D5650)', boxShadow: shadows.cta }}>
                Se connecter
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-1" style={{ color: t.text1 }}>Nouveau mot de passe</h2>
              <p className="text-sm mb-6" style={{ color: t.text2 }}>Choisissez un nouveau mot de passe pour votre compte.</p>
              <form onSubmit={handleReset} className="space-y-4">
                <input
                  type="password" placeholder="Nouveau mot de passe (6 car. min)"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none text-sm"
                  style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }}
                />
                <input
                  type="password" placeholder="Confirmer le mot de passe"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none text-sm"
                  style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }}
                />
                {error && <p className="text-sm" style={{ color: colors.orange }}>{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(160deg, #1C8275, #0D5650)', boxShadow: shadows.cta }}>
                  {loading ? 'Modification...' : 'Modifier le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
