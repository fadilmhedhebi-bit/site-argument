import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const TYPE_LABELS = { percentage: 'Pourcentage', fixed: 'Montant fixe', free_delivery: 'Livraison offerte' };

export default function Promos() {
  const [promos, setPromos] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'percentage', value: '', minOrderAmount: '', maxUses: '', expiresAt: '' });

  const load = () => api.get('/promos').then(setPromos).catch(console.error);
  useEffect(load, []);

  const create = async () => {
    if (!form.code || !form.type) return alert('Code et type requis');
    try {
      await api.post('/promos', form);
      setShowCreate(false);
      setForm({ code: '', type: 'percentage', value: '', minOrderAmount: '', maxUses: '', expiresAt: '' });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggle = async (id, isActive) => {
    await api.patch(`/promos/${id}`, { isActive: !isActive });
    load();
  };

  const remove = async (id) => {
    if (!confirm('Supprimer ce code promo ?')) return;
    await api.delete(`/promos/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-ink">Codes promo</h1>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90 transition-colors">
          + Nouveau code
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {promos.map((p) => (
          <div key={p.id} className={`bg-white rounded-xl border border-kraft p-5 ${!p.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-route text-lg">{p.code}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${p.is_active ? 'bg-go/20 text-go' : 'bg-ink/20 text-ink/60'}`}>
                {p.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <p className="text-sm text-ink/70">
              {p.type === 'percentage' && `${p.value}% de réduction`}
              {p.type === 'fixed' && `${parseFloat(p.value).toFixed(2)} € de réduction`}
              {p.type === 'free_delivery' && 'Livraison offerte'}
            </p>
            <div className="text-xs text-ink/50 mt-2 space-y-0.5">
              {parseFloat(p.min_order_amount) > 0 && <p>Min. {parseFloat(p.min_order_amount).toFixed(2)} €</p>}
              {p.max_uses && <p>Utilisations: {p.current_uses}/{p.max_uses}</p>}
              {p.expires_at && <p>Expire: {new Date(p.expires_at).toLocaleDateString('fr-FR')}</p>}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => toggle(p.id, p.is_active)}
                className="px-3 py-1.5 bg-kraft text-ink rounded text-xs font-semibold">
                {p.is_active ? 'Désactiver' : 'Activer'}
              </button>
              <button onClick={() => remove(p.id)}
                className="px-3 py-1.5 bg-stop/20 text-stop rounded text-xs font-semibold">Supprimer</button>
            </div>
          </div>
        ))}
        {promos.length === 0 && <p className="col-span-full text-center py-8 text-ink/40">Aucun code promo</p>}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-4">Nouveau code promo</h2>
            <div className="space-y-3">
              <input placeholder="CODE (ex: PROMO10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm font-mono" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {form.type !== 'free_delivery' && (
                <input placeholder={form.type === 'percentage' ? 'Valeur (%)' : 'Montant (€)'} type="number" step="0.01" value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              )}
              <input placeholder="Commande minimum (€)" type="number" step="0.01" value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input placeholder="Nombre max d'utilisations" type="number" value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <div>
                <label className="text-xs text-ink/50">Date d'expiration</label>
                <input type="datetime-local" value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
              <button onClick={create} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
