import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import FoodlyLogo from './FoodlyLogo';

const roleLabel = { manager: 'Gestionnaire', manager_driver: 'Gestionnaire + Livreur', driver: 'Livreur' };

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAllRead } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <header className="bg-white border-b border-[rgba(0,0,0,0.06)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <FoodlyLogo size={30} />
            <span className="text-xl font-bold text-ink tracking-[-1.5px]">foodly</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {user?.role === 'manager_driver' && (
              <Link
                to={location.pathname === '/livraison' ? '/dashboard' : '/livraison'}
                className="px-3 py-2 bg-route/10 text-route rounded-lg text-xs font-semibold hover:bg-route/20 no-underline"
              >
                {location.pathname === '/livraison' ? '← Gestion' : 'Tournée →'}
              </Link>
            )}
            <button onClick={markAllRead} className="relative p-2 w-[34px] h-[34px] rounded-full bg-route/10 flex items-center justify-center text-route hover:bg-route/20 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-stop text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="w-[34px] h-[34px] rounded-full bg-route flex items-center justify-center text-white text-xs font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="text-sm hidden sm:block">
              <span className="font-medium text-ink">{user?.firstName}</span>
              <span className="ml-1 text-xs text-ink/40">{roleLabel[user?.role]}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-xs text-ink/40 hover:text-stop transition-colors p-1"
            >
              <span className="hidden sm:inline">Déconnexion</span>
              <span className="sm:hidden">✕</span>
            </button>
          </div>
        </div>
      </header>

      {notifications.length > 0 && (
        <div className="fixed top-16 right-2 left-2 sm:left-auto sm:right-4 z-50 space-y-2 sm:w-80">
          {notifications.slice(0, 3).map((n) => (
            <div key={n.id} className="bg-white text-ink p-3 rounded-xl shadow-lg border border-[rgba(0,0,0,0.06)] border-l-4 border-l-route">
              <p className="font-semibold text-sm">{n.title}</p>
              <p className="text-xs text-ink/50">{n.message}</p>
            </div>
          ))}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
