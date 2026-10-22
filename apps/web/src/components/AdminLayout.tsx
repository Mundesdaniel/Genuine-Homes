import {
  BadgeCheck,
  CreditCard,
  Fingerprint,
  Home,
  LayoutDashboard,
  LogOut,
  Users,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/verifications', label: 'Verifications', icon: BadgeCheck, end: false },
  { to: '/admin/identity', label: 'Identity checks', icon: Fingerprint, end: false },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard, end: false },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand' : 'text-stone-600 hover:bg-stone-50 hover:text-brand'
  }`;

/**
 * Shell for the admin section — its own sidebar + navigation, deliberately
 * separate from the user-facing header/footer in Layout. Every admin page
 * renders through the <Outlet />; the route tree guards the whole section with
 * a single <ProtectedRoute requireRole={ADMIN}>.
 */
export function AdminLayout() {
  // Keep the session identity fresh (role changes, revocations) while in admin.
  useCurrentUser();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  const nav = (
    <nav className="space-y-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={linkClass}>
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-stone-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-stone-200 px-4">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <Home className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-tight text-pine-dark">
              Genuine&nbsp;Homes
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-brand">Admin</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">{nav}</div>

        <div className="space-y-1 border-t border-stone-200 p-3">
          {user && (
            <p className="truncate px-3 py-1 text-xs text-stone-500" title={user.fullName}>
              {user.fullName}
            </p>
          )}
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 hover:text-brand"
          >
            <Home className="h-4 w-4" />
            Back to site
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile) — brand + horizontally scrolling nav */}
        <header className="sticky top-0 z-[1000] border-b border-stone-200 bg-white/90 backdrop-blur md:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Home className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <span className="font-display text-sm font-bold tracking-tight text-pine-dark">
                Admin
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className="text-sm font-medium text-stone-600 hover:text-brand">
                Back to site
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="text-sm font-medium text-red-600"
              >
                Log out
              </button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto border-t border-stone-100 px-2 py-2">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand' : 'text-stone-600 hover:bg-stone-50'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
