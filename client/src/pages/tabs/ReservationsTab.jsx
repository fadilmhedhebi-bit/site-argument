import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

const statusLabels = { confirmed: 'Confirmée', cancelled: 'Annulée', completed: 'Terminée', no_show: 'Absent' };

export default function ReservationsTab() {
  const { t } = useTheme();
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerLastName: '', customerFirstName: '', customerPhone: '',
    reservationDate: '', reservationTime: '', partySize: '2', tableId: '', notes: '',
  });

  const load = () => {
    const params = new URLSearchParams();
    if (filterDate) params.set('date', filterDate);
    if (filterStatus) params.set('status', filterStatus);
    Promise.all([
      api.get(`/reservations?${params}`),
      api.get('/tables'),
    ]).then(([r, t]) => { setReservations(r); setTables(t); }).catch(console.error);
  };

  useEffect(load, [filterDate, filterStatus]);

  const save = async () => {
    try {
      await api.post('/reservations', form);
      setShowForm(false);
      load();
    } catch (err) { alert(err.message); }
  };

  const updateStatus = async (id, status) => {
    try { await api.patch(`/reservations/${id}/status`, { status }); load(); } catch (err) { alert(err.message); }
  };

  const deleteReservation = async (id) => {
    if (!confirm('Supprimer cette réservation ?')) return;
    try { await api.delete(`/reservations/${id}`); load(); } catch (err) { alert(err.message); }
  };

  const openNew = () => {
    setForm({
      customerLastName: '', customerFirstName: '', customerPhone: '',
      reservationDate: filterDate || new Date().toISOString().split('T')[0],
      reservationTime: '19:00', partySize: '2', tableId: '', notes: '',
    });
    setShowForm(true);
  };

  const inputStyle = { backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 };
  const availableTables = tables.filter(tbl => tbl.status === 'available');

  const todayCount = reservations.filter(r => r.status === 'confirmed').length;
  const totalGuests = reservations.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.party_size, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <p className="text-2xl font-bold" style={{ color: t.accent }}>{todayCount}</p>
          <p className="text-xs mt-1" style={{ color: t.text2 }}>Réservations</p>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <p className="text-2xl font-bold" style={{ color: t.text1 }}>{totalGuests}</p>
          <p className="text-xs mt-1" style={{ color: t.text2 }}>Couverts prévus</p>
        </div>
        <div className="rounded-xl p-4 text-center hidden sm:block" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <p className="text-2xl font-bold" style={{ color: t.greenText }}>{availableTables.length}</p>
          <p className="text-xs mt-1" style={{ color: t.text2 }}>Tables libres</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-heading" style={{ color: t.text1 }}>Réservations</h3>
        <button onClick={openNew} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.accent, color: '#fff' }}>+ Réservation</button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm focus:outline-none" style={inputStyle} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm focus:outline-none" style={inputStyle}>
          <option value="">Tous statuts</option>
          <option value="confirmed">Confirmées</option>
          <option value="completed">Terminées</option>
          <option value="cancelled">Annulées</option>
          <option value="no_show">Absents</option>
        </select>
      </div>

      <div className="space-y-3">
        {reservations.map(r => {
          const isActive = r.status === 'confirmed';
          return (
            <div key={r.id} className="rounded-xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, opacity: isActive ? 1 : 0.7 }}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ backgroundColor: t.accentBg, color: t.accent }}>{r.reservation_number}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={isActive ? { backgroundColor: t.greenBg, color: t.greenText } : { backgroundColor: t.tabBg, color: t.text2 }}>
                      {statusLabels[r.status]}
                    </span>
                  </div>
                  <p className="font-semibold" style={{ color: t.text1 }}>{r.customer_first_name} {r.customer_last_name}</p>
                  <p className="text-xs" style={{ color: t.text2 }}>{r.customer_phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold" style={{ color: t.accent }}>
                    {r.reservation_time.slice(0, 5)}
                  </p>
                  <p className="text-xs" style={{ color: t.text2 }}>{r.party_size} pers.</p>
                  {r.table_number && <p className="text-xs" style={{ color: t.text2 }}>Table {r.table_number}</p>}
                </div>
              </div>
              {r.notes && <p className="text-xs mt-2 italic" style={{ color: t.text2 }}>{r.notes}</p>}
              {isActive && (
                <div className="flex gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: `1px solid ${t.border}` }}>
                  <button onClick={() => updateStatus(r.id, 'completed')} className="text-xs px-3 py-1 rounded" style={{ backgroundColor: t.greenBg, color: t.greenText }}>Terminée</button>
                  <button onClick={() => updateStatus(r.id, 'no_show')} className="text-xs px-3 py-1 rounded" style={{ backgroundColor: t.orangeBg, color: t.orangeText }}>Absent</button>
                  <button onClick={() => updateStatus(r.id, 'cancelled')} className="text-xs px-3 py-1 rounded text-stop" style={{ backgroundColor: t.tabBg }}>Annuler</button>
                  <button onClick={() => deleteReservation(r.id)} className="text-xs text-stop hover:underline ml-auto">Supprimer</button>
                </div>
              )}
            </div>
          );
        })}
        {reservations.length === 0 && <p className="text-center py-8" style={{ color: t.text3 }}>Aucune réservation pour cette date</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowForm(false)}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>Nouvelle réservation</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Nom *</label>
                  <input value={form.customerLastName} onChange={e => setForm({ ...form, customerLastName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Prénom *</label>
                  <input value={form.customerFirstName} onChange={e => setForm({ ...form, customerFirstName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Téléphone *</label>
                <input type="tel" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Date *</label>
                  <input type="date" value={form.reservationDate} onChange={e => setForm({ ...form, reservationDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Heure *</label>
                  <input type="time" value={form.reservationTime} onChange={e => setForm({ ...form, reservationTime: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Nb de personnes *</label>
                  <input type="number" min="1" value={form.partySize} onChange={e => setForm({ ...form, partySize: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Table</label>
                  <select value={form.tableId} onChange={e => setForm({ ...form, tableId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle}>
                    <option value="">Aucune</option>
                    {availableTables.map(tbl => (
                      <option key={tbl.id} value={tbl.id}>N°{tbl.table_number} ({tbl.capacity} pl.)</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} rows={2} placeholder="Allergies, occasion spéciale..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.accent, color: '#fff' }}>Réserver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
