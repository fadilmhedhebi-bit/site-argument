import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

export default function StockTab() {
  const { t } = useTheme();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [promos, setPromos] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showProduct, setShowProduct] = useState(null);
  const [showPromo, setShowPromo] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', categoryId: '', stockQuantity: '', stockAlertThreshold: '5' });
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
        stockAlertThreshold: parseInt(productForm.stockAlertThreshold) || 5,
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

  const togglePromo = async (id) => {
    const p = promos.find(pr => pr.id === id);
    try { await api.patch(`/promos/${id}`, { isActive: !p?.is_active }); load(); } catch (err) { alert(err.message); }
  };
  const deletePromo = async (id) => { if (!confirm('Supprimer ?')) return; try { await api.delete(`/promos/${id}`); load(); } catch (err) { alert(err.message); } };

  const openEditProduct = (p) => {
    setProductForm({ name: p.name, description: p.description || '', price: p.price, categoryId: p.category_id || '', stockQuantity: p.stock_quantity, stockAlertThreshold: p.stock_alert_threshold || 5 });
    setShowProduct(p);
  };

  const openNewProduct = () => {
    setProductForm({ name: '', description: '', price: '', categoryId: '', stockQuantity: '', stockAlertThreshold: '5' });
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

  const inputStyle = {
    backgroundColor: t.bg,
    border: `1px solid ${t.border}`,
    color: t.text1,
  };

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: t.orangeBg, border: `1px solid ${t.orangeText}30` }}>
          <h3 className="text-sm font-heading mb-2" style={{ color: t.orangeText }}>Alertes stock</h3>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a.id} className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: t.cardBg, color: t.orangeText, border: `1px solid ${t.orangeText}30` }}>
                {a.name} : {a.stock_quantity} restant(s)
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Inventaire</h3>
          <button onClick={openNewProduct} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.accent, color: '#fff' }}>+ Produit</button>
        </div>
        <div className="flex gap-3 mb-4 flex-wrap">
          <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg text-sm focus:outline-none" style={{ ...inputStyle, borderColor: t.border }} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-4 py-2 rounded-lg text-sm focus:outline-none" style={inputStyle}>
            <option value="">Toutes categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="space-y-2 sm:hidden">
          {filtered.map(p => (
            <div key={p.id} className={`rounded-xl p-4 ${p.stock_quantity <= (p.stock_alert_threshold || 5) ? '' : ''}`}
              style={{
                backgroundColor: p.stock_quantity <= (p.stock_alert_threshold || 5) ? t.orangeBg : t.cardBg,
                border: `1px solid ${p.stock_quantity <= (p.stock_alert_threshold || 5) ? `${t.orangeText}30` : t.border}`,
              }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold" style={{ color: t.text1 }}>{p.name}</p>
                  {p.category_name && <p className="text-xs" style={{ color: t.text2 }}>{p.category_name}</p>}
                </div>
                <span className="font-mono font-bold" style={{ color: t.accent }}>{parseFloat(p.price).toFixed(2)} &euro;</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => adjustStock(p.id, -1)} className="w-9 h-9 rounded-full font-bold text-lg" style={{ backgroundColor: t.tabBg, color: t.text1 }}>&minus;</button>
                  <span className={`font-mono text-lg w-8 text-center ${p.stock_quantity <= (p.stock_alert_threshold || 5) ? 'font-bold' : ''}`}
                    style={{ color: p.stock_quantity <= (p.stock_alert_threshold || 5) ? t.orangeText : t.text1 }}>
                    {p.stock_quantity}
                  </span>
                  <button onClick={() => adjustStock(p.id, 1)} className="w-9 h-9 rounded-full font-bold text-lg" style={{ backgroundColor: t.tabBg, color: t.text1 }}>+</button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => openEditProduct(p)} className="text-sm py-1 px-2" style={{ color: t.accent }}>Modifier</button>
                  <button onClick={() => deleteProduct(p.id)} className="text-sm text-stop py-1 px-2">Suppr.</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center py-8" style={{ color: t.text3 }}>Aucun produit</p>}
        </div>
        <div className="hidden sm:block rounded-xl overflow-x-auto" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: t.tabBg }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: t.text2 }}>Produit</th>
                <th className="text-center px-4 py-3 font-semibold" style={{ color: t.text2 }}>Prix</th>
                <th className="text-center px-4 py-3 font-semibold" style={{ color: t.text2 }}>Stock</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: t.text2 }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: t.border }}>
              {filtered.map(p => (
                <tr key={p.id} style={p.stock_quantity <= (p.stock_alert_threshold || 5) ? { backgroundColor: t.orangeBg } : {}}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: t.text1 }}>{p.name}</p>
                    {p.category_name && <p className="text-xs" style={{ color: t.text2 }}>{p.category_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-center font-mono" style={{ color: t.accent }}>{parseFloat(p.price).toFixed(2)} &euro;</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => adjustStock(p.id, -1)} className="w-8 h-8 rounded-full font-bold" style={{ backgroundColor: t.tabBg, color: t.text1 }}>&minus;</button>
                      <span className={`font-mono w-8 text-center ${p.stock_quantity <= (p.stock_alert_threshold || 5) ? 'font-bold' : ''}`}
                        style={{ color: p.stock_quantity <= (p.stock_alert_threshold || 5) ? t.orangeText : t.text1 }}>
                        {p.stock_quantity}
                      </span>
                      <button onClick={() => adjustStock(p.id, 1)} className="w-8 h-8 rounded-full font-bold" style={{ backgroundColor: t.tabBg, color: t.text1 }}>+</button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEditProduct(p)} className="text-xs hover:underline" style={{ color: t.accent }}>Modifier</button>
                    <button onClick={() => deleteProduct(p.id)} className="text-xs text-stop hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="text-center py-8" style={{ color: t.text3 }}>Aucun produit</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Promotions</h3>
          <button onClick={openNewPromo} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.accent, color: '#fff' }}>+ Promo</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {promos.map(p => (
            <div key={p.id} className="rounded-xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, opacity: p.is_active ? 1 : 0.6 }}>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold" style={{ color: t.accent }}>{p.code}</span>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={p.is_active
                    ? { backgroundColor: t.greenBg, color: t.greenText }
                    : { backgroundColor: t.tabBg, color: t.text2 }
                  }>
                  {p.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-sm mt-2" style={{ color: t.text1 }}>
                {p.type === 'percentage' ? `${p.value}%` : p.type === 'fixed' ? `${p.value} €` : 'Livraison gratuite'}
              </p>
              {p.min_order_amount && <p className="text-xs" style={{ color: t.text2 }}>Min. {p.min_order_amount} &euro;</p>}
              {p.expires_at && <p className="text-xs" style={{ color: t.text2 }}>Expire : {new Date(p.expires_at).toLocaleDateString('fr-FR')}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => togglePromo(p.id)} className="text-xs hover:underline" style={{ color: t.accent }}>{p.is_active ? 'Desactiver' : 'Activer'}</button>
                <button onClick={() => openEditPromo(p)} className="text-xs hover:underline" style={{ color: t.accent }}>Modifier</button>
                <button onClick={() => deletePromo(p.id)} className="text-xs text-stop hover:underline">Supprimer</button>
              </div>
            </div>
          ))}
          {promos.length === 0 && <p className="text-sm col-span-full text-center py-4" style={{ color: t.text3 }}>Aucune promotion</p>}
        </div>
      </div>

      {showProduct && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowProduct(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>{showProduct === 'new' ? 'Nouveau produit' : 'Modifier le produit'}</h2>
            <div className="space-y-3">
              <input placeholder="Nom *" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              <textarea placeholder="Description" value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Prix *" type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                <select value={productForm.categoryId} onChange={e => setProductForm({ ...productForm, categoryId: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle}>
                  <option value="">Sans categorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Quantite" type="number" value={productForm.stockQuantity} onChange={e => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                <input placeholder="Seuil alerte" type="number" value={productForm.stockAlertThreshold} onChange={e => setProductForm({ ...productForm, stockAlertThreshold: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowProduct(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={saveProduct} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showPromo && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowPromo(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>{showPromo === 'new' ? 'Nouvelle promo' : 'Modifier la promo'}</h2>
            <div className="space-y-3">
              <input placeholder="Code promo *" value={promoForm.code} onChange={e => setPromoForm({ ...promoForm, code: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm font-mono uppercase" style={inputStyle} />
              <div className="grid grid-cols-2 gap-3">
                <select value={promoForm.type} onChange={e => setPromoForm({ ...promoForm, type: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle}>
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed">Montant fixe</option>
                  <option value="free_delivery">Livraison gratuite</option>
                </select>
                {promoForm.type !== 'free_delivery' && (
                  <input placeholder={promoForm.type === 'percentage' ? '% remise' : '€ remise'} type="number" value={promoForm.value}
                    onChange={e => setPromoForm({ ...promoForm, value: e.target.value })}
                    className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Min. commande (€)" type="number" value={promoForm.minOrder}
                  onChange={e => setPromoForm({ ...promoForm, minOrder: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                <input placeholder="Utilisations max" type="number" value={promoForm.maxUses}
                  onChange={e => setPromoForm({ ...promoForm, maxUses: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              </div>
              <input type="date" value={promoForm.expiresAt} onChange={e => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPromo(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={savePromo} className="flex-1 py-2.5 bg-go text-paper rounded-lg font-semibold text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
