import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

export default function ClientsTab() {
  const { t } = useTheme();
  const [customers, setCustomers] = useState([]);
  const [loyaltyConfig, setLoyaltyConfig] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [configForm, setConfigForm] = useState({ pointsPerEuro: 1, isActive: true, welcomePoints: 0 });
  const [showReward, setShowReward] = useState(null);
  const [rewardForm, setRewardForm] = useState({ name: '', description: '', pointsCost: '', type: 'discount_percentage', value: '' });
  const [showPoints, setShowPoints] = useState(null);
  const [pointsForm, setPointsForm] = useState({ adjustment: '', reason: '' });
  const [search, setSearch] = useState('');
  const [view, setView] = useState('clients');

  const load = () => {
    Promise.all([
      api.get('/customers/list'),
      api.get('/customers/loyalty/config'),
    ]).then(([c, l]) => {
      setCustomers(c);
      setLoyaltyConfig(l.config);
      setRewards(l.rewards);
      if (l.config) {
        setConfigForm({
          pointsPerEuro: l.config.points_per_euro,
          isActive: l.config.is_active,
          welcomePoints: l.config.welcome_points,
        });
      }
    }).catch(console.error);
  };

  useEffect(load, []);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.first_name?.toLowerCase().includes(s) || c.last_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
  });

  const saveLoyaltyConfig = async () => {
    try {
      const result = await api.put('/customers/loyalty/config', configForm);
      setLoyaltyConfig(result);
    } catch (err) { alert(err.message); }
  };

  const saveReward = async () => {
    try {
      if (showReward === 'new') {
        await api.post('/customers/loyalty/rewards', rewardForm);
      } else {
        await api.put(`/customers/loyalty/rewards/${showReward.id}`, rewardForm);
      }
      setShowReward(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const deleteReward = async (id) => {
    if (!confirm('Supprimer cette récompense ?')) return;
    try { await api.delete(`/customers/loyalty/rewards/${id}`); load(); } catch (err) { alert(err.message); }
  };

  const adjustPoints = async () => {
    if (!pointsForm.adjustment) return;
    try {
      await api.patch(`/customers/${showPoints.id}/points`, {
        adjustment: parseInt(pointsForm.adjustment),
        reason: pointsForm.reason,
      });
      setShowPoints(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const toggleCustomer = async (id) => {
    try { await api.patch(`/customers/${id}/toggle`); load(); } catch (err) { alert(err.message); }
  };

  const openNewReward = () => {
    setRewardForm({ name: '', description: '', pointsCost: '', type: 'discount_percentage', value: '' });
    setShowReward('new');
  };

  const openEditReward = (r) => {
    setRewardForm({ name: r.name, description: r.description || '', pointsCost: r.points_cost, type: r.type, value: r.value });
    setShowReward(r);
  };

  const typeLabels = {
    discount_percentage: '% de réduction',
    discount_fixed: '€ de réduction',
    free_product: 'Produit offert',
    free_delivery: 'Livraison gratuite',
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('clients')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={view === 'clients' ? { backgroundColor: t.accent, color: '#fff' } : { backgroundColor: t.tabBg, color: t.text2 }}>
          Clients
        </button>
        <button onClick={() => setView('fidelite')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={view === 'fidelite' ? { backgroundColor: t.accent, color: '#fff' } : { backgroundColor: t.tabBg, color: t.text2 }}>
          Fidélité
        </button>
      </div>

      {view === 'clients' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Clients ({customers.length})</h3>
            <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
              className="px-4 py-2 rounded-lg text-sm focus:outline-none min-w-[200px]"
              style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
          </div>

          <div className="space-y-2 sm:hidden">
            {filtered.map(c => (
              <div key={c.id} className={`rounded-xl p-4 ${!c.is_active ? 'opacity-50' : ''}`}
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold" style={{ color: t.text1 }}>{c.first_name} {c.last_name}</p>
                    <p className="text-xs" style={{ color: t.text2 }}>{c.email}</p>
                  </div>
                  <span className="font-mono font-bold" style={{ color: t.accent }}>{c.loyalty_points} pts</span>
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: t.text2 }}>
                  <span>{c.total_orders} commande(s) · {parseFloat(c.total_spent || 0).toFixed(2)} €</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowPoints(c); setPointsForm({ adjustment: '', reason: '' }); }}
                      style={{ color: t.accent }}>Points</button>
                    <button onClick={() => toggleCustomer(c.id)}
                      className={c.is_active ? 'text-stop' : 'text-go'}>{c.is_active ? 'Désactiver' : 'Activer'}</button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center py-8" style={{ color: t.text2 }}>Aucun client inscrit</p>}
          </div>

          <div className="hidden sm:block rounded-xl overflow-x-auto" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: t.tabBg }}>
                <tr>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: t.text2 }}>Client</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: t.text2 }}>Points</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: t.text2 }}>Commandes</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: t.text2 }}>Dépensé</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: t.text2 }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: t.border }}>
                {filtered.map(c => (
                  <tr key={c.id} className={!c.is_active ? 'opacity-50' : ''}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: t.text1 }}>{c.first_name} {c.last_name}</p>
                      <p className="text-xs" style={{ color: t.text2 }}>{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold" style={{ color: t.accent }}>{c.loyalty_points}</td>
                    <td className="px-4 py-3 text-center" style={{ color: t.text1 }}>{c.total_orders}</td>
                    <td className="px-4 py-3 text-center font-mono" style={{ color: t.text1 }}>{parseFloat(c.total_spent || 0).toFixed(2)} €</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => { setShowPoints(c); setPointsForm({ adjustment: '', reason: '' }); }}
                        className="text-xs hover:underline" style={{ color: t.accent }}>Points</button>
                      <button onClick={() => toggleCustomer(c.id)}
                        className={`text-xs hover:underline ${c.is_active ? 'text-stop' : 'text-go'}`}>
                        {c.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8" style={{ color: t.text2 }}>Aucun client inscrit</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'fidelite' && (
        <>
          <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
            <h3 className="text-sm font-heading mb-4" style={{ color: t.text1 }}>Configuration de la carte de fidélité</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm w-40" style={{ color: t.text2 }}>Programme actif</label>
                <button onClick={() => setConfigForm({ ...configForm, isActive: !configForm.isActive })}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={configForm.isActive ? { backgroundColor: t.greenBg, color: t.greenText } : { backgroundColor: t.tabBg, color: t.text2 }}>
                  {configForm.isActive ? 'Actif' : 'Inactif'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm w-40" style={{ color: t.text2 }}>Points par euro</label>
                <input type="number" value={configForm.pointsPerEuro} min="1"
                  onChange={e => setConfigForm({ ...configForm, pointsPerEuro: e.target.value })}
                  className="w-24 px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm w-40" style={{ color: t.text2 }}>Points de bienvenue</label>
                <input type="number" value={configForm.welcomePoints} min="0"
                  onChange={e => setConfigForm({ ...configForm, welcomePoints: e.target.value })}
                  className="w-24 px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
              </div>
              <button onClick={saveLoyaltyConfig} className="px-4 py-2 bg-go text-paper rounded-lg text-sm font-semibold">Enregistrer</button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Récompenses</h3>
              <button onClick={openNewReward} className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: t.accent, color: '#fff' }}>+ Récompense</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rewards.map(r => (
                <div key={r.id} className={`rounded-xl p-4 ${!r.is_active ? 'opacity-60' : ''}`}
                  style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm" style={{ color: t.text1 }}>{r.name}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: t.accent }}>{r.points_cost} pts</span>
                  </div>
                  {r.description && <p className="text-xs mb-2" style={{ color: t.text2 }}>{r.description}</p>}
                  <p className="text-xs" style={{ color: t.text2 }}>
                    {typeLabels[r.type]}
                    {r.type !== 'free_delivery' && r.type !== 'free_product' && ` · ${r.value}${r.type === 'discount_percentage' ? '%' : ' €'}`}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openEditReward(r)} className="text-xs hover:underline" style={{ color: t.accent }}>Modifier</button>
                    <button onClick={() => deleteReward(r.id)} className="text-xs text-stop hover:underline">Supprimer</button>
                  </div>
                </div>
              ))}
              {rewards.length === 0 && <p className="text-sm col-span-full text-center py-4" style={{ color: t.text2 }}>Aucune récompense configurée</p>}
            </div>
          </div>
        </>
      )}

      {showPoints && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPoints(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-2" style={{ color: t.text1 }}>Ajuster les points</h2>
            <p className="text-sm mb-4" style={{ color: t.text2 }}>{showPoints.first_name} {showPoints.last_name} — {showPoints.loyalty_points} pts actuels</p>
            <div className="space-y-3">
              <input type="number" placeholder="Points (+/-)" value={pointsForm.adjustment}
                onChange={e => setPointsForm({ ...pointsForm, adjustment: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
              <input placeholder="Raison (optionnel)" value={pointsForm.reason}
                onChange={e => setPointsForm({ ...pointsForm, reason: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPoints(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm"
                style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={adjustPoints} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Appliquer</button>
            </div>
          </div>
        </div>
      )}

      {showReward && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowReward(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>{showReward === 'new' ? 'Nouvelle récompense' : 'Modifier la récompense'}</h2>
            <div className="space-y-3">
              <input placeholder="Nom *" value={rewardForm.name}
                onChange={e => setRewardForm({ ...rewardForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
              <input placeholder="Description" value={rewardForm.description}
                onChange={e => setRewardForm({ ...rewardForm, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="number" placeholder="Coût en points *" value={rewardForm.pointsCost}
                  onChange={e => setRewardForm({ ...rewardForm, pointsCost: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
                <select value={rewardForm.type}
                  onChange={e => setRewardForm({ ...rewardForm, type: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }}>
                  <option value="discount_percentage">% de réduction</option>
                  <option value="discount_fixed">€ de réduction</option>
                  <option value="free_product">Produit offert</option>
                  <option value="free_delivery">Livraison gratuite</option>
                </select>
              </div>
              {rewardForm.type !== 'free_delivery' && rewardForm.type !== 'free_product' && (
                <input type="number" placeholder={rewardForm.type === 'discount_percentage' ? 'Valeur (%)' : 'Valeur (€)'}
                  value={rewardForm.value}
                  onChange={e => setRewardForm({ ...rewardForm, value: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: t.cardBg, color: t.text1 }} />
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowReward(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm"
                style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={saveReward} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
