import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../ThemeContext';
import { api } from '../utils/api';
import RestoLabLogo from '../components/RestoLabLogo';
import { colors } from '../theme';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useAuthStore();
  const { t, isDark } = useTheme();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  const token = params.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Lien de vérification invalide');
      return;
    }
    api.get(`/auth/verify-email/${token}`)
      .then(data => {
        setStatus('success');
        setMessage(data.message);
        if (data.token) {
          setToken(data.token);
          useAuthStore.setState({ user: data.user });
        }
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [token]);

  const bg = isDark
    ? `linear-gradient(160deg, ${colors.tealDark}, #0C0A14)`
    : 'linear-gradient(160deg, #1C8275, #0D5650)';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
      <div className="w-full max-w-md rounded-2xl p-8 text-center" style={{ backgroundColor: t.cardBg }}>
        <RestoLabLogo size={48} />
        <h1 className="text-2xl font-bold mt-4 mb-2" style={{ color: t.text1 }}>
          {status === 'loading' ? 'Vérification...' : status === 'success' ? 'Email vérifié !' : 'Erreur'}
        </h1>
        <p className="text-sm mb-6" style={{ color: t.text2 }}>{message || 'Vérification en cours...'}</p>
        {status === 'success' && (
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white"
            style={{ backgroundColor: t.accent }}
          >
            Accéder au tableau de bord
          </button>
        )}
        {status === 'error' && (
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white"
            style={{ backgroundColor: t.accent }}
          >
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );
}
