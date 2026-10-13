import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, KeyRound, LayoutDashboard, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AuthUser } from '@genuine-homes/shared';
import { titleCase } from '@/lib/format';

/** Initials for the avatar chip, e.g. "Sarah Nakato" → "SN". */
function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'
  );
}

/**
 * The header account menu: an avatar/name trigger that opens a dropdown with
 * profile actions (Dashboard, Change password, Log out). Account actions live
 * here rather than on a separate settings page.
 */
export function UserMenu({
  user,
  onChangePassword,
  onLogout,
}: {
  user: AuthUser;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape (mirrors NotificationBell).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-2.5 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-50';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-stone-200 py-1 pl-1 pr-2.5 transition hover:border-stone-300 hover:bg-stone-50"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
          {initialsOf(user.fullName)}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-stone-700 lg:block">
          {user.fullName}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-stone-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-[1100] mt-2 w-60 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-pine-dark">{user.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-stone-500">
              {user.email ?? user.phone}
            </p>
            <span className="mt-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand">
              {titleCase(user.role)}
            </span>
          </div>

          <div className="py-1">
            <Link to="/dashboard" className={itemClass} onClick={() => setOpen(false)}>
              <LayoutDashboard className="h-4 w-4 text-stone-400" />
              {t('nav.dashboard')}
            </Link>
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                onChangePassword();
              }}
            >
              <KeyRound className="h-4 w-4 text-stone-400" />
              {t('nav.changePassword')}
            </button>
          </div>

          <div className="border-t border-stone-100 py-1">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut className="h-4 w-4" />
              {t('nav.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
