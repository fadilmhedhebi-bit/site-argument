import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import { isModuleAllowed } from '../planConfig';
import CommandesTab from './tabs/CommandesTab';
import TourneesTab from './tabs/TourneesTab';
import StatsTab from './tabs/StatsTab';
import MenuTab from './tabs/MenuTab';
import IngredientsTab from './tabs/IngredientsTab';
import TablesTab from './tabs/TablesTab';
import ReservationsTab from './tabs/ReservationsTab';
import CaisseTab from './tabs/CaisseTab';
import ClientsTab from './tabs/ClientsTab';
import EquipeTab from './tabs/EquipeTab';
import HistoriqueTab from './tabs/HistoriqueTab';

const moduleGroups = [
  {
    title: 'Service',
    desc: 'Commandes, réservations, caisse',
    modules: [
      { id: 'commandes', label: 'Commandes', desc: 'Gérer les commandes' },
      { id: 'reservations', label: 'Réservations', desc: 'Prises de réservation' },
      { id: 'caisse', label: 'Caisse', desc: 'Encaissements & comptes' },
    ],
  },
  {
    title: 'Cuisine & Carte',
    desc: 'Menu, produits, ingrédients',
    modules: [
      { id: 'menu', label: 'Menu', desc: 'Carte & produits' },
      { id: 'ingredients', label: 'Ingrédients', desc: 'Matières premières' },
    ],
  },
  {
    title: 'Livraisons',
    desc: 'Tournées, équipe',
    modules: [
      { id: 'tournees', label: 'Tournées', desc: 'Planifier les livraisons' },
      { id: 'equipe', label: 'Équipe', desc: 'Gestion du personnel' },
    ],
  },
  {
    title: 'Pilotage',
    desc: 'Statistiques, historique, tables, clients',
    modules: [
      { id: 'stats', label: 'Statistiques', desc: 'Tableaux de bord' },
      { id: 'historique', label: 'Historique', desc: 'Journal des commandes' },
      { id: 'tables', label: 'Plan de table', desc: 'Gestion des tables' },
      { id: 'clients', label: 'Clients', desc: 'Comptes & fidélité' },
    ],
  },
];

const allModules = moduleGroups.flatMap(g => g.modules);

const staffModules = [
  { id: 'commandes', label: 'Commandes', desc: 'Prise de commande' },
  { id: 'caisse', label: 'Caisse', desc: 'Encaissements & comptes' },
  { id: 'reservations', label: 'Réservations', desc: 'Prises de réservation' },
];

const components = {
  commandes: CommandesTab,
  tournees: TourneesTab,
  stats: StatsTab,
  menu: MenuTab,
  ingredients: IngredientsTab,
  tables: TablesTab,
  reservations: ReservationsTab,
  caisse: CaisseTab,
  clients: ClientsTab,
  equipe: EquipeTab,
  historique: HistoriqueTab,
};

const orderTypeLabels = { dine_in: 'Sur place', takeaway: 'Emporter', delivery: 'Livraison' };
const statusLabels = { preparing: 'En prépa.', in_delivery: 'En livraison' };

function orderTypeStyle(t, orderType) {
  if (orderType === 'delivery') return { backgroundColor: t.blueBg, color: t.blueText };
  if (orderType === 'dine_in') return { backgroundColor: t.greenBg, color: t.greenText };
  return { backgroundColor: t.orangeBg, color: t.orangeText };
}

function formatEuro(value) {
  return `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function KpiCard({ label, value, variation }) {
  return (
    <div className="flex-1 rounded-2xl p-3.5" style={{ backgroundColor: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.08)' }}>
      <p className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.55)' }}>{label}</p>
      <p className="text-[22px] font-bold text-white leading-tight mt-1">{value}</p>
      {variation && <p className="text-[10px] font-medium mt-0.5" style={{ color: '#D4AF37' }}>{variation}</p>}
    </div>
  );
}

function OrderCard({ order, t }) {
  return (
    <div className="rounded-2xl p-3.5 flex items-center justify-between" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <div>
        <p className="font-semibold text-sm" style={{ color: t.text1 }}>
          {order.order_type === 'dine_in' && order.table_number ? `Table ${order.table_number}` : `Commande #${order.order_number}`}
        </p>
        <p className="text-xs mt-0.5" style={{ color: t.text2 }}>{formatEuro(order.total)}</p>
      </div>
      <span className="text-[9px] font-semibold uppercase px-2 py-1 rounded-full" style={orderTypeStyle(t, order.order_type)}>
        {statusLabels[order.status] || orderTypeLabels[order.order_type] || order.order_type}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const { t } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'staff';

  const [todayStats, setTodayStats] = useState(null);
  const [tableStats, setTableStats] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);

  useEffect(() => {
    if (!isStaff) {
      api.get('/stats/dashboard').then(data => setTodayStats(data.today)).catch(() => {});
      if (isModuleAllowed(user?.plan, 'tables')) {
        api.get('/tables').then(tables => setTableStats({
          occupied: tables.filter(tb => tb.status === 'occupied').length,
          total: tables.length,
        })).catch(() => {});
      }
    }
    api.get('/orders?limit=50').then(orders => setActiveOrders(
      orders.filter(o => ['preparing', 'in_delivery'].includes(o.status)).slice(0, 5)
    )).catch(() => {});
  }, [isStaff, user?.plan]);

  if (activeModule) {
    const ModuleComponent = components[activeModule];
    const mod = (isStaff ? staffModules : allModules).find(m => m.id === activeModule);
    return (
      <div>
        <button
          onClick={() => setActiveModule(null)}
          className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: t.tabBg, color: t.text1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
          <span>{mod?.label}</span>
        </button>
        <ModuleComponent />
      </div>
    );
  }

  if (activeGroup !== null) {
    const group = moduleGroups[activeGroup];
    return (
      <div>
        <button
          onClick={() => setActiveGroup(null)}
          className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: t.tabBg, color: t.text1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
          <span>{group.title}</span>
        </button>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {group.modules.filter(mod => isModuleAllowed(user?.plan, mod.id)).map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className="flex flex-col items-start rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${t.border}`,
                boxShadow: '0 2px 8px rgba(0,0,0,.04)',
              }}
            >
              <span className="text-sm font-semibold" style={{ color: t.text1 }}>{mod.label}</span>
              <span className="text-[11px] mt-1 leading-tight" style={{ color: t.text2 }}>{mod.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (isStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold" style={{ color: t.text1 }}>Bonjour, {user?.firstName}</h1>
          <p className="text-sm mt-1" style={{ color: t.text2 }}>Que souhaitez-vous faire ?</p>
        </div>

        {activeOrders.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: t.text2 }}>En cours</h2>
            <div className="space-y-2">
              {activeOrders.map(order => <OrderCard key={order.id} order={order} t={t} />)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {staffModules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className="flex flex-col items-start rounded-xl p-5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}`, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}
            >
              <span className="text-sm font-semibold" style={{ color: t.text1 }}>{mod.label}</span>
              <span className="text-[11px] mt-1.5 leading-tight" style={{ color: t.text2 }}>{mod.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-5"
        style={{ backgroundImage: `linear-gradient(150deg, ${t.accent}, color-mix(in srgb, ${t.accent} 55%, black))` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,.55)' }}>Bonjour, {user?.firstName}</p>
            <p className="text-xl font-bold text-white tracking-tight">{user?.businessName || 'RestoLab'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <KpiCard label="CA jour" value={formatEuro(todayStats?.revenue)} />
          <KpiCard label="Commandes" value={todayStats?.total ?? '—'} />
          {isModuleAllowed(user?.plan, 'tables') && (
            <KpiCard label="Tables" value={tableStats ? `${tableStats.occupied}/${tableStats.total}` : '—'} />
          )}
        </div>
      </div>

      {activeOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: t.text2 }}>En cours</h2>
            <button onClick={() => setActiveModule('commandes')} className="text-xs font-medium" style={{ color: t.accent }}>Voir tout →</button>
          </div>
          <div className="space-y-2">
            {activeOrders.map(order => <OrderCard key={order.id} order={order} t={t} />)}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: t.text2 }}>Modules</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {moduleGroups.map((group, idx) => {
            const visibleCount = group.modules.filter(m => isModuleAllowed(user?.plan, m.id)).length;
            if (visibleCount === 0) return null;
            return (
              <button
                key={group.title}
                onClick={() => setActiveGroup(idx)}
                className="flex flex-col items-start rounded-xl p-5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  backgroundColor: t.cardBg,
                  border: `1px solid ${t.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,.04)',
                }}
              >
                <span className="text-sm font-semibold" style={{ color: t.text1 }}>{group.title}</span>
                <span className="text-[11px] mt-1.5 leading-tight" style={{ color: t.text2 }}>{group.desc}</span>
                <span className="text-[10px] font-mono mt-3" style={{ color: t.accent }}>{visibleCount} modules</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
