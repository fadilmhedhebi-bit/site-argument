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

const modules = [
  { id: 'reservations', label: 'Réservations', desc: 'Prises de réservation' },
  { id: 'commandes', label: 'Commandes', desc: 'Gérer les commandes' },
  { id: 'tables', label: 'Plan de table', desc: 'Gestion des tables' },
  { id: 'caisse', label: 'Caisse', desc: 'Encaissements & comptes' },
  { id: 'menu', label: 'Menu', desc: 'Carte & produits' },
  { id: 'stats', label: 'Statistiques', desc: 'Tableaux de bord' },
  { id: 'equipe', label: 'Équipe', desc: 'Gestion du personnel' },
  { id: 'tournees', label: 'Tournées', desc: 'Planifier les livraisons' },
  { id: 'clients', label: 'Clients', desc: 'Comptes & fidélité' },
  { id: 'ingredients', label: 'Ingrédients', desc: 'Matières premières' },
  { id: 'historique', label: 'Historique', desc: 'Journal des commandes' },
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
  const [activeModule, setActiveModule] = useState(null);
  const { t } = useTheme();
  const user = useAuthStore((s) => s.user);

  if (activeModule) {
    const ModuleComponent = components[activeModule];
    const mod = modules.find(m => m.id === activeModule);
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {modules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => setActiveModule(mod.id)}
            className="flex flex-col items-center justify-center aspect-square rounded-2xl p-4 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              backgroundColor: t.cardBg,
              border: `1px solid ${t.border}`,
              boxShadow: '0 2px 8px rgba(0,0,0,.04)',
            }}
          >
            <span className="text-sm font-semibold" style={{ color: t.text1 }}>{mod.label}</span>
            <span className="text-[11px] mt-1 text-center leading-tight" style={{ color: t.text2 }}>{mod.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
