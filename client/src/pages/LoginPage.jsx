import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuthStore();

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({
    firstName: '', lastName: '', email: '', username: '', password: '',
    businessName: '', businessAddress: '', businessPhone: '',
  });

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

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-heading text-route">TSE</h1>
          <p className="text-ink/60 mt-1">Tournée Snack Express</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-kraft p-8">
          {mode === 'login' ? (
            <>
              <h2 className="text-xl font-heading text-ink mb-6">Connexion</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="text" placeholder="Nom d'utilisateur" value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm"
                />
                <input
                  type="password" placeholder="Mot de passe" value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm"
                />
                {error && <p className="text-stop text-sm">{error}</p>}
                <button
                  type="submit" disabled={loading}
                  className="w-full py-3 bg-route text-paper rounded-lg font-semibold hover:bg-route/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
              <p className="text-center text-sm text-ink/50 mt-6">
                Pas encore de compte ?{' '}
                <button onClick={() => { setMode('register'); setStep(0); setError(''); }} className="text-route font-semibold hover:underline">
                  Créer un compte
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-heading text-ink">Inscription</h2>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`w-8 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-route' : 'bg-kraft'}`} />
                  ))}
                </div>
              </div>

              {step === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-ink/60 mb-4">Vous êtes...</p>
                  <button
                    onClick={nextStep}
                    className="w-full p-4 border-2 border-route rounded-xl text-left hover:bg-route/5 transition-colors"
                  >
                    <span className="text-lg">🏪</span>
                    <h3 className="font-semibold text-ink mt-1">Gestionnaire</h3>
                    <p className="text-xs text-ink/50">Gérez votre commerce, vos livreurs et vos commandes</p>
                  </button>
                  <div className="w-full p-4 border border-kraft rounded-xl opacity-50 cursor-not-allowed">
                    <span className="text-lg">🚗</span>
                    <h3 className="font-semibold text-ink mt-1">Livreur</h3>
                    <p className="text-xs text-ink/50">Contactez votre gestionnaire pour obtenir vos identifiants</p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-ink/60 mb-2">Vos informations</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Prénom *" value={regForm.firstName}
                      onChange={(e) => setRegForm({ ...regForm, firstName: e.target.value })}
                      className="px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                    <input placeholder="Nom *" value={regForm.lastName}
                      onChange={(e) => setRegForm({ ...regForm, lastName: e.target.value })}
                      className="px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                  </div>
                  <input placeholder="Email" type="email" value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                  <input placeholder="Nom d'utilisateur *" value={regForm.username}
                    onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                    className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                  <input placeholder="Mot de passe *" type="password" value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-ink/60 mb-2">Votre commerce</p>
                  <input placeholder="Nom du commerce *" value={regForm.businessName}
                    onChange={(e) => setRegForm({ ...regForm, businessName: e.target.value })}
                    className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                  <input placeholder="Adresse" value={regForm.businessAddress}
                    onChange={(e) => setRegForm({ ...regForm, businessAddress: e.target.value })}
                    className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                  <input placeholder="Téléphone" value={regForm.businessPhone}
                    onChange={(e) => setRegForm({ ...regForm, businessPhone: e.target.value })}
                    className="w-full px-4 py-3 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                </div>
              )}

              {error && <p className="text-stop text-sm mt-3">{error}</p>}

              <div className="flex gap-3 mt-6">
                {step > 0 && (
                  <button onClick={() => { setStep(step - 1); setError(''); }}
                    className="flex-1 py-3 bg-kraft text-ink rounded-lg font-semibold text-sm hover:bg-kraft/80">
                    Retour
                  </button>
                )}
                <button onClick={nextStep} disabled={loading}
                  className="flex-1 py-3 bg-route text-paper rounded-lg font-semibold text-sm hover:bg-route/90 disabled:opacity-50">
                  {step === 2 ? (loading ? 'Création...' : 'Créer mon compte') : 'Suivant'}
                </button>
              </div>

              <p className="text-center text-sm text-ink/50 mt-6">
                Déjà un compte ?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} className="text-route font-semibold hover:underline">
                  Se connecter
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
