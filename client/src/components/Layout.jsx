import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

const navItems = [
  { path: '/dashboard', label: 'Tableau de bord', icon: '📊', roles: ['manager', 'manager_driver'] },
  { path: '/orders', label: 'Commandes', icon: '📋', roles: ['manager', 'manager_driver', 'driver'] },
  { path: '/tours', label: 'Tournées', icon: '🚗', roles: ['manager', 'manager_driver', 'driver'] },
  { path: '/map', label: 'Carte', icon: '🗺️', roles: ['manager', 'manager_driver', 'driver'] },
  { path: '/products', label: 'Produits', icon: '📦', roles: ['manager', 'manager_driver'] },
  { path: '/promos', label: 'Promos', icon: '🏷️', roles: ['manager', 'manager_driver'] },
  { path: '/drivers', label: 'Livreurs', icon: '👥', roles: ['manager', 'manager_driver'] },
  { path: '/closings', label: 'Clôtures', icon: '📒', roles: ['manager', 'manager_driver'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAllRead } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();

  const filtered = navItems.filter((item) => item.roles.includes(user?.role));

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink text-paper border-b-4 border-route">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3 no-underline">
            <span className="text-2xl font-heading text-route">TSE</span>
            <span className="hidden sm:block text-sm text-kraft">Tournée Snack Express</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={markAllRead}
                className="text-kraft hover:text-paper transition-colors relative"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-stop text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="text-sm text-kraft">
              <span className="font-medium text-paper">{user?.firstName}</span>
              <span className="ml-1 text-xs opacity-70">
                {user?.role === 'manager_driver' ? 'Gestionnaire+Livreur' : user?.role === 'manager' ? 'Gestionnaire' : 'Livreur'}
              </span>
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

      <div className="flex">
        <nav className="w-56 min-h-[calc(100vh-60px)] bg-kraft/40 border-r border-kraft hidden md:block">
          <ul className="py-4 space-y-1">
            {filtered.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm no-underline transition-colors ${
                    location.pathname === item.path
                      ? 'bg-route text-paper font-semibold'
                      : 'text-ink hover:bg-kraft/60'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-6 max-w-6xl">
          {notifications.length > 0 && (
            <div className="fixed top-16 right-4 z-50 space-y-2 w-80">
              {notifications.slice(0, 3).map((n) => (
                <div key={n.id} className="bg-ink text-paper p-3 rounded-lg shadow-lg border-l-4 border-route animate-pulse">
                  <p className="font-semibold text-sm">{n.title}</p>
                  <p className="text-xs text-kraft">{n.message}</p>
                </div>
              ))}
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-ink border-t-2 border-route z-40">
        <div className="flex justify-around py-2">
          {filtered.slice(0, 5).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center text-xs no-underline ${
                location.pathname === item.path ? 'text-route' : 'text-kraft'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
