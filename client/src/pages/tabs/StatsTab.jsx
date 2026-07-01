import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../../utils/api';
import { useTheme } from '../../ThemeContext';
import { colors } from '../../theme';

const COLORS = [colors.teal, colors.violet, colors.navy, colors.green, colors.nearBlack];

export default function StatsTab() {
  const { t, isDark } = useTheme();
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

  if (loading) return <div className="text-center py-12" style={{ color: t.text2 }}>Chargement des statistiques...</div>;
  if (!stats) return <div className="text-center py-12" style={{ color: t.text2 }}>Erreur de chargement</div>;

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
          { label: "Commandes aujourd'hui", value: today.total, color: t.accent },
          { label: 'Livrées', value: today.delivered, color: t.greenText },
          { label: 'Problèmes', value: today.problems, color: t.orangeText },
          { label: "CA aujourd'hui", value: `${parseFloat(today.revenue || 0).toFixed(2)} €`, color: t.text1 },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: t.text2 }}>{kpi.label}</p>
            <p className="text-3xl font-heading mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <h3 className="text-sm font-heading mb-4" style={{ color: t.text1 }}>CA / jour (7 derniers jours)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueTrend}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.text2 }} />
              <YAxis tick={{ fontSize: 11, fill: t.text2 }} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} contentStyle={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
              <Bar dataKey="CA" fill={colors.teal} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <h3 className="text-sm font-heading mb-4" style={{ color: t.text1 }}>Livraisons / jour</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueTrend}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.text2 }} />
              <YAxis tick={{ fontSize: 11, fill: t.text2 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
              <Bar dataKey="Livraisons" fill={colors.violet} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <h3 className="text-sm font-heading mb-4" style={{ color: t.text1 }}>Répartition paiements</h3>
          {paymentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} contentStyle={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-center py-12" style={{ color: t.text3 }}>Clôturez une journée pour voir les données</p>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <h3 className="text-sm font-heading mb-4" style={{ color: t.text1 }}>Classement livreurs (30j)</h3>
          {driverRanking.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={driverRanking} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: t.text2 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: t.text2 }} />
                <Tooltip contentStyle={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
                <Bar dataKey="Livrées" fill={colors.violet} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Problèmes" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-center py-12" style={{ color: t.text3 }}>Aucune donnée livreur</p>
          )}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
        <h3 className="text-sm font-heading mb-4" style={{ color: t.text1 }}>Heures de pointe</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={peakHours}>
            <XAxis dataKey="heure" tick={{ fontSize: 10, fill: t.text2 }} />
            <YAxis tick={{ fontSize: 11, fill: t.text2 }} allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, color: t.text1 }} />
            <Bar dataKey="commandes" fill={colors.teal} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
