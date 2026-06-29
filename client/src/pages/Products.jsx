import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', categoryId: '', stockQuantity: '', stockAlertThreshold: '5' });
  const [catForm, setCatForm] = useState({ name: '', description: '' });

  const load = () => {
    api.get('/products').then(setProducts).catch(console.error);
    api.get('/products/categories').then(setCategories).catch(console.error);
    api.get('/products/alerts').then(setAlerts).catch(console.error);
  };
  useEffect(load, []);

  const handleSubmit = async () => {
    try {
      if (editing) {
        await api.put(`/products/${editing}`, form);
      } else {
        await api.post('/products', form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', description: '', price: '', categoryId: '', stockQuantity: '', stockAlertThreshold: '5' });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCatSubmit = async () => {
    try {
      await api.post('/products/categories', catForm);
      setCatForm({ name: '', description: '' });
      setShowCatForm(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const startEdit = (product) => {
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      categoryId: product.category_id || '',
      stockQuantity: product.stock_quantity,
      stockAlertThreshold: product.stock_alert_threshold,
      isAvailable: product.is_available,
    });
    setEditing(product.id);
    setShowForm(true);
  };

  const deleteProduct = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await api.delete(`/products/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-ink">Produits & Inventaire</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCatForm(true)}
            className="px-4 py-2 bg-kraft text-ink rounded-lg text-sm font-semibold hover:bg-kraft/80 transition-colors">
            + Catégorie
          </button>
          <button onClick={() => { setEditing(null); setForm({ name: '', description: '', price: '', categoryId: '', stockQuantity: '', stockAlertThreshold: '5' }); setShowForm(true); }}
            className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90 transition-colors">
            + Produit
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-stop/10 border border-stop rounded-xl p-4 mb-6">
          <h3 className="text-sm font-bold text-stop mb-2">Alertes de stock</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {alerts.map((a) => (
              <div key={a.id} className="text-sm flex justify-between">
                <span className="text-ink">{a.name}</span>
                <span className="font-mono text-stop font-bold">{a.stock_quantity} restant(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-kraft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-kraft/30">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-ink/70">Produit</th>
              <th className="text-left px-4 py-3 font-semibold text-ink/70">Catégorie</th>
              <th className="text-left px-4 py-3 font-semibold text-ink/70">Prix</th>
              <th className="text-left px-4 py-3 font-semibold text-ink/70">Stock</th>
              <th className="text-left px-4 py-3 font-semibold text-ink/70">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-kraft/50 hover:bg-paper/50">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  {p.description && <div className="text-xs text-ink/50">{p.description}</div>}
                </td>
                <td className="px-4 py-3 text-ink/70">{p.category_name || '-'}</td>
                <td className="px-4 py-3 font-mono text-route">{parseFloat(p.price).toFixed(2)} €</td>
                <td className="px-4 py-3">
                  <span className={`font-mono ${p.stock_quantity <= p.stock_alert_threshold ? 'text-stop font-bold' : 'text-ink'}`}>
                    {p.stock_quantity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${p.is_available ? 'bg-go/20 text-go' : 'bg-ink/20 text-ink/60'}`}>
                    {p.is_available ? 'Disponible' : 'Indisponible'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(p)} className="text-xs text-route hover:underline">Modifier</button>
                    <button onClick={() => deleteProduct(p.id)} className="text-xs text-stop hover:underline">Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-ink/40">Aucun produit</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-4">{editing ? 'Modifier le produit' : 'Nouveau produit'}</h2>
            <div className="space-y-3">
              <input placeholder="Nom *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Prix *" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
                  <option value="">Sans catégorie</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Quantité en stock" type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <input placeholder="Seuil d'alerte" type="number" value={form.stockAlertThreshold} onChange={(e) => setForm({ ...form, stockAlertThreshold: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
                  Disponible à la vente
                </label>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
              <button onClick={handleSubmit} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">{editing ? 'Modifier' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}

      {showCatForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCatForm(false)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-4">Nouvelle catégorie</h2>
            <div className="space-y-3">
              <input placeholder="Nom *" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <input placeholder="Description" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowCatForm(false)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
              <button onClick={handleCatSubmit} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
