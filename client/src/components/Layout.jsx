import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

const roleLabel = { manager: 'Gestionnaire', manager_driver: 'Gestionnaire + Livreur', driver: 'Livreur' };

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAllRead } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-white border-b border-kraft sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <span className="text-2xl font-heading text-route tracking-tight">foodly</span>
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
            <button onClick={markAllRead} className="text-ink/40 hover:text-ink relative p-2">
              🔔
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-stop text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="text-sm">
              <span className="font-medium text-ink">{user?.firstName}</span>
              <span className="hidden sm:inline ml-1 text-xs text-ink/40">{roleLabel[user?.role]}</span>
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
            <div key={n.id} className="bg-white text-ink p-3 rounded-lg shadow-lg border border-kraft border-l-4 border-l-route">
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
