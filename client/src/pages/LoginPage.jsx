import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import RestoLabLogo from '../components/RestoLabLogo';
import { useTheme } from '../ThemeContext';
import { colors, shadows } from '../theme';
import { api, setApiToken } from '../utils/api';
import { PLAN_INFO } from '../planConfig';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const setState = useAuthStore.setState;
  const { t, isDark } = useTheme();

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({
    firstName: '', lastName: '', email: '', username: '', password: '',
    businessName: '', businessAddress: '', businessPhone: '', plan: 'standard',
  });

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [registrationDone, setRegistrationDone] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  const splashBg = isDark
    ? `linear-gradient(160deg, ${colors.oliveDark}, ${colors.darkBg})`
    : 'linear-gradient(160deg, #5C6B3C, #3A4427)';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginForm.username, loginForm.password);
      navigate('/');
    } catch (err) {
      if (err.message.includes('vérifier votre adresse email')) {
        setVerificationEmail(loginForm.username);
        setMode('verify-notice');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await api.post('/auth/register', regForm);
      if (result.token && result.user) {
        setApiToken(result.token);
        setState({ token: result.token, user: result.user });
        navigate('/');
      } else {
        setRegistrationDone(true);
        setMode('verify-notice');
        setVerificationEmail(regForm.email);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setForgotMsg('');
    setLoading(true);
    try {
      const result = await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMsg(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendMsg('');
    try {
      const result = await api.post('/auth/resend-verification', { email: verificationEmail });
      setResendMsg(result.message);
    } catch (err) {
      setResendMsg(err.message);
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
      if (!regForm.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) {
        return setError('Un email valide est requis pour la vérification');
      }
      if (regForm.password.length < 6) return setError('Mot de passe : 6 caractères minimum');
      setStep(2);
    } else if (step === 2) {
      if (!regForm.businessName) return setError('Le nom du commerce est requis');
      setStep(3);
    } else if (step === 3) {
      handleRegister();
    }
  };

  if (mode === 'forgot') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: splashBg }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4"><RestoLabLogo size={88} /></div>
            <h1 className="text-[44px] font-bold text-white tracking-[-1.5px] leading-none">RestoLab</h1>
          </div>

          <div className="shadow-sm p-8" style={{ backgroundColor: t.cardBg, borderRadius: '14px' }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: t.text1 }}>Mot de passe oublié</h2>
            <p className="text-sm mb-6" style={{ color: t.text2 }}>Entrez votre email pour recevoir un lien de réinitialisation.</p>

            {forgotMsg ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: t.greenBg, color: t.greenText }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-sm mb-4" style={{ color: t.text1 }}>{forgotMsg}</p>
                <button onClick={() => { setMode('login'); setForgotMsg(''); setForgotEmail(''); }}
                  className="text-sm font-semibold hover:underline" style={{ color: t.accent }}>
                  Retour à la connexion
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input
                  type="email" placeholder="Votre adresse email"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-[14px] focus:outline-none text-sm"
                  style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 }}
                />
                {error && <p className="text-sm" style={{ color: colors.orange }}>{error}</p>}
                <button type="submit" disabled={loading || !forgotEmail}
                  className="w-full py-4 rounded-[14px] font-semibold text-[15px] transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(160deg, #5C6B3C, #3A4427)', color: 'white', boxShadow: shadows.cta }}>
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </form>
            )}

            <p className="text-center text-sm mt-6" style={{ color: t.text2 }}>
              <button onClick={() => { setMode('login'); setError(''); setForgotMsg(''); }}
                className="font-semibold hover:underline" style={{ color: t.accent }}>
                Retour à la connexion
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'verify-notice') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: splashBg }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4"><RestoLabLogo size={88} /></div>
            <h1 className="text-[44px] font-bold text-white tracking-[-1.5px] leading-none">RestoLab</h1>
          </div>

          <div className="shadow-sm p-8 text-center" style={{ backgroundColor: t.cardBg, borderRadius: '14px' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-4" style={{ backgroundColor: t.accentBg, color: t.accent }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: t.text1 }}>Vérifiez votre email</h2>
            <p className="text-sm mb-4" style={{ color: t.text2 }}>
              {registrationDone
                ? 'Un email de confirmation a été envoyé. Cliquez sur le lien dans l\'email pour activer votre compte.'
                : 'Votre email n\'est pas encore vérifié. Vérifiez votre boîte de réception.'}
            </p>

            <button onClick={handleResendVerification}
              className="text-sm font-semibold hover:underline" style={{ color: t.accent }}>
              Renvoyer l'email de vérification
            </button>
            {resendMsg && <p className="text-xs mt-2" style={{ color: t.greenText }}>{resendMsg}</p>}

            <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
              <button onClick={() => { setMode('login'); setError(''); setRegistrationDone(false); setResendMsg(''); }}
                className="text-sm font-semibold hover:underline" style={{ color: t.accent }}>
                Retour à la connexion
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: splashBg }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <RestoLabLogo size={88} />
            </div>
            <h1 className="text-[44px] font-bold text-white tracking-[-1.5px] leading-none">RestoLab</h1>
            <p className="text-white/55 mt-2 text-sm leading-relaxed">Le CRM à votre échelle</p>
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
              <div className="text-right">
                <button type="button" onClick={() => { setMode('forgot'); setError(''); }}
                  className="text-xs hover:underline" style={{ color: t.accent }}>
                  Mot de passe oublié ?
                </button>
              </div>
              {error && <p className="text-sm" style={{ color: colors.orange }}>{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full py-4 rounded-[14px] font-semibold text-[15px] transition-colors disabled:opacity-50"
                style={{ background: 'linear-gradient(160deg, #5C6B3C, #3A4427)', color: 'white', boxShadow: shadows.cta }}
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
            <RestoLabLogo size={88} />
          </div>
          <h1 className="text-[44px] font-bold text-white tracking-[-1.5px] leading-none">RestoLab</h1>
          <p className="text-[10px] font-medium uppercase tracking-[2.5px] mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Le CRM à votre échelle</p>
        </div>

        <div className="shadow-sm p-8" style={{ backgroundColor: t.cardBg, borderRadius: '14px' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold" style={{ color: t.text1 }}>Inscription</h2>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
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
                <h3 className="font-semibold" style={{ color: t.text1 }}>Gestionnaire</h3>
                <p className="text-xs" style={{ color: t.text2 }}>Gérez votre commerce, vos livreurs et vos commandes</p>
              </button>
              <div className="w-full p-4 rounded-[14px] opacity-50 cursor-not-allowed" style={{ border: `1px solid ${t.border}` }}>
                <h3 className="font-semibold" style={{ color: t.text1 }}>Livreur</h3>
                <p className="text-xs" style={{ color: t.text2 }}>Contactez votre gestionnaire pour obtenir vos identifiants</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-center mb-3" style={{ color: t.text2 }}>Étape 2/4 — Vos informations</p>
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
                  <label className="text-[9px] uppercase tracking-wide" style={{ color: t.text3 }}>Email *</label>
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
              <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-center mb-3" style={{ color: t.text2 }}>Étape 3/4 — Votre commerce</p>
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

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-center mb-3" style={{ color: t.text2 }}>Étape 4/4 — Choisissez votre forfait</p>
              <div className="space-y-2">
                {PLAN_INFO.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setRegForm({ ...regForm, plan: p.id })}
                    className="w-full p-4 rounded-[14px] text-left transition-colors"
                    style={{ border: `2px solid ${regForm.plan === p.id ? t.accent : t.border}` }}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold" style={{ color: t.text1 }}>{p.label}</h3>
                      <span className="text-[10px] font-semibold uppercase" style={{ color: t.accent }}>{p.tagline}</span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {p.features.map((f) => (
                        <li key={f} className="text-xs" style={{ color: t.text2 }}>• {f}</li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
              <p className="text-xs text-center pt-1" style={{ color: t.text2 }}>
                Essai gratuit de 30 jours. Les tarifs vous seront communiqués avant tout paiement.
              </p>
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
              style={{ background: 'linear-gradient(160deg, #5C6B3C, #3A4427)', boxShadow: shadows.cta }}>
              {step === 3 ? (loading ? 'Création...' : 'Créer mon restaurant') : 'Continuer →'}
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
