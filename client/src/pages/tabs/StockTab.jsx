import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function StockTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [promos, setPromos] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showProduct, setShowProduct] = useState(null);
  const [showPromo, setShowPromo] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', categoryId: '', stockQuantity: '', lowStockThreshold: '5' });
  const [promoForm, setPromoForm] = useState({ code: '', type: 'percentage', value: '', minOrder: '', maxUses: '', expiresAt: '' });

  const load = () => {
    Promise.all([
      api.get('/products'),
      api.get('/products/categories'),
      api.get('/products/alerts'),
      api.get('/promos'),
    ]).then(([p, c, a, pr]) => { setProducts(p); setCategories(c); setAlerts(a); setPromos(pr); }).catch(console.error);
  };

  useEffect(load, []);

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && p.category_id !== filterCat) return false;
    return true;
  });

  const saveProduct = async () => {
    try {
      const body = {
        name: productForm.name, description: productForm.description,
        price: parseFloat(productForm.price),
        categoryId: productForm.categoryId || undefined,
        stockQuantity: parseInt(productForm.stockQuantity) || 0,
        lowStockThreshold: parseInt(productForm.lowStockThreshold) || 5,
      };
      if (showProduct !== 'new') await api.put(`/products/${showProduct.id}`, body);
      else await api.post('/products', body);
      setShowProduct(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const adjustStock = async (id, delta) => {
    try { await api.patch(`/products/${id}/stock`, { adjustment: delta }); load(); } catch (err) { alert(err.message); }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try { await api.delete(`/products/${id}`); load(); } catch (err) { alert(err.message); }
  };

  const savePromo = async () => {
    try {
      const body = {
        code: promoForm.code.toUpperCase(), type: promoForm.type,
        value: promoForm.type !== 'free_delivery' ? parseFloat(promoForm.value) : 0,
        minOrderAmount: promoForm.minOrder ? parseFloat(promoForm.minOrder) : undefined,
        maxUses: promoForm.maxUses ? parseInt(promoForm.maxUses) : undefined,
        expiresAt: promoForm.expiresAt || undefined,
      };
      if (showPromo !== 'new') await api.put(`/promos/${showPromo.id}`, body);
      else await api.post('/promos', body);
      setShowPromo(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const togglePromo = async (id) => { try { await api.patch(`/promos/${id}`); load(); } catch (err) { alert(err.message); } };
  const deletePromo = async (id) => { if (!confirm('Supprimer ?')) return; try { await api.delete(`/promos/${id}`); load(); } catch (err) { alert(err.message); } };

  const openEditProduct = (p) => {
    setProductForm({ name: p.name, description: p.description || '', price: p.price, categoryId: p.category_id || '', stockQuantity: p.stock_quantity, lowStockThreshold: p.low_stock_threshold || 5 });
    setShowProduct(p);
  };

  const openNewProduct = () => {
    setProductForm({ name: '', description: '', price: '', categoryId: '', stockQuantity: '', lowStockThreshold: '5' });
    setShowProduct('new');
  };

  const openEditPromo = (p) => {
    setPromoForm({ code: p.code, type: p.type, value: p.value, minOrder: p.min_order_amount || '', maxUses: p.max_uses || '', expiresAt: p.expires_at ? p.expires_at.split('T')[0] : '' });
    setShowPromo(p);
  };

  const openNewPromo = () => {
    setPromoForm({ code: '', type: 'percentage', value: '', minOrder: '', maxUses: '', expiresAt: '' });
    setShowPromo('new');
  };

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="bg-stop/10 border border-stop/30 rounded-xl p-4">
          <h3 className="text-sm font-heading text-stop mb-2">Alertes stock</h3>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a.id} className="bg-white px-3 py-1 rounded-full text-xs text-stop border border-stop/20">
                {a.name} : {a.stock_quantity} restant(s)
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-heading text-ink">Inventaire</h3>
          <button onClick={openNewProduct} className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90">+ Produit</button>
        </div>
        <div className="flex gap-3 mb-4 flex-wrap">
          <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-kraft rounded-lg bg-paper text-sm focus:outline-none focus:border-route" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-4 py-2 border border-kraft rounded-lg bg-paper text-sm focus:outline-none focus:border-route">
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-kraft overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-kraft/30">
              <tr>
                <th className="text-left px-4 py-3 text-ink/60 font-semibold">Produit</th>
                <th className="text-center px-4 py-3 text-ink/60 font-semibold">Prix</th>
                <th className="text-center px-4 py-3 text-ink/60 font-semibold">Stock</th>
                <th className="text-right px-4 py-3 text-ink/60 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kraft/30">
              {filtered.map(p => (
                <tr key={p.id} className={p.stock_quantity <= (p.low_stock_threshold || 5) ? 'bg-stop/5' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{p.name}</p>
                    {p.category_name && <p className="text-xs text-ink/40">{p.category_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-route">{parseFloat(p.price).toFixed(2)} €</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => adjustStock(p.id, -1)} className="w-7 h-7 rounded-full bg-kraft text-ink font-bold hover:bg-kraft/80">−</button>
                      <span className={`font-mono w-8 text-center ${p.stock_quantity <= (p.low_stock_threshold || 5) ? 'text-stop font-bold' : 'text-ink'}`}>
                        {p.stock_quantity}
                      </span>
                      <button onClick={() => adjustStock(p.id, 1)} className="w-7 h-7 rounded-full bg-kraft text-ink font-bold hover:bg-kraft/80">+</button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEditProduct(p)} className="text-xs text-route hover:underline">Modifier</button>
                    <button onClick={() => deleteProduct(p.id)} className="text-xs text-stop hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-ink/30">Aucun produit</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading text-ink">Promotions</h3>
          <button onClick={openNewPromo} className="px-4 py-2 bg-route text-paper rounded-lg text-sm font-semibold hover:bg-route/90">+ Promo</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {promos.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-4 ${p.is_active ? 'border-kraft' : 'border-kraft/30 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-route font-bold">{p.code}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-go/20 text-go' : 'bg-kraft text-ink/40'}`}>
                  {p.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-sm text-ink mt-2">
                {p.type === 'percentage' ? `${p.value}%` : p.type === 'fixed' ? `${p.value} €` : 'Livraison gratuite'}
              </p>
              {p.min_order_amount && <p className="text-xs text-ink/40">Min. {p.min_order_amount} €</p>}
              {p.expires_at && <p className="text-xs text-ink/40">Expire : {new Date(p.expires_at).toLocaleDateString('fr-FR')}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => togglePromo(p.id)} className="text-xs text-route hover:underline">{p.is_active ? 'Désactiver' : 'Activer'}</button>
                <button onClick={() => openEditPromo(p)} className="text-xs text-route hover:underline">Modifier</button>
                <button onClick={() => deletePromo(p.id)} className="text-xs text-stop hover:underline">Supprimer</button>
              </div>
            </div>
          ))}
          {promos.length === 0 && <p className="text-ink/30 text-sm col-span-full text-center py-4">Aucune promotion</p>}
        </div>
      </div>

      {showProduct && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowProduct(null)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-4">{showProduct === 'new' ? 'Nouveau produit' : 'Modifier le produit'}</h2>
            <div className="space-y-3">
              <input placeholder="Nom *" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              <textarea placeholder="Description" value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Prix *" type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <select value={productForm.categoryId} onChange={e => setProductForm({ ...productForm, categoryId: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
                  <option value="">Sans catégorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Quantité" type="number" value={productForm.stockQuantity} onChange={e => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <input placeholder="Seuil alerte" type="number" value={productForm.lowStockThreshold} onChange={e => setProductForm({ ...productForm, lowStockThreshold: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowProduct(null)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
              <button onClick={saveProduct} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showPromo && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPromo(null)}>
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-ink mb-4">{showPromo === 'new' ? 'Nouvelle promo' : 'Modifier la promo'}</h2>
            <div className="space-y-3">
              <input placeholder="Code promo *" value={promoForm.code} onChange={e => setPromoForm({ ...promoForm, code: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm font-mono uppercase" />
              <div className="grid grid-cols-2 gap-3">
                <select value={promoForm.type} onChange={e => setPromoForm({ ...promoForm, type: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm">
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed">Montant fixe</option>
                  <option value="free_delivery">Livraison gratuite</option>
                </select>
                {promoForm.type !== 'free_delivery' && (
                  <input placeholder={promoForm.type === 'percentage' ? '% remise' : '€ remise'} type="number" value={promoForm.value}
                    onChange={e => setPromoForm({ ...promoForm, value: e.target.value })}
                    className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Min. commande (€)" type="number" value={promoForm.minOrder}
                  onChange={e => setPromoForm({ ...promoForm, minOrder: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
                <input placeholder="Utilisations max" type="number" value={promoForm.maxUses}
                  onChange={e => setPromoForm({ ...promoForm, maxUses: e.target.value })}
                  className="px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
              </div>
              <input type="date" value={promoForm.expiresAt} onChange={e => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
                className="w-full px-4 py-2.5 border border-kraft rounded-lg bg-paper focus:outline-none focus:border-route text-sm" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPromo(null)} className="flex-1 py-2.5 bg-kraft text-ink rounded-lg font-semibold text-sm">Annuler</button>
              <button onClick={savePromo} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
