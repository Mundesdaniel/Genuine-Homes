import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition ${isActive ? 'text-brand' : 'text-stone-600 hover:text-brand'}`;

// Mobile links are full-width touch targets, not desktop text links.
const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-brand/10 text-brand' : 'text-stone-700 hover:bg-stone-50'
  }`;

export function Layout() {
  const { t } = useTranslation();
  // Keep the session identity fresh on every page (role changes, revocations),
  // not only when the user happens to visit the dashboard.
  useCurrentUser();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const logout = useLogout();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const onLogout = async () => {
    closeMenu();
    await logout();
    navigate('/');
  };

  const links = (close: () => void, cls: (p: { isActive: boolean }) => string) => (
    <>
      <NavLink to="/" end className={cls} onClick={close}>
        {t('nav.browse')}
      </NavLink>
      {token && (
        <>
          <NavLink to="/favorites" className={cls} onClick={close}>
            {t('nav.saved')}
          </NavLink>
          <NavLink to="/messages" className={cls} onClick={close}>
            {t('nav.messages')}
          </NavLink>
          <NavLink to="/payments" className={cls} onClick={close}>
            {t('nav.payments')}
          </NavLink>
          <NavLink to="/dashboard" className={cls} onClick={close}>
            {t('nav.dashboard')}
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={cls} onClick={close}>
              {t('nav.admin')}
            </NavLink>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[1000] border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2" onClick={closeMenu}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-bold text-white">
              G
            </span>
            <span className="text-lg font-bold tracking-tight text-brand-dark">
              Genuine&nbsp;Homes
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-6 md:flex">{links(closeMenu, navClass)}</nav>

          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher />
            {token ? (
              <>
                <span className="text-sm text-stone-600">
                  {user?.fullName ?? t('nav.account')}
                  {user?.role && (
                    <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                      {titleCase(user.role)}
                    </span>
                  )}
                </span>
                <button className="btn-outline" onClick={onLogout} type="button">
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">
                  {t('nav.login')}
                </Link>
                <Link to="/register" className="btn-primary">
                  {t('nav.signup')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-stone-700 hover:bg-stone-100 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <nav
            id="mobile-nav"
            className="border-t border-stone-200 bg-white px-4 pb-4 pt-2 md:hidden"
          >
            <div className="space-y-1">{links(closeMenu, mobileNavClass)}</div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
              <LanguageSwitcher />
              {token ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-stone-600">
                    {user?.fullName ?? t('nav.account')}
                  </span>
                  <button className="btn-outline" onClick={onLogout} type="button">
                    {t('nav.logout')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className="btn-ghost" onClick={closeMenu}>
                    {t('nav.login')}
                  </Link>
                  <Link to="/register" className="btn-primary" onClick={closeMenu}>
                    {t('nav.signup')}
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-stone-500">
          Genuine Homes — rent · buy · buy in installments. East Africa.
        </div>
      </footer>
    </div>
  );
}
