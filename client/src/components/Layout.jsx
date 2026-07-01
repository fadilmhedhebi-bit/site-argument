import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useTheme } from '../ThemeContext';
import { shadows } from '../theme';
import FoodlyLogo from './FoodlyLogo';

const roleLabel = { manager: 'Gestionnaire', manager_driver: 'Gestionnaire + Livreur', driver: 'Livreur' };

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAllRead } = useNotificationStore();
  const { isDark, toggleTheme, t } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen" style={{ backgroundColor: t.bg }}>
      <header className="sticky top-0 z-50" style={{ backgroundColor: t.navBg, borderBottom: `1px solid ${t.border}` }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <FoodlyLogo size={30} />
            <span className="text-xl font-bold tracking-[-1.5px]" style={{ color: t.text1 }}>foodly</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 w-[34px] h-[34px] rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: t.accentBg, color: t.accent }}
              title={isDark ? 'Mode clair' : 'Mode sombre'}
            >
              {isDark ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            {user?.role === 'manager_driver' && (
              <Link
                to={location.pathname === '/livraison' ? '/dashboard' : '/livraison'}
                className="px-3 py-2 rounded-lg text-xs font-semibold no-underline"
                style={{ backgroundColor: t.accentBg, color: t.accent }}
              >
                {location.pathname === '/livraison' ? '← Gestion' : 'Tournée →'}
              </Link>
            )}
            <button onClick={markAllRead} className="relative p-2 w-[34px] h-[34px] rounded-full flex items-center justify-center transition-colors" style={{ backgroundColor: t.accentBg, color: t.accent }}>
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
            <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: t.accent }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="text-sm hidden sm:block">
              <span className="font-medium" style={{ color: t.text1 }}>{user?.firstName}</span>
              <span className="ml-1 text-xs" style={{ color: t.text2 }}>{roleLabel[user?.role]}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-xs hover:text-stop transition-colors p-1"
              style={{ color: t.text2 }}
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
            <div key={n.id} className="p-3 rounded-xl border-l-4" style={{ backgroundColor: t.cardBg, color: t.text1, border: `1px solid ${t.border}`, borderLeftColor: t.accent, boxShadow: shadows.card }}>
              <p className="font-semibold text-sm">{n.title}</p>
              <p className="text-xs" style={{ color: t.text2 }}>{n.message}</p>
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
