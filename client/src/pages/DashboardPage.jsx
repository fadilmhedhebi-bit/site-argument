import { useState } from 'react';
import { useTheme } from '../ThemeContext';
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

const tabs = [
  { id: 'commandes', label: 'Commandes', icon: '🛒' },
  { id: 'tournees', label: 'Tournées', icon: '🚗' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'menu', label: 'Menu', icon: '🍽️' },
  { id: 'ingredients', label: 'Ingrédients', icon: '🧂' },
  { id: 'tables', label: 'Tables', icon: '🪑' },
  { id: 'reservations', label: 'Réservations', icon: '📅' },
  { id: 'caisse', label: 'Caisse', icon: '💰' },
  { id: 'clients', label: 'Clients', icon: '💳' },
  { id: 'equipe', label: 'Équipe', icon: '👥' },
  { id: 'historique', label: 'Historique', icon: '📒' },
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

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('commandes');
  const { t } = useTheme();
  const TabComponent = components[activeTab];

  return (
    <div>
      <div className="hidden sm:flex gap-1 mb-6 overflow-x-auto pb-2 -mx-1 px-1 p-1 rounded-xl" style={{ backgroundColor: t.tabBg }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor: activeTab === tab.id ? t.tabActive : 'transparent',
              color: activeTab === tab.id ? t.accent : t.text2,
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <TabComponent />

      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden" style={{ backgroundColor: t.navBg, borderTop: `1px solid ${t.border}` }}>
        <div className="flex overflow-x-auto items-center h-14">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[3rem] h-full text-xl transition-colors ${
                activeTab === tab.id ? 'grayscale-0' : 'grayscale opacity-40'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
