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
      <header className="bg-ink text-paper border-b-4 border-route sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <span className="text-2xl font-heading text-route">TSE</span>
            <span className="hidden sm:block text-sm text-kraft">Tournée Snack Express</span>
          </Link>
          <div className="flex items-center gap-3">
            {user?.role === 'manager_driver' && (
              <Link
                to={location.pathname === '/livraison' ? '/dashboard' : '/livraison'}
                className="px-3 py-1.5 bg-route/20 text-route rounded-lg text-xs font-semibold hover:bg-route/30 no-underline"
              >
                {location.pathname === '/livraison' ? '← Gestion' : 'Ma tournée →'}
              </Link>
            )}
            <button onClick={markAllRead} className="text-kraft hover:text-paper relative">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-stop text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="hidden sm:block text-sm">
              <span className="font-medium text-paper">{user?.firstName}</span>
              <span className="ml-1 text-xs text-kraft/70">{roleLabel[user?.role]}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-xs text-kraft hover:text-stop transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {notifications.length > 0 && (
        <div className="fixed top-16 right-4 z-50 space-y-2 w-80">
          {notifications.slice(0, 3).map((n) => (
            <div key={n.id} className="bg-ink text-paper p-3 rounded-lg shadow-lg border-l-4 border-route">
              <p className="font-semibold text-sm">{n.title}</p>
              <p className="text-xs text-kraft">{n.message}</p>
            </div>
          ))}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
