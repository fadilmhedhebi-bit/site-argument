import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const steps = ['Commerce', 'Identité', 'Compte'];

export default function Register() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: '', businessAddress: '', businessPhone: '',
    firstName: '', lastName: '', email: '', phone: '',
    username: '', password: '', confirmPassword: '',
  });
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const next = () => {
    if (step === 0 && !form.businessName) return setError('Nom du commerce requis');
    if (step === 1 && (!form.firstName || !form.lastName)) return setError('Prénom et nom requis');
    setError('');
    setStep(step + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return setError('Les mots de passe ne correspondent pas');
    if (form.password.length < 6) return setError('Mot de passe trop court (6 caractères min)');
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl text-route mb-2">TSE</h1>
          <p className="text-ink/60">Créer votre espace</p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                i <= step ? 'bg-route text-paper' : 'bg-kraft text-ink/40'
              }`}>{i + 1}</div>
              <span className={`text-xs ${i <= step ? 'text-ink' : 'text-ink/40'}`}>{s}</span>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-route' : 'bg-kraft'}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 border border-kraft">
          {error && (
            <div className="bg-stop/10 border border-stop text-stop rounded-lg p-3 mb-4 text-sm">{error}</div>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg text-ink mb-2">Votre commerce</h2>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Nom du commerce *</label>
                <input type="text" value={form.businessName} onChange={update('businessName')}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Adresse</label>
                <input type="text" value={form.businessAddress} onChange={update('businessAddress')}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Téléphone</label>
                <input type="tel" value={form.businessPhone} onChange={update('businessPhone')}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" />
              </div>
              <button type="button" onClick={next}
                className="w-full py-3 bg-route text-paper font-semibold rounded-lg hover:bg-route/90 transition-colors">
                Suivant
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg text-ink mb-2">Vos informations</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink/70 mb-1">Prénom *</label>
                  <input type="text" value={form.firstName} onChange={update('firstName')}
                    className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink/70 mb-1">Nom *</label>
                  <input type="text" value={form.lastName} onChange={update('lastName')}
                    className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Email</label>
                <input type="email" value={form.email} onChange={update('email')}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Téléphone</label>
                <input type="tel" value={form.phone} onChange={update('phone')}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(0)}
                  className="flex-1 py-3 bg-kraft text-ink font-semibold rounded-lg hover:bg-kraft/80 transition-colors">Retour</button>
                <button type="button" onClick={next}
                  className="flex-1 py-3 bg-route text-paper font-semibold rounded-lg hover:bg-route/90 transition-colors">Suivant</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg text-ink mb-2">Identifiants de connexion</h2>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Nom d'utilisateur *</label>
                <input type="text" value={form.username} onChange={update('username')}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Mot de passe *</label>
                <input type="password" value={form.password} onChange={update('password')}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Confirmer le mot de passe *</label>
                <input type="password" value={form.confirmPassword} onChange={update('confirmPassword')}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route" required />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-kraft text-ink font-semibold rounded-lg hover:bg-kraft/80 transition-colors">Retour</button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-3 bg-go text-paper font-semibold rounded-lg hover:bg-go/90 transition-colors disabled:opacity-50">
                  {loading ? 'Création...' : 'Créer mon compte'}
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-ink/50 mt-4">
            Déjà inscrit ? <Link to="/login" className="text-route hover:underline">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
