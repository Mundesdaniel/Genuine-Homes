import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Menu, X } from 'lucide-react';
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
    isActive ? 'bg-brand-50 text-brand' : 'text-stone-700 hover:bg-stone-50'
  }`;

function Wordmark() {
  return (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <Home className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-pine-dark">
        Genuine&nbsp;Homes
      </span>
    </>
  );
}

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

  const footerLink = 'text-sm text-stone-400 transition hover:text-gold';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[1000] border-b border-stone-200 bg-white/90 backdrop-blur">
        {/* Brand accent line. */}
        <div className="h-0.5 bg-gradient-to-r from-brand-600 via-gold to-brand-600" />
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2" onClick={closeMenu}>
            <Wordmark />
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
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand">
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
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="mt-12 bg-pine-deep text-stone-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Home className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-white">
                Genuine&nbsp;Homes
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-stone-400">{t('footer.tagline')}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t('footer.explore')}
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/" className={footerLink}>
                  {t('nav.browse')}
                </Link>
              </li>
              <li>
                <Link to="/favorites" className={footerLink}>
                  {t('nav.saved')}
                </Link>
              </li>
              <li>
                <Link to="/messages" className={footerLink}>
                  {t('nav.messages')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t('footer.account')}
            </h3>
            <ul className="mt-3 space-y-2">
              {token ? (
                <>
                  <li>
                    <Link to="/dashboard" className={footerLink}>
                      {t('nav.dashboard')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/payments" className={footerLink}>
                      {t('nav.payments')}
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/login" className={footerLink}>
                      {t('nav.login')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className={footerLink}>
                      {t('nav.signup')}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t('footer.languages')}
            </h3>
            <div className="mt-3">
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-stone-500">
            © {new Date().getFullYear()} Genuine Homes — rent · buy · buy in installments. East
            Africa.
          </div>
        </div>
      </footer>
    </div>
  );
}
