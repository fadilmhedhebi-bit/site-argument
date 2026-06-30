import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

const UNITS = ['unité', 'kg', 'g', 'L', 'cL', 'pièce', 'boîte', 'sachet', 'bouteille'];

export default function IngredientsTab() {
  const [ingredients, setIngredients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(null);
  const [showMovement, setShowMovement] = useState(null);
  const [movementForm, setMovementForm] = useState({ adjustment: '', type: 'in', note: '' });
  const [form, setForm] = useState({ name: '', unit: 'unité', quantity: '', alertThreshold: '5', costPerUnit: '', supplier: '' });

  const load = () => {
    Promise.all([
      api.get('/ingredients'),
      api.get('/ingredients/alerts'),
    ]).then(([i, a]) => { setIngredients(i); setAlerts(a); }).catch(console.error);
  };

  useEffect(load, []);

  const filtered = ingredients.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  const save = async () => {
    try {
      const body = {
        name: form.name, unit: form.unit,
        quantity: parseFloat(form.quantity) || 0,
        alertThreshold: parseFloat(form.alertThreshold) || 5,
        costPerUnit: parseFloat(form.costPerUnit) || 0,
        supplier: form.supplier,
      };
      if (showForm === 'new') await api.post('/ingredients', body);
      else await api.put(`/ingredients/${showForm.id}`, body);
      setShowForm(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const adjust = async () => {
    if (!movementForm.adjustment) return;
    const adj = movementForm.type === 'out' || movementForm.type === 'waste'
      ? -Math.abs(parseFloat(movementForm.adjustment))
      : Math.abs(parseFloat(movementForm.adjustment));
    try {
      await api.patch(`/ingredients/${showMovement.id}/stock`, {
        adjustment: adj, type: movementForm.type, note: movementForm.note,
      });
      setShowMovement(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const deleteIngredient = async (id) => {
    if (!confirm('Supprimer cet ingrédient ?')) return;
    try { await api.delete(`/ingredients/${id}`); load(); } catch (err) { alert(err.message); }
  };

  const openNew = () => {
    setForm({ name: '', unit: 'unité', quantity: '', alertThreshold: '5', costPerUnit: '', supplier: '' });
    setShowForm('new');
  };

  const openEdit = (i) => {
    setForm({
      name: i.name, unit: i.unit, quantity: i.quantity,
      alertThreshold: i.alert_threshold, costPerUnit: i.cost_per_unit || '', supplier: i.supplier || '',
    });
    setShowForm(i);
  };

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="bg-stop/10 border border-stop/30 rounded-xl p-4">
          <h3 className="text-sm font-heading text-stop mb-2">Alertes stock ingrédients</h3>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a.id} className="bg-white px-3 py-1 rounded-full text-xs text-stop border border-stop/20">
                {a.name} : {parseFloat(a.quantity).toFixed(1)} {a.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-heading text-ink">Matières premières</h3>
        <button onClick={openNew} className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90">+ Ingrédient</button>
      </div>

      <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2 border border-kraft rounded-lg bg-paper text-sm focus:outline-none focus:border-route mb-4" />

      <div className="space-y-2 sm:hidden">
        {filtered.map(i => (
          <div key={i.id} className={`bg-white rounded-xl border border-kraft p-4 ${parseFloat(i.quantity) <= parseFloat(i.alert_threshold) ? 'border-stop/30 bg-stop/5' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-ink">{i.name}</p>
                {i.supplier && <p className="text-xs text-ink/40">{i.supplier}</p>}
              </div>
              {i.cost_per_unit > 0 && <span className="text-xs text-ink/40">{parseFloat(i.cost_per_unit).toFixed(2)} €/{i.unit}</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className={`font-mono text-lg ${parseFloat(i.quantity) <= parseFloat(i.alert_threshold) ? 'text-stop font-bold' : 'text-ink'}`}>
                {parseFloat(i.quantity).toFixed(1)} {i.unit}
              </span>
              <div className="flex gap-2">
                <button onClick={() => { setShowMovement(i); setMovementForm({ adjustment: '', type: 'in', note: '' }); }}
                  className="text-sm text-go py-1 px-2">Mouvement</button>
                <button onClick={() => openEdit(i)} className="text-sm text-route py-1 px-2">Modifier</button>
                <button onClick={() => deleteIngredient(i.id)} className="text-sm text-stop py-1 px-2">Suppr.</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-ink/30">Aucun ingrédient</p>}
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-kraft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-kraft/30">
            <tr>
              <th className="text-left px-4 py-3 text-ink/60 font-semibold">Ingrédient</th>
              <th className="text-center px-4 py-3 text-ink/60 font-semibold">Stock</th>
              <th className="text-center px-4 py-3 text-ink/60 font-semibold">Coût unitaire</th>
              <th className="text-center px-4 py-3 text-ink/60 font-semibold">Fournisseur</th>
              <th className="text-right px-4 py-3 text-ink/60 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kraft/30">
            {filtered.map(i => (
              <tr key={i.id} className={parseFloat(i.quantity) <= parseFloat(i.alert_threshold) ? 'bg-stop/5' : ''}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{i.name}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-mono ${parseFloat(i.quantity) <= parseFloat(i.alert_threshold) ? 'text-stop font-bold' : 'text-ink'}`}>
                    {parseFloat(i.quantity).toFixed(1)} {i.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-mono text-ink/60">
                  {i.cost_per_unit > 0 ? `${parseFloat(i.cost_per_unit).toFixed(2)} €` : '—'}
                </td>
                <td className="px-4 py-3 text-center text-ink/50">{i.supplier || '—'}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => { setShowMovement(i); setMovementForm({ adjustment: '', type: 'in', note: '' }); }}
                    className="text-xs text-go hover:underline">Mouvement</button>
                  <button onClick={() => openEdit(i)} className="text-xs text-route hover:underline">Modifier</button>
                  <button onClick={() => deleteIngredient(i.id)} className="text-xs text-stop hover:underline">Supprimer</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ink/30">Aucun ingrédient</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(null)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-4">{showForm === 'new' ? 'Nouvel ingrédient' : 'Modifier l\'ingrédient'}</h2>
            <div className="space-y-3">
              <input placeholder="Nom *" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" placeholder="Quantité initiale" value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="number" placeholder="Seuil d'alerte" value={form.alertThreshold}
                  onChange={e => setForm({ ...form, alertThreshold: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <input type="number" step="0.01" placeholder="Coût unitaire (€)" value={form.costPerUnit}
                  onChange={e => setForm({ ...form, costPerUnit: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              </div>
              <input placeholder="Fournisseur" value={form.supplier}
                onChange={e => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(null)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
              <button onClick={save} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showMovement && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowMovement(null)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-2">Mouvement de stock</h2>
            <p className="text-sm text-ink/50 mb-4">{showMovement.name} — {parseFloat(showMovement.quantity).toFixed(1)} {showMovement.unit}</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                {[
                  { v: 'in', l: 'Entrée', c: 'bg-go/20 text-go' },
                  { v: 'out', l: 'Sortie', c: 'bg-route/20 text-route' },
                  { v: 'waste', l: 'Perte', c: 'bg-stop/20 text-stop' },
                ].map(t => (
                  <button key={t.v} onClick={() => setMovementForm({ ...movementForm, type: t.v })}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${movementForm.type === t.v ? t.c : 'bg-kraft/50 text-ink'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <input type="number" step="0.1" placeholder={`Quantité (${showMovement.unit})`} value={movementForm.adjustment}
                onChange={e => setMovementForm({ ...movementForm, adjustment: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input placeholder="Note (optionnel)" value={movementForm.note}
                onChange={e => setMovementForm({ ...movementForm, note: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMovement(null)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
              <button onClick={adjust} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
