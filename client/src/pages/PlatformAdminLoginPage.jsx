import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RestoLabLogo from '../components/RestoLabLogo';
import { useTheme } from '../ThemeContext';
import { colors } from '../theme';
import { api, setApiToken } from '../utils/api';

const STORAGE_KEY = 'restolab-platform-admin-token';

export default function PlatformAdminLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, isDark } = useTheme();

  const splashBg = isDark
    ? `linear-gradient(160deg, ${colors.tealDark}, ${colors.darkBg})`
    : 'linear-gradient(160deg, #1C8275, #0D5650)';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.post('/platform-admin/login', form);
      setApiToken(result.token);
      localStorage.setItem(STORAGE_KEY, result.token);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: splashBg }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><RestoLabLogo size={72} /></div>
          <h1 className="text-2xl font-bold text-white tracking-[-1px]">restolab admin</h1>
          <p className="text-sm text-white/70 mt-1">Espace réservé à l'équipe RestoLab</p>
        </div>

        <form onSubmit={handleSubmit} className="shadow-sm p-8 space-y-4" style={{ backgroundColor: t.cardBg, borderRadius: '14px' }}>
          <div>
            <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
              style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: t.text2 }}>Mot de passe</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
              style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: '#D97706' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: t.accent }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
