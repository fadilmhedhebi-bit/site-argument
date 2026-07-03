import { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { useAuthStore } from '../stores/authStore';
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
    modules: [
      { id: 'commandes', label: 'Commandes', desc: 'Gérer les commandes' },
      { id: 'reservations', label: 'Réservations', desc: 'Prises de réservation' },
      { id: 'tables', label: 'Plan de table', desc: 'Gestion des tables' },
      { id: 'caisse', label: 'Caisse', desc: 'Encaissements & comptes' },
    ],
  },
  {
    title: 'Cuisine & Carte',
    modules: [
      { id: 'menu', label: 'Menu', desc: 'Carte & produits' },
      { id: 'ingredients', label: 'Ingrédients', desc: 'Matières premières' },
    ],
  },
  {
    title: 'Livraisons & Clients',
    modules: [
      { id: 'tournees', label: 'Tournées', desc: 'Planifier les livraisons' },
      { id: 'clients', label: 'Clients', desc: 'Comptes & fidélité' },
    ],
  },
  {
    title: 'Pilotage',
    modules: [
      { id: 'stats', label: 'Statistiques', desc: 'Tableaux de bord' },
      { id: 'equipe', label: 'Équipe', desc: 'Gestion du personnel' },
      { id: 'historique', label: 'Historique', desc: 'Journal des commandes' },
    ],
  },
];

const allModules = moduleGroups.flatMap(g => g.modules);

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

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState(null);
  const { t } = useTheme();
  const user = useAuthStore((s) => s.user);

  if (activeModule) {
    const ModuleComponent = components[activeModule];
    const mod = allModules.find(m => m.id === activeModule);
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold" style={{ color: t.text1 }}>
          Bonjour, {user?.firstName}
        </h1>
        <p className="text-sm mt-1" style={{ color: t.text2 }}>Que souhaitez-vous faire ?</p>
      </div>

      <div className="space-y-6">
        {moduleGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: t.text2 }}>
              {group.title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {group.modules.map((mod) => (
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
        ))}
      </div>
    </div>
  );
}
