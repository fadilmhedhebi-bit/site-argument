import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../ThemeContext';

const KIND_LABEL = {
  driver: { singular: 'livreur', article: 'ce livreur', title: 'Nouveau livreur', created: 'Livreur créé !' },
  staff: { singular: 'équipier', article: 'cet équipier', title: 'Nouvel équipier', created: 'Équipier créé !' },
};
const KIND_PATH = { driver: 'drivers', staff: 'staff' };

function MemberCard({ member, kind, t, onToggle, onResetPassword, onDelete }) {
  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: t.cardBg, borderColor: t.border }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
          style={{ backgroundColor: t.accentBg, color: t.accent }}>
          {member.firstName[0]}{member.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold" style={{ color: t.text1 }}>{member.firstName} {member.lastName}</h4>
          <p className="text-xs font-mono truncate" style={{ color: t.text2 }}>{member.username}</p>
        </div>
      </div>
      {member.phone && <p className="text-sm mt-2" style={{ color: t.text2 }}>{member.phone}</p>}
      <p className="text-xs mt-1" style={{ color: t.text2 }}>
        Dernière connexion : {member.lastLogin ? new Date(member.lastLogin).toLocaleString('fr-FR') : 'Jamais'}
      </p>
      <div className="flex items-center justify-between mt-3">
        <span className="px-2 py-1 rounded-full text-xs"
          style={member.isActive
            ? { backgroundColor: t.greenBg, color: t.greenText }
            : { backgroundColor: t.orangeBg, color: t.orangeText }
          }>
          {member.isActive ? 'Actif' : 'Inactif'}
        </span>
        <div className="flex gap-2">
          <button onClick={() => onToggle(kind, member.id)} className="text-xs hover:underline" style={{ color: t.accent }}>
            {member.isActive ? 'Désactiver' : 'Activer'}
          </button>
          <button onClick={() => onResetPassword(kind, member.id)} className="text-xs" style={{ color: t.text2 }}>MDP</button>
          <button onClick={() => onDelete(kind, member.id)} className="text-xs" style={{ color: '#DC2626' }}>Suppr.</button>
        </div>
      </div>
    </div>
  );
}

export default function EquipeTab() {
  const [drivers, setDrivers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showCreate, setShowCreate] = useState(null); // null | 'driver' | 'staff'
  const [created, setCreated] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [copied, setCopied] = useState(false);
  const { user, updateUser, setToken } = useAuthStore();
  const { t } = useTheme();

  const loadDrivers = () => api.get('/auth/drivers').then(setDrivers).catch(console.error);
  const loadStaff = () => api.get('/auth/staff').then(setStaff).catch(console.error);
  useEffect(() => { loadDrivers(); loadStaff(); }, []);

  const toggleRole = async () => {
    const newRole = user.role === 'manager' ? 'manager_driver' : 'manager';
    try {
      const result = await api.patch('/auth/role', { role: newRole });
      if (result.token) setToken(result.token);
      updateUser({ role: newRole });
    } catch (err) { alert(err.message); }
  };

  const createMember = async () => {
    if (!form.firstName || !form.lastName) return alert('Prénom et nom requis');
    try {
      const result = await api.post(`/auth/create-${showCreate}`, form);
      setCreated(result);
      setForm({ firstName: '', lastName: '', phone: '' });
      showCreate === 'driver' ? loadDrivers() : loadStaff();
    } catch (err) { alert(err.message); }
  };

  const toggleMember = async (kind, id) => {
    try { await api.patch(`/auth/${KIND_PATH[kind]}/${id}/toggle`); kind === 'driver' ? loadDrivers() : loadStaff(); } catch (err) { alert(err.message); }
  };

  const resetPassword = async (kind, id) => {
    if (!confirm('Réinitialiser le mot de passe ?')) return;
    try {
      const result = await api.patch(`/auth/${KIND_PATH[kind]}/${id}/reset-password`);
      alert(`Nouveau mot de passe : ${result.password}`);
    } catch (err) { alert(err.message); }
  };

  const deleteMember = async (kind, id) => {
    if (!confirm(`Supprimer ${KIND_LABEL[kind].article} ? Cette action est définitive.`)) return;
    try {
      await api.delete(`/auth/${KIND_PATH[kind]}/${id}`);
      kind === 'driver' ? loadDrivers() : loadStaff();
    } catch (err) { alert(err.message); }
  };

  const openCreate = (kind) => { setShowCreate(kind); setCreated(null); };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border p-6" style={{ backgroundColor: t.cardBg, borderColor: t.border }}>
        <h3 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>Mon rôle</h3>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="px-3 py-1.5 rounded-full text-sm font-semibold"
            style={user?.role === 'manager_driver'
              ? { backgroundColor: t.accentBg, color: t.accent }
              : { backgroundColor: t.tabBg, color: t.text1 }
            }>
            {user?.role === 'manager_driver' ? 'Gestionnaire + Livreur' : 'Gestionnaire'}
          </span>
          <button onClick={toggleRole}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: t.tabBg, color: t.text1 }}>
            {user?.role === 'manager_driver' ? 'Quitter le rôle livreur' : 'Devenir aussi livreur'}
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: t.text2 }}>Le double rôle vous permet de livrer vous-même tout en gérant votre commerce.</p>
      </div>

      <div className="rounded-xl border p-6" style={{ backgroundColor: t.cardBg, borderColor: t.border }}>
        <h3 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>Mon commerce</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: t.text2 }}>Nom</p>
            <p className="font-semibold mt-0.5" style={{ color: t.text1 }}>{user?.businessName || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: t.text2 }}>Adresse</p>
            <p className="mt-0.5" style={{ color: t.text1 }}>{user?.businessAddress || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: t.text2 }}>ID Commerce</p>
            <p className="font-mono text-xs mt-0.5" style={{ color: t.text2 }}>{user?.businessId}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: t.border }}>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: t.text2 }}>Liens pour vos clients</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input readOnly value={`${window.location.origin}/client/${user?.businessId}`}
                className="flex-1 px-3 py-2 border rounded-lg text-xs font-mono"
                style={{ backgroundColor: t.tabBg, borderColor: t.border, color: t.text2 }} />
              <button onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/client/${user?.businessId}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-2 rounded-lg text-xs font-semibold min-w-[70px]"
                style={{ backgroundColor: copied ? t.greenText : t.accent, color: '#fff' }}>
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <p className="text-xs" style={{ color: t.text2 }}>Espace client avec compte, fidélité et commande</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Ma flotte ({drivers.length} livreur{drivers.length !== 1 ? 's' : ''})</h3>
          <button onClick={() => openCreate('driver')}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: t.accent, color: '#fff' }}>
            + Nouveau livreur
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map(d => (
            <MemberCard key={d.id} member={d} kind="driver" t={t} onToggle={toggleMember} onResetPassword={resetPassword} onDelete={deleteMember} />
          ))}
          {drivers.length === 0 && <p className="col-span-full text-center py-8" style={{ color: t.text2 }}>Aucun livreur dans votre flotte</p>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Mes équipiers ({staff.length})</h3>
            <p className="text-xs mt-1" style={{ color: t.text2 }}>Accès limité à la caisse, la prise de commande et les réservations.</p>
          </div>
          <button onClick={() => openCreate('staff')}
            className="px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
            style={{ backgroundColor: t.accent, color: '#fff' }}>
            + Nouvel équipier
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map(s => (
            <MemberCard key={s.id} member={s} kind="staff" t={t} onToggle={toggleMember} onResetPassword={resetPassword} onDelete={deleteMember} />
          ))}
          {staff.length === 0 && <p className="col-span-full text-center py-8" style={{ color: t.text2 }}>Aucun équipier pour le moment</p>}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowCreate(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>{KIND_LABEL[showCreate].title}</h2>
            {created ? (
              <div className="border rounded-lg p-4" style={{ backgroundColor: t.greenBg, borderColor: t.greenText }}>
                <h3 className="font-semibold mb-2" style={{ color: t.greenText }}>{KIND_LABEL[showCreate].created}</h3>
                <p className="text-sm mb-2" style={{ color: t.text1 }}>Communiquez ces identifiants :</p>
                <div className="rounded-lg p-3 font-mono text-sm space-y-1" style={{ backgroundColor: t.cardBg }}>
                  <p><span style={{ color: t.text2 }}>Utilisateur :</span> <strong style={{ color: t.text1 }}>{created.username}</strong></p>
                  <p><span style={{ color: t.text2 }}>Mot de passe :</span> <strong style={{ color: t.accent }}>{created.password}</strong></p>
                </div>
                <p className="text-xs mt-2" style={{ color: t.text2 }}>Ces identifiants ne seront plus affichés.</p>
                <button onClick={() => setShowCreate(null)} className="w-full mt-3 py-2 rounded-lg font-semibold text-sm"
                  style={{ backgroundColor: t.text1, color: t.cardBg }}>Fermer</button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input placeholder="Prénom *" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                      className="px-4 py-2.5 border rounded-lg focus:outline-none text-sm"
                      style={{ backgroundColor: t.cardBg, borderColor: t.border, color: t.text1 }} />
                    <input placeholder="Nom *" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                      className="px-4 py-2.5 border rounded-lg focus:outline-none text-sm"
                      style={{ backgroundColor: t.cardBg, borderColor: t.border, color: t.text1 }} />
                  </div>
                  <input placeholder="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none text-sm"
                    style={{ backgroundColor: t.cardBg, borderColor: t.border, color: t.text1 }} />
                </div>
                <p className="text-xs mt-2" style={{ color: t.text2 }}>Un nom d'utilisateur et mot de passe seront générés automatiquement.</p>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowCreate(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm"
                    style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
                  <button onClick={createMember} className="flex-1 py-2.5 rounded-lg font-semibold text-sm"
                    style={{ backgroundColor: t.greenText, color: '#fff' }}>Créer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
