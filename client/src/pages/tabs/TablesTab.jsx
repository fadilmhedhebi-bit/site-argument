import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

const statusLabels = { available: 'Libre', occupied: 'Occupée', reserved: 'Réservée' };
const statusColors = (t) => ({
  available: { bg: t.greenBg, text: t.greenText },
  occupied: { bg: t.orangeBg, text: t.orangeText },
  reserved: { bg: t.accentBg, text: t.accent },
});

export default function TablesTab() {
  const { t } = useTheme();
  const [tables, setTables] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const [form, setForm] = useState({ tableNumber: '', capacity: '2' });

  const load = () => {
    api.get('/tables').then(setTables).catch(console.error);
  };

  useEffect(load, []);

  const save = async () => {
    try {
      const body = { tableNumber: parseInt(form.tableNumber), capacity: parseInt(form.capacity) };
      if (showForm !== 'new') await api.put(`/tables/${showForm.id}`, body);
      else await api.post('/tables', body);
      setShowForm(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const deleteTable = async (id) => {
    if (!confirm('Supprimer cette table ?')) return;
    try { await api.delete(`/tables/${id}`); load(); } catch (err) { alert(err.message); }
  };

  const updateStatus = async (id, status) => {
    try { await api.patch(`/tables/${id}/status`, { status }); load(); } catch (err) { alert(err.message); }
  };

  const openEdit = (tbl) => {
    setForm({ tableNumber: tbl.table_number, capacity: tbl.capacity });
    setShowForm(tbl);
  };

  const openNew = () => {
    const next = tables.length > 0 ? Math.max(...tables.map(t => t.table_number)) + 1 : 1;
    setForm({ tableNumber: String(next), capacity: '2' });
    setShowForm('new');
  };

  const colors = statusColors(t);
  const inputStyle = { backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 };

  const summary = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
    totalSeats: tables.reduce((s, t) => s + t.capacity, 0),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total tables', value: summary.total, accent: t.text1 },
          { label: 'Libres', value: summary.available, accent: t.greenText },
          { label: 'Occupées', value: summary.occupied, accent: t.orangeText },
          { label: 'Places totales', value: summary.totalSeats, accent: t.accent },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
            <p className="text-2xl font-bold" style={{ color: s.accent }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: t.text2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Plan de table</h3>
        <button onClick={openNew} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.accent, color: '#fff' }}>+ Table</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {tables.map(tbl => {
          const sc = colors[tbl.status] || colors.available;
          return (
            <div key={tbl.id} className="rounded-xl p-4 text-center relative group" style={{ backgroundColor: t.cardBg, border: `2px solid ${sc.text}40` }}>
              <div className="text-3xl font-bold mb-1" style={{ color: t.text1 }}>{tbl.table_number}</div>
              <p className="text-xs mb-2" style={{ color: t.text2 }}>{tbl.capacity} place{tbl.capacity > 1 ? 's' : ''}</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>
                {statusLabels[tbl.status]}
              </span>
              <div className="flex gap-1 mt-3 justify-center flex-wrap">
                {tbl.status !== 'available' && (
                  <button onClick={() => updateStatus(tbl.id, 'available')} className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: t.greenBg, color: t.greenText }}>Libérer</button>
                )}
                {tbl.status !== 'occupied' && (
                  <button onClick={() => updateStatus(tbl.id, 'occupied')} className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: t.orangeBg, color: t.orangeText }}>Occuper</button>
                )}
              </div>
              <div className="flex gap-2 mt-2 justify-center">
                <button onClick={() => openEdit(tbl)} className="text-xs hover:underline" style={{ color: t.accent }}>Modifier</button>
                <button onClick={() => deleteTable(tbl.id)} className="text-xs text-stop hover:underline">Suppr.</button>
              </div>
            </div>
          );
        })}
        {tables.length === 0 && <p className="text-sm col-span-full text-center py-8" style={{ color: t.text3 }}>Aucune table configurée</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowForm(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>{showForm === 'new' ? 'Nouvelle table' : 'Modifier la table'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Numéro de table</label>
                <input type="number" min="1" value={form.tableNumber} onChange={e => setForm({ ...form, tableNumber: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Nombre de places</label>
                <input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.accent, color: '#fff' }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
