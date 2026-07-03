import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';

const typeLabels = { sale: 'Vente', refund: 'Remboursement', expense: 'Dépense', deposit: 'Dépôt', withdrawal: 'Retrait' };
const methodLabels = { cash: 'Espèces', card: 'Carte', meal_voucher: 'Ticket resto' };

export default function CaisseTab() {
  const { t } = useTheme();
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [openFloat, setOpenFloat] = useState('');
  const [closeAmount, setCloseAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [showClose, setShowClose] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [txForm, setTxForm] = useState({ type: 'sale', paymentMethod: 'cash', amount: '', label: '' });

  const load = async () => {
    try {
      const [cur, hist] = await Promise.all([
        api.get('/caisse/current'),
        api.get('/caisse/history'),
      ]);
      setSession(cur);
      setHistory(hist);
      if (cur?.id) {
        const txs = await api.get(`/caisse/transactions?sessionId=${cur.id}`);
        setTransactions(txs);
      } else {
        setTransactions([]);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { load(); }, []);

  const openSession = async () => {
    if (!openFloat || isNaN(openFloat)) return alert('Montant invalide');
    try {
      await api.post('/caisse/open', { openingFloat: parseFloat(openFloat) });
      setOpenFloat('');
      load();
    } catch (err) { alert(err.message); }
  };

  const addTransaction = async () => {
    if (!txForm.amount || isNaN(txForm.amount)) return alert('Montant invalide');
    try {
      await api.post('/caisse/transaction', txForm);
      setShowTransaction(false);
      setTxForm({ type: 'sale', paymentMethod: 'cash', amount: '', label: '' });
      load();
    } catch (err) { alert(err.message); }
  };

  const closeSession = async () => {
    if (!closeAmount || isNaN(closeAmount)) return alert('Montant invalide');
    try {
      await api.post('/caisse/close', { closingAmount: parseFloat(closeAmount), notes: closeNotes });
      setShowClose(false);
      setCloseAmount('');
      setCloseNotes('');
      load();
    } catch (err) { alert(err.message); }
  };

  const inputStyle = { backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text1 };

  if (!session) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <p className="text-4xl mb-4"></p>
          <h3 className="text-lg font-heading mb-2" style={{ color: t.text1 }}>Ouvrir la caisse</h3>
          <p className="text-sm mb-6" style={{ color: t.text2 }}>Saisissez le fond de caisse pour démarrer la journée</p>
          <div className="flex gap-3 max-w-xs mx-auto">
            <input type="number" step="0.01" min="0" placeholder="Fond de caisse (€)" value={openFloat} onChange={e => setOpenFloat(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
            <button onClick={openSession} className="px-6 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.accent, color: '#fff' }}>Ouvrir</button>
          </div>
        </div>

        {history.length > 0 && (
          <div>
            <h3 className="text-lg font-heading mb-3" style={{ color: t.text1 }}>Historique des sessions</h3>
            <div className="space-y-2">
              {history.filter(h => h.status === 'closed').slice(0, 10).map(h => (
                <div key={h.id} className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-2" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: t.text1 }}>{new Date(h.opened_at).toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs" style={{ color: t.text2 }}>Par {h.opened_by_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold" style={{ color: t.accent }}>{parseFloat(h.total_sales).toFixed(2)} €</p>
                    {h.difference != null && (
                      <p className="text-xs" style={{ color: parseFloat(h.difference) === 0 ? t.greenText : t.orangeText }}>
                        Écart : {parseFloat(h.difference) > 0 ? '+' : ''}{parseFloat(h.difference).toFixed(2)} €
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const expected = parseFloat(session.opening_float) + parseFloat(session.total_cash);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Fond de caisse', value: `${parseFloat(session.opening_float).toFixed(2)} €`, accent: t.text1 },
          { label: 'Espèces', value: `${parseFloat(session.total_cash).toFixed(2)} €`, accent: t.greenText },
          { label: 'Carte', value: `${parseFloat(session.total_card).toFixed(2)} €`, accent: t.accent },
          { label: 'Ticket resto', value: `${parseFloat(session.total_meal_voucher).toFixed(2)} €`, accent: t.orangeText },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
            <p className="text-lg font-bold font-mono" style={{ color: s.accent }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: t.text2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm" style={{ color: t.text2 }}>Total ventes</p>
            <p className="text-2xl font-bold font-mono" style={{ color: t.accent }}>{parseFloat(session.total_sales).toFixed(2)} €</p>
          </div>
          <div className="text-right">
            <p className="text-sm" style={{ color: t.text2 }}>Transactions</p>
            <p className="text-2xl font-bold" style={{ color: t.text1 }}>{session.transaction_count}</p>
          </div>
          <div className="text-right">
            <p className="text-sm" style={{ color: t.text2 }}>Attendu en caisse</p>
            <p className="text-2xl font-bold font-mono" style={{ color: t.greenText }}>{expected.toFixed(2)} €</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={() => setShowTransaction(true)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.accent, color: '#fff' }}>+ Transaction</button>
        <button onClick={() => setShowClose(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-stop" style={{ backgroundColor: t.tabBg }}>Fermer la caisse</button>
        <button onClick={() => setShowHistory(!showHistory)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: t.tabBg, color: t.text1 }}>
          {showHistory ? 'Masquer' : 'Voir'} les transactions
        </button>
      </div>

      {showHistory && (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={['sale', 'deposit'].includes(tx.type)
                      ? { backgroundColor: t.greenBg, color: t.greenText }
                      : { backgroundColor: t.orangeBg, color: t.orangeText }
                    }>
                    {typeLabels[tx.type]}
                  </span>
                  <span className="text-xs" style={{ color: t.text2 }}>{methodLabels[tx.payment_method]}</span>
                </div>
                {tx.label && <p className="text-xs mt-1" style={{ color: t.text2 }}>{tx.label}</p>}
                <p className="text-[10px] mt-0.5" style={{ color: t.text3 }}>{new Date(tx.created_at).toLocaleTimeString('fr-FR')}</p>
              </div>
              <span className="font-mono font-bold" style={{ color: ['sale', 'deposit'].includes(tx.type) ? t.greenText : t.orangeText }}>
                {['sale', 'deposit'].includes(tx.type) ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} €
              </span>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-center py-4 text-sm" style={{ color: t.text3 }}>Aucune transaction</p>}
        </div>
      )}

      {showTransaction && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowTransaction(false)}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-4" style={{ color: t.text1 }}>Nouvelle transaction</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Type</label>
                <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle}>
                  <option value="sale">Vente</option>
                  <option value="refund">Remboursement</option>
                  <option value="expense">Dépense</option>
                  <option value="deposit">Dépôt</option>
                  <option value="withdrawal">Retrait</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Moyen de paiement</label>
                <select value={txForm.paymentMethod} onChange={e => setTxForm({ ...txForm, paymentMethod: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle}>
                  <option value="cash">Espèces</option>
                  <option value="card">Carte bancaire</option>
                  <option value="meal_voucher">Ticket restaurant</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Montant (€) *</label>
                <input type="number" step="0.01" min="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Libellé</label>
                <input value={txForm.label} onChange={e => setTxForm({ ...txForm, label: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} placeholder="Ex: Table 4, Menu du jour..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTransaction(false)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={addTransaction} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.accent, color: '#fff' }}>Valider</button>
            </div>
          </div>
        </div>
      )}

      {showClose && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowClose(false)}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6" style={{ backgroundColor: t.cardBg }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading mb-2" style={{ color: t.text1 }}>Fermer la caisse</h2>
            <p className="text-sm mb-4" style={{ color: t.text2 }}>Montant attendu en caisse : <strong style={{ color: t.greenText }}>{expected.toFixed(2)} €</strong></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Montant compté (€) *</label>
                <input type="number" step="0.01" min="0" value={closeAmount} onChange={e => setCloseAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} />
              </div>
              {closeAmount && !isNaN(closeAmount) && (
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: parseFloat(closeAmount) - expected === 0 ? t.greenBg : t.orangeBg }}>
                  <p className="text-sm font-semibold" style={{ color: parseFloat(closeAmount) - expected === 0 ? t.greenText : t.orangeText }}>
                    Écart : {(parseFloat(closeAmount) - expected) > 0 ? '+' : ''}{(parseFloat(closeAmount) - expected).toFixed(2)} €
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.text2 }}>Notes</label>
                <textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none text-sm" style={inputStyle} rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowClose(false)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: t.tabBg, color: t.text1 }}>Annuler</button>
              <button onClick={closeSession} className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white" style={{ backgroundColor: '#EF4444' }}>Fermer la caisse</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
