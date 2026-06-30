import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';

export default function EquipeTab() {
  const [drivers, setDrivers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const { user, updateUser, setToken } = useAuthStore();

  const load = () => api.get('/auth/drivers').then(setDrivers).catch(console.error);
  useEffect(load, []);

  const toggleRole = async () => {
    const newRole = user.role === 'manager' ? 'manager_driver' : 'manager';
    try {
      const result = await api.patch('/auth/role', { role: newRole });
      if (result.token) setToken(result.token);
      updateUser({ role: newRole });
    } catch (err) { alert(err.message); }
  };

  const createDriver = async () => {
    if (!form.firstName || !form.lastName) return alert('Prénom et nom requis');
    try {
      const result = await api.post('/auth/create-driver', form);
      setCreated(result);
      setForm({ firstName: '', lastName: '', phone: '' });
      load();
    } catch (err) { alert(err.message); }
  };

  const toggleDriver = async (id) => {
    try { await api.patch(`/auth/drivers/${id}/toggle`); load(); } catch (err) { alert(err.message); }
  };

  const resetPassword = async (id) => {
    if (!confirm('Réinitialiser le mot de passe ?')) return;
    try {
      const result = await api.patch(`/auth/drivers/${id}/reset-password`);
      alert(`Nouveau mot de passe : ${result.password}`);
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-kraft p-6">
        <h3 className="text-lg font-heading text-ink mb-4">Mon rôle</h3>
        <div className="flex items-center gap-4 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
            user?.role === 'manager_driver' ? 'bg-route/20 text-route' : 'bg-kraft text-ink'
          }`}>
            {user?.role === 'manager_driver' ? 'Gestionnaire + Livreur' : 'Gestionnaire'}
          </span>
          <button onClick={toggleRole}
            className="px-4 py-2 bg-kraft text-ink rounded-lg text-sm font-semibold hover:bg-kraft/80 transition-colors">
            {user?.role === 'manager_driver' ? 'Quitter le rôle livreur' : 'Devenir aussi livreur'}
          </button>
        </div>
        <p className="text-xs text-ink/40 mt-3">Le double rôle vous permet de livrer vous-même tout en gérant votre commerce.</p>
      </div>

      <div className="bg-white rounded-xl border border-kraft p-6">
        <h3 className="text-lg font-heading text-ink mb-4">Mon commerce</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-ink/40 text-xs uppercase tracking-wide">Nom</p>
            <p className="font-semibold text-ink mt-0.5">{user?.businessName || '—'}</p>
          </div>
          <div>
            <p className="text-ink/40 text-xs uppercase tracking-wide">Adresse</p>
            <p className="text-ink mt-0.5">{user?.businessAddress || '—'}</p>
          </div>
          <div>
            <p className="text-ink/40 text-xs uppercase tracking-wide">ID Commerce</p>
            <p className="font-mono text-xs text-ink/50 mt-0.5">{user?.businessId}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-kraft">
          <p className="text-ink/40 text-xs uppercase tracking-wide mb-2">Liens pour vos clients</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input readOnly value={`${window.location.origin}/client/${user?.businessId}`}
                className="flex-1 px-3 py-2 border border-kraft rounded-lg bg-kraft/20 text-xs font-mono text-ink/60" />
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/client/${user?.businessId}`); }}
                className="px-3 py-2 bg-route text-paper rounded-lg text-xs font-semibold">Copier</button>
            </div>
            <p className="text-xs text-ink/40">Espace client avec compte, fidélité et commande</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading text-ink">Ma flotte ({drivers.length} livreur{drivers.length !== 1 ? 's' : ''})</h3>
          <button onClick={() => { setShowCreate(true); setCreated(null); }}
            className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90">
            + Nouveau livreur
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-kraft p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-route/20 flex items-center justify-center text-route font-bold">
                  {d.firstName[0]}{d.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-ink">{d.firstName} {d.lastName}</h4>
                  <p className="text-xs text-ink/50 font-mono truncate">{d.username}</p>
                </div>
              </div>
              {d.phone && <p className="text-sm text-ink/60 mt-2">{d.phone}</p>}
              <p className="text-xs text-ink/40 mt-1">
                Dernière connexion : {d.lastLogin ? new Date(d.lastLogin).toLocaleString('fr-FR') : 'Jamais'}
              </p>
              <div className="flex items-center justify-between mt-3">
                <span className={`px-2 py-1 rounded-full text-xs ${d.isActive ? 'bg-go/20 text-go' : 'bg-stop/20 text-stop'}`}>
                  {d.isActive ? 'Actif' : 'Inactif'}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => toggleDriver(d.id)} className="text-xs text-route hover:underline">
                    {d.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => resetPassword(d.id)} className="text-xs text-ink/40 hover:text-ink">MDP</button>
                </div>
              </div>
            </div>
          ))}
          {drivers.length === 0 && <p className="col-span-full text-center py-8 text-ink/40">Aucun livreur dans votre flotte</p>}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-4">Nouveau livreur</h2>
            {created ? (
              <div className="bg-go/10 border border-go rounded-lg p-4">
                <h3 className="font-semibold text-go mb-2">Livreur créé !</h3>
                <p className="text-sm mb-2">Communiquez ces identifiants au livreur :</p>
                <div className="bg-white rounded-lg p-3 font-mono text-sm space-y-1">
                  <p><span className="text-ink/50">Utilisateur :</span> <strong>{created.username}</strong></p>
                  <p><span className="text-ink/50">Mot de passe :</span> <strong className="text-route">{created.password}</strong></p>
                </div>
                <p className="text-xs text-ink/50 mt-2">Ces identifiants ne seront plus affichés.</p>
                <button onClick={() => setShowCreate(false)} className="w-full mt-3 py-2 bg-ink text-paper rounded-lg font-semibold text-sm">Fermer</button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input placeholder="Prénom *" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                      className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                    <input placeholder="Nom *" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                      className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                  </div>
                  <input placeholder="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                </div>
                <p className="text-xs text-ink/50 mt-2">Un nom d'utilisateur et mot de passe seront générés automatiquement.</p>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
                  <button onClick={createDriver} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Créer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
