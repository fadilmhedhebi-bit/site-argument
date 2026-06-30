import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../../utils/api';

const COLORS = ['#F97316', '#22C55E', '#EF4444', '#E5E7EB', '#111827'];

export default function StatsTab() {
  const [stats, setStats] = useState(null);
  const [closings, setClosings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/stats/dashboard'),
      api.get('/stats/closings'),
      api.get('/orders?limit=200'),
    ]).then(([s, c, o]) => { setStats(s); setClosings(c); setOrders(o); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-ink/40">Chargement des statistiques...</div>;
  if (!stats) return <div className="text-center py-12 text-ink/40">Erreur de chargement</div>;

  const today = stats.today;

  const revenueTrend = stats.revenueTrend.map(d => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
    CA: parseFloat(d.revenue || 0),
    Livraisons: parseInt(d.orders || 0),
  }));

  const paymentData = (() => {
    const cash = closings.reduce((s, c) => s + parseFloat(c.revenue_cash || 0), 0);
    const card = closings.reduce((s, c) => s + parseFloat(c.revenue_card || 0), 0);
    const voucher = closings.reduce((s, c) => s + parseFloat(c.revenue_meal_voucher || 0), 0);
    return [
      { name: 'Espèces', value: cash },
      { name: 'Carte', value: card },
      { name: 'Ticket resto', value: voucher },
    ].filter(d => d.value > 0);
  })();

  const driverRanking = stats.driverPerformance
    .map(d => ({
      name: `${d.first_name} ${d.last_name?.[0] || ''}.`,
      Livrées: parseInt(d.completed || 0),
      Problèmes: parseInt(d.problems || 0),
    }))
    .sort((a, b) => b.Livrées - a.Livrées);

  const peakHours = (() => {
    const hours = {};
    for (let h = 8; h <= 23; h++) hours[h] = 0;
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      if (hours[h] !== undefined) hours[h]++;
    });
    return Object.entries(hours).map(([h, count]) => ({ heure: `${h}h`, commandes: count }));
  })();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Commandes aujourd'hui", value: today.total, color: 'text-route' },
          { label: 'Livrées', value: today.delivered, color: 'text-go' },
          { label: 'Problèmes', value: today.problems, color: 'text-stop' },
          { label: "CA aujourd'hui", value: `${parseFloat(today.revenue || 0).toFixed(2)} €`, color: 'text-ink' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-xl border border-kraft p-5">
            <p className="text-xs text-ink/50 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-3xl font-heading mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-kraft p-5">
          <h3 className="text-sm font-heading text-ink mb-4">CA / jour (7 derniers jours)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueTrend}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
              <Bar dataKey="CA" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-kraft p-5">
          <h3 className="text-sm font-heading text-ink mb-4">Livraisons / jour</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueTrend}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Livraisons" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-kraft p-5">
          <h3 className="text-sm font-heading text-ink mb-4">Répartition paiements</h3>
          {paymentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-ink/30 text-sm text-center py-12">Clôturez une journée pour voir les données</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-kraft p-5">
          <h3 className="text-sm font-heading text-ink mb-4">Classement livreurs (30j)</h3>
          {driverRanking.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={driverRanking} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="Livrées" fill="#22C55E" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Problèmes" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-ink/30 text-sm text-center py-12">Aucune donnée livreur</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-kraft p-5">
        <h3 className="text-sm font-heading text-ink mb-4">Heures de pointe</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={peakHours}>
            <XAxis dataKey="heure" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="commandes" fill="#F97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
