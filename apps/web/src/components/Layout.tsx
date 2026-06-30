import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLogout } from '@/hooks/useAuth';
import { titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition ${
    isActive ? 'text-brand' : 'text-stone-600 hover:text-brand'
  }`;

export function Layout() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[1000] border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-bold text-white">
              G
            </span>
            <span className="text-lg font-bold tracking-tight text-brand-dark">
              Genuine&nbsp;Homes
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <NavLink to="/" end className={navClass}>
              {t('nav.browse')}
            </NavLink>
            {token && (
              <>
                <NavLink to="/favorites" className={navClass}>
                  {t('nav.saved')}
                </NavLink>
                <NavLink to="/messages" className={navClass}>
                  {t('nav.messages')}
                </NavLink>
                <NavLink to="/payments" className={navClass}>
                  {t('nav.payments')}
                </NavLink>
                <NavLink to="/dashboard" className={navClass}>
                  {t('nav.dashboard')}
                </NavLink>
                {user?.role === 'admin' && (
                  <NavLink to="/admin" className={navClass}>
                    {t('nav.admin')}
                  </NavLink>
                )}
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {token ? (
              <>
                <span className="hidden text-sm text-stone-600 sm:inline">
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
        </div>
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
