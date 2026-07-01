import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

const UNITS = ['unité', 'kg', 'g', 'L', 'cL', 'pièce', 'boîte', 'sachet', 'bouteille'];

export default function IngredientsTab() {
  const { t } = useTheme();
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

  const movementTypes = [
    { v: 'in', l: 'Entrée', activeBg: t.greenBg, activeColor: t.greenText },
    { v: 'out', l: 'Sortie', activeBg: t.accentBg, activeColor: t.accent },
    { v: 'waste', l: 'Perte', activeBg: t.orangeBg, activeColor: t.orangeText },
  ];

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: t.orangeBg, border: `1px solid ${t.orangeText}33` }}>
          <h3 className="text-sm font-heading mb-2" style={{ color: t.orangeText }}>Alertes stock ingrédients</h3>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a.id} className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: t.cardBg, color: t.orangeText, border: `1px solid ${t.orangeText}33` }}>
                {a.name} : {parseFloat(a.quantity).toFixed(1)} {a.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Matières premières</h3>
        <button onClick={openNew} className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90" style={{ backgroundColor: t.accent, color: '#fff' }}>+ Ingrédient</button>
      </div>

      <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2 rounded-lg text-sm focus:outline-none mb-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />

      <div className="space-y-2 sm:hidden">
        {filtered.map(i => {
          const isLow = parseFloat(i.quantity) <= parseFloat(i.alert_threshold);
          return (
            <div key={i.id} className="rounded-xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${isLow ? t.orangeText + '4D' : t.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold" style={{ color: t.text1 }}>{i.name}</p>
                  {i.supplier && <p className="text-xs" style={{ color: t.text2 }}>{i.supplier}</p>}
                </div>
                {i.cost_per_unit > 0 && <span className="text-xs" style={{ color: t.text2 }}>{parseFloat(i.cost_per_unit).toFixed(2)} €/{i.unit}</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className={`font-mono text-lg ${isLow ? 'font-bold' : ''}`} style={{ color: isLow ? t.orangeText : t.text1 }}>
                  {parseFloat(i.quantity).toFixed(1)} {i.unit}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => { setShowMovement(i); setMovementForm({ adjustment: '', type: 'in', note: '' }); }}
                    className="text-sm py-1 px-2" style={{ color: t.greenText }}>Mouvement</button>
                  <button onClick={() => openEdit(i)} className="text-sm py-1 px-2" style={{ color: t.accent }}>Modifier</button>
                  <button onClick={() => deleteIngredient(i.id)} className="text-sm py-1 px-2" style={{ color: t.orangeText }}>Suppr.</button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center py-8" style={{ color: t.text2 }}>Aucun ingrédient</p>}
      </div>

      <div className="hidden sm:block rounded-xl overflow-x-auto" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: t.tabBg }}>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: t.text2 }}>Ingrédient</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: t.text2 }}>Stock</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: t.text2 }}>Coût unitaire</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: t.text2 }}>Fournisseur</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: t.text2 }}>Actions</th>
            </tr>
          </thead>
          <tbody style={{ borderColor: t.border }}>
            {filtered.map(i => {
              const isLow = parseFloat(i.quantity) <= parseFloat(i.alert_threshold);
              return (
                <tr key={i.id} style={{ borderTop: `1px solid ${t.border}`, backgroundColor: isLow ? t.orangeBg : undefined }}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: t.text1 }}>{i.name}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-mono ${isLow ? 'font-bold' : ''}`} style={{ color: isLow ? t.orangeText : t.text1 }}>
                      {parseFloat(i.quantity).toFixed(1)} {i.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono" style={{ color: t.text2 }}>
                    {i.cost_per_unit > 0 ? `${parseFloat(i.cost_per_unit).toFixed(2)} €` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center" style={{ color: t.text2 }}>{i.supplier || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => { setShowMovement(i); setMovementForm({ adjustment: '', type: 'in', note: '' }); }}
                      className="text-xs hover:underline" style={{ color: t.greenText }}>Mouvement</button>
                    <button onClick={() => openEdit(i)} className="text-xs hover:underline" style={{ color: t.accent }}>Modifier</button>
                    <button onClick={() => deleteIngredient(i.id)} className="text-xs hover:underline" style={{ color: t.orangeText }}>Supprimer</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8" style={{ color: t.text2 }}>Aucun ingrédient</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowForm(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>{showForm === 'new' ? 'Nouvel ingrédient' : 'Modifier l\'ingrédient'}</h2>
            <div className="space-y-3">
              <input placeholder="Nom *" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" placeholder="Quantité initiale" value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="number" placeholder="Seuil d'alerte" value={form.alertThreshold}
                  onChange={e => setForm({ ...form, alertThreshold: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
                <input type="number" step="0.01" placeholder="Coût unitaire (€)" value={form.costPerUnit}
                  onChange={e => setForm({ ...form, costPerUnit: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
              </div>
              <input placeholder="Fournisseur" value={form.supplier}
                onChange={e => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.greenText, color: '#fff' }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showMovement && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowMovement(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-2" style={{ color: t.text1 }}>Mouvement de stock</h2>
            <p className="text-sm mb-4" style={{ color: t.text2 }}>{showMovement.name} — {parseFloat(showMovement.quantity).toFixed(1)} {showMovement.unit}</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                {movementTypes.map(mt => (
                  <button key={mt.v} onClick={() => setMovementForm({ ...movementForm, type: mt.v })}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                    style={movementForm.type === mt.v
                      ? { backgroundColor: mt.activeBg, color: mt.activeColor }
                      : { backgroundColor: t.tabBg, color: t.text1 }
                    }>
                    {mt.l}
                  </button>
                ))}
              </div>
              <input type="number" step="0.1" placeholder={`Quantité (${showMovement.unit})`} value={movementForm.adjustment}
                onChange={e => setMovementForm({ ...movementForm, adjustment: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
              <input placeholder="Note (optionnel)" value={movementForm.note}
                onChange={e => setMovementForm({ ...movementForm, note: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMovement(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={adjust} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.greenText, color: '#fff' }}>Valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
