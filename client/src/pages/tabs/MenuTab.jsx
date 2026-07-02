import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

export default function MenuTab() {
  const { t } = useTheme();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [promos, setPromos] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showProduct, setShowProduct] = useState(null);
  const [showPromo, setShowPromo] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', categoryId: '' });
  const [promoForm, setPromoForm] = useState({ code: '', type: 'percentage', value: '', minOrder: '', maxUses: '', expiresAt: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    Promise.all([
      api.get('/products'),
      api.get('/products/categories'),
      api.get('/promos'),
    ]).then(([p, c, pr]) => { setProducts(p); setCategories(c); setPromos(pr); }).catch(console.error);
  };

  useEffect(load, []);

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && p.category_id !== filterCat) return false;
    return true;
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveProduct = async () => {
    try {
      setUploading(true);
      const body = {
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        categoryId: productForm.categoryId || undefined,
        stockQuantity: 999,
        stockAlertThreshold: 0,
      };
      let product;
      if (showProduct !== 'new') {
        product = await api.put(`/products/${showProduct.id}`, body);
      } else {
        product = await api.post('/products', body);
      }

      if (imageFile && product?.id) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await api.upload(`/products/${product.id}/image`, fd);
      }

      setShowProduct(null);
      setImageFile(null);
      setImagePreview(null);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Supprimer ce produit du menu ?')) return;
    try { await api.delete(`/products/${id}`); load(); } catch (err) { alert(err.message); }
  };

  const toggleAvailable = async (p) => {
    try {
      await api.put(`/products/${p.id}`, { ...p, categoryId: p.category_id, isAvailable: !p.is_available });
      load();
    } catch (err) { alert(err.message); }
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
    setProductForm({ name: p.name, description: p.description || '', price: p.price, categoryId: p.category_id || '' });
    setImageFile(null);
    setImagePreview(p.image_url ? `${(import.meta.env.VITE_API_URL || '')}${p.image_url}` : null);
    setShowProduct(p);
  };

  const openNewProduct = () => {
    setProductForm({ name: '', description: '', price: '', categoryId: '' });
    setImageFile(null);
    setImagePreview(null);
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

  const inputStyle = { backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 };
  const apiBase = import.meta.env.VITE_API_URL || '';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Carte / Menu</h3>
          <button onClick={openNewProduct} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.accent, color: '#fff' }}>+ Produit</button>
        </div>
        <div className="flex gap-3 mb-4 flex-wrap">
          <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg text-sm focus:outline-none" style={{ ...inputStyle, borderColor: t.border }} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-4 py-2 rounded-lg text-sm focus:outline-none" style={inputStyle}>
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, opacity: p.is_available ? 1 : 0.6 }}>
              {p.image_url ? (
                <img src={`${apiBase}${p.image_url}`} alt={p.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 flex items-center justify-center text-4xl" style={{ backgroundColor: t.tabBg }}>
                  🍽️
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate" style={{ color: t.text1 }}>{p.name}</h4>
                    {p.category_name && <p className="text-xs" style={{ color: t.text2 }}>{p.category_name}</p>}
                  </div>
                  <span className="font-mono font-bold text-lg ml-2 whitespace-nowrap" style={{ color: t.accent }}>{parseFloat(p.price).toFixed(2)} €</span>
                </div>
                {p.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: t.text2 }}>{p.description}</p>}
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
                  <button onClick={() => toggleAvailable(p)} className="text-xs px-2 py-1 rounded-full"
                    style={p.is_available ? { backgroundColor: t.greenBg, color: t.greenText } : { backgroundColor: t.tabBg, color: t.text2 }}>
                    {p.is_available ? 'Disponible' : 'Masqué'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => openEditProduct(p)} className="text-xs hover:underline" style={{ color: t.accent }}>Modifier</button>
                    <button onClick={() => deleteProduct(p.id)} className="text-xs text-stop hover:underline">Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm col-span-full text-center py-8" style={{ color: t.text3 }}>Aucun produit sur la carte</p>}
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
                  style={p.is_active ? { backgroundColor: t.greenBg, color: t.greenText } : { backgroundColor: t.tabBg, color: t.text2 }}>
                  {p.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-sm mt-2" style={{ color: t.text1 }}>
                {p.type === 'percentage' ? `${p.value}%` : p.type === 'fixed' ? `${p.value} €` : 'Livraison gratuite'}
              </p>
              {p.min_order_amount && <p className="text-xs" style={{ color: t.text2 }}>Min. {p.min_order_amount} €</p>}
              {p.expires_at && <p className="text-xs" style={{ color: t.text2 }}>Expire : {new Date(p.expires_at).toLocaleDateString('fr-FR')}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => togglePromo(p.id)} className="text-xs hover:underline" style={{ color: t.accent }}>{p.is_active ? 'Désactiver' : 'Activer'}</button>
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
          <div className="rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>{showProduct === 'new' ? 'Nouveau produit' : 'Modifier le produit'}</h2>
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2">
                {imagePreview ? (
                  <img src={imagePreview} alt="Aperçu" className="w-full h-40 object-cover rounded-lg" />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center rounded-lg text-3xl" style={{ backgroundColor: t.tabBg }}>🍽️</div>
                )}
                <label className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ backgroundColor: t.accentBg, color: t.accent }}>
                  {imagePreview ? 'Changer la photo' : 'Ajouter une photo'}
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              </div>
              <input placeholder="Nom du produit *" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              <textarea placeholder="Description" value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Prix *" type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                <select value={productForm.categoryId} onChange={e => setProductForm({ ...productForm, categoryId: e.target.value })}
                  className="px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle}>
                  <option value="">Sans catégorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowProduct(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={saveProduct} disabled={uploading} className="flex-1 py-2.5 rounded-lg font-semibold text-sm"
                style={{ backgroundColor: t.accent, color: '#fff', opacity: uploading ? 0.7 : 1 }}>
                {uploading ? 'Envoi...' : 'Enregistrer'}
              </button>
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
              <button onClick={savePromo} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.accent, color: '#fff' }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
