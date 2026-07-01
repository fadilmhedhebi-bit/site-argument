import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import FoodlyLogo from '../components/FoodlyLogo';
import { useTheme } from '../ThemeContext';
import { colors, shadows } from '../theme';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuthStore();
  const { t, isDark } = useTheme();

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({
    firstName: '', lastName: '', email: '', username: '', password: '',
    businessName: '', businessAddress: '', businessPhone: '',
  });

  const splashBg = isDark
    ? `linear-gradient(160deg, ${colors.tealDark}, ${colors.darkBg})`
    : 'linear-gradient(160deg, #1C8275, #0D5650)';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginForm.username, loginForm.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      await register(regForm);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    setError('');
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      if (!regForm.firstName || !regForm.lastName || !regForm.username || !regForm.password) {
        return setError('Tous les champs obligatoires doivent être remplis');
      }
      if (regForm.password.length < 6) return setError('Mot de passe : 6 caractères minimum');
      setStep(2);
    } else if (step === 2) {
      if (!regForm.businessName) return setError('Le nom du commerce est requis');
      handleRegister();
    }
  };

  if (mode === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: splashBg }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <FoodlyLogo size={88} />
            </div>
            <h1 className="text-[44px] font-bold text-white tracking-[-1.5px] leading-none">foodly</h1>
            <p className="text-white/55 mt-2 text-sm leading-relaxed">Gestion de livraison simplifiée</p>
          </div>

          <div className="shadow-sm p-8" style={{ backgroundColor: t.cardBg, borderRadius: '14px' }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: t.text1 }}>Connexion</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text" placeholder="Nom d'utilisateur" value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full px-4 py-3 rounded-[14px] focus:outline-none text-sm"
                style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }}
              />
              <input
                type="password" placeholder="Mot de passe" value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-3 rounded-[14px] focus:outline-none text-sm"
                style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }}
              />
              {error && <p className="text-sm" style={{ color: colors.orange }}>{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full py-4 rounded-[14px] font-semibold text-[15px] transition-colors disabled:opacity-50"
                style={{ background: 'linear-gradient(160deg, #1C8275, #0D5650)', color: 'white', boxShadow: shadows.cta }}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
            <p className="text-center text-sm mt-6" style={{ color: t.text2 }}>
              Pas encore de compte ?{' '}
              <button onClick={() => { setMode('register'); setStep(0); setError(''); }} className="font-semibold hover:underline" style={{ color: t.accent }}>
                Créer un compte
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: splashBg }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FoodlyLogo size={88} />
          </div>
          <h1 className="text-[44px] font-bold text-white tracking-[-1.5px] leading-none">foodly</h1>
          <p className="text-[10px] font-medium uppercase tracking-[2.5px] mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Delivery Platform</p>
        </div>

        <div className="shadow-sm p-8" style={{ backgroundColor: t.cardBg, borderRadius: '14px' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold" style={{ color: t.text1 }}>Inscription</h2>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-[5px] rounded-full transition-all ${
                  i <= step ? 'w-5' : 'w-[5px]'
                }`} style={{ backgroundColor: i <= step ? t.accent : t.text3 }} />
              ))}
            </div>
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm mb-4" style={{ color: t.text2 }}>Vous êtes...</p>
              <button
                onClick={nextStep}
                className="w-full p-4 rounded-[14px] text-left transition-colors"
                style={{ border: `2px solid ${t.accent}` }}
              >
                <span className="text-lg">🏪</span>
                <h3 className="font-semibold mt-1" style={{ color: t.text1 }}>Gestionnaire</h3>
                <p className="text-xs" style={{ color: t.text2 }}>Gérez votre commerce, vos livreurs et vos commandes</p>
              </button>
              <div className="w-full p-4 rounded-[14px] opacity-50 cursor-not-allowed" style={{ border: `1px solid ${t.border}` }}>
                <span className="text-lg">🚗</span>
                <h3 className="font-semibold mt-1" style={{ color: t.text1 }}>Livreur</h3>
                <p className="text-xs" style={{ color: t.text2 }}>Contactez votre gestionnaire pour obtenir vos identifiants</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-center mb-3" style={{ color: t.text2 }}>Étape 2/3 — Vos informations</p>
              <div className="rounded-[14px]" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Prénom</label>
                  <input placeholder="Votre prénom" value={regForm.firstName}
                    onChange={(e) => setRegForm({ ...regForm, firstName: e.target.value })}
                    className="w-full text-sm font-medium bg-transparent focus:outline-none mt-0.5" style={{ color: t.text1 }} />
                </div>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Nom</label>
                  <input placeholder="Votre nom" value={regForm.lastName}
                    onChange={(e) => setRegForm({ ...regForm, lastName: e.target.value })}
                    className="w-full text-sm font-medium bg-transparent focus:outline-none mt-0.5" style={{ color: t.text1 }} />
                </div>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Email</label>
                  <input type="email" placeholder="email@exemple.com" value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="w-full text-sm font-medium bg-transparent focus:outline-none mt-0.5" style={{ color: t.text1 }} />
                </div>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Nom d'utilisateur</label>
                  <input placeholder="Choisir un identifiant" value={regForm.username}
                    onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                    className="w-full text-sm font-medium bg-transparent focus:outline-none mt-0.5" style={{ color: t.text1 }} />
                </div>
                <div className="px-4 py-3">
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Mot de passe</label>
                  <input type="password" placeholder="6 caractères minimum" value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full text-sm font-medium bg-transparent focus:outline-none mt-0.5" style={{ color: t.text1 }} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-center mb-3" style={{ color: t.text2 }}>Étape 3/3 — Votre commerce</p>
              <div className="rounded-[14px]" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Nom du restaurant</label>
                  <input placeholder="Mon restaurant" value={regForm.businessName}
                    onChange={(e) => setRegForm({ ...regForm, businessName: e.target.value })}
                    className="w-full text-sm font-medium bg-transparent focus:outline-none mt-0.5" style={{ color: t.text1 }} />
                </div>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Adresse</label>
                  <input placeholder="123 rue de la Paix" value={regForm.businessAddress}
                    onChange={(e) => setRegForm({ ...regForm, businessAddress: e.target.value })}
                    className="w-full text-sm font-medium bg-transparent focus:outline-none mt-0.5" style={{ color: t.text1 }} />
                </div>
                <div className="px-4 py-3">
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Téléphone</label>
                  <input placeholder="01 23 45 67 89" value={regForm.businessPhone}
                    onChange={(e) => setRegForm({ ...regForm, businessPhone: e.target.value })}
                    className="w-full text-sm font-medium bg-transparent focus:outline-none mt-0.5" style={{ color: t.text1 }} />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm mt-3" style={{ color: colors.orange }}>{error}</p>}

          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button onClick={() => { setStep(step - 1); setError(''); }}
                className="flex-1 py-3 rounded-[14px] font-semibold text-sm"
                style={{ backgroundColor: t.bg, color: t.text1 }}>
                Retour
              </button>
            )}
            <button onClick={nextStep} disabled={loading}
              className="flex-1 py-3 rounded-[14px] font-semibold text-sm text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(160deg, #1C8275, #0D5650)', boxShadow: shadows.cta }}>
              {step === 2 ? (loading ? 'Création...' : 'Créer mon restaurant') : 'Continuer →'}
            </button>
          </div>

          <p className="text-center text-sm mt-6" style={{ color: t.text2 }}>
            Déjà un compte ?{' '}
            <button onClick={() => { setMode('login'); setError(''); }} className="font-semibold hover:underline" style={{ color: t.accent }}>
              Se connecter
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
