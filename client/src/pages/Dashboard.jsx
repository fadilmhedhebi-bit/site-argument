import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const STATUS_COLORS = {
  pending: '#E8DCC8', confirmed: '#3F7D4F', preparing: '#E85D2E',
  ready: '#3F7D4F', in_delivery: '#E85D2E', delivered: '#3F7D4F',
  problem: '#C8312B', cancelled: '#1F2A24',
};

const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', in_delivery: 'En livraison', delivered: 'Livrée',
  problem: 'Problème', cancelled: 'Annulée',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/dashboard').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-ink/50">Chargement...</div>;
  if (!data) return <div className="text-center py-12 text-stop">Erreur de chargement</div>;

  const pieData = data.statusBreakdown.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: parseInt(s.count),
    color: STATUS_COLORS[s.status] || '#E8DCC8',
  }));

  return (
    <div>
      <h1 className="text-2xl text-ink mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Commandes aujourd'hui" value={data.today.total} color="route" />
        <StatCard label="Livrées" value={data.today.delivered} color="go" />
        <StatCard label="Problèmes" value={data.today.problems} color="stop" />
        <StatCard label="CA du jour" value={`${parseFloat(data.today.revenue).toFixed(2)} €`} color="ink" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-kraft p-6">
          <h2 className="text-sm font-heading text-ink mb-4">Chiffre d'affaires (7 jours)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DCC8" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${parseFloat(v).toFixed(2)} €`} />
              <Bar dataKey="revenue" fill="#E85D2E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-kraft p-6">
          <h2 className="text-sm font-heading text-ink mb-4">Répartition par statut</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-kraft p-6">
          <h2 className="text-sm font-heading text-ink mb-4">Top produits (30 jours)</h2>
          <div className="space-y-3">
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink">{p.product_name}</span>
                <div className="text-right">
                  <span className="font-mono text-route">{p.total_qty}x</span>
                  <span className="ml-3 text-ink/50">{parseFloat(p.total_revenue).toFixed(2)} €</span>
                </div>
              </div>
            ))}
            {data.topProducts.length === 0 && <p className="text-ink/40 text-sm">Aucune donnée</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-kraft p-6">
          <h2 className="text-sm font-heading text-ink mb-4">Performance livreurs (30 jours)</h2>
          <div className="space-y-3">
            {data.driverPerformance.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink">{d.first_name} {d.last_name}</span>
                <div className="flex gap-4 text-xs">
                  <span className="text-go">{d.completed} livrées</span>
                  <span className="text-stop">{d.problems} pb</span>
                </div>
              </div>
            ))}
            {data.driverPerformance.length === 0 && <p className="text-ink/40 text-sm">Aucun livreur</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`bg-white rounded-xl border border-kraft p-5 border-l-4 border-l-${color}`}>
      <p className="text-xs text-ink/50 mb-1">{label}</p>
      <p className={`text-2xl font-heading text-${color}`}>{value}</p>
    </div>
  );
}
