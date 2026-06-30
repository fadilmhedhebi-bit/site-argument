import { useState } from 'react';
import CommandesTab from './tabs/CommandesTab';
import TourneesTab from './tabs/TourneesTab';
import StatsTab from './tabs/StatsTab';
import StockTab from './tabs/StockTab';
import EquipeTab from './tabs/EquipeTab';
import HistoriqueTab from './tabs/HistoriqueTab';

const tabs = [
  { id: 'commandes', label: 'Commandes', icon: '🛒' },
  { id: 'tournees', label: 'Tournées', icon: '🚗' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'stock', label: 'Stock', icon: '📦' },
  { id: 'equipe', label: 'Équipe', icon: '👥' },
  { id: 'historique', label: 'Historique', icon: '📒' },
];

const components = {
  commandes: CommandesTab,
  tournees: TourneesTab,
  stats: StatsTab,
  stock: StockTab,
  equipe: EquipeTab,
  historique: HistoriqueTab,
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('commandes');
  const TabComponent = components[activeTab];

  return (
    <div>
      <div className="hidden sm:flex gap-1 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-route text-paper'
                : 'bg-kraft/50 text-ink hover:bg-kraft'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <TabComponent />

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-kraft z-50 sm:hidden">
        <div className="flex justify-around items-center h-14">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center w-full h-full text-xl transition-colors ${
                activeTab === tab.id ? 'grayscale-0' : 'grayscale opacity-40'
              }`}
            >
              <span>{tab.icon}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
