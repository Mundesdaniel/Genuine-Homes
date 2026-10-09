import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NotificationResponse } from '@genuine-homes/shared';
import { NotificationType } from '@genuine-homes/shared';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/useNotifications';

/** Map a notification to the in-app route it should open. */
function routeFor(n: NotificationResponse): string {
  const data = n.data ?? {};
  const planId = typeof data.planId === 'string' ? data.planId : null;
  const listingId = typeof data.listingId === 'string' ? data.listingId : null;
  const senderId = typeof data.senderId === 'string' ? data.senderId : null;
  switch (n.type) {
    case NotificationType.PAYMENT_SUCCESSFUL:
    case NotificationType.PAYMENT_FAILED:
      return '/payments';
    case NotificationType.INSTALLMENT_DUE_SOON:
    case NotificationType.INSTALLMENT_OVERDUE:
    case NotificationType.PLAN_DEFAULTED:
    case NotificationType.PLAN_REINSTATED:
      return planId ? `/plans/${planId}` : '/dashboard';
    case NotificationType.IDENTITY_VERIFIED:
    case NotificationType.IDENTITY_REJECTED:
      return '/identity';
    case NotificationType.NEW_MESSAGE:
      // Open the conversation with the sender, not just the inbox.
      return senderId ? `/messages?to=${senderId}` : '/messages';
    case NotificationType.VIEWING_SCHEDULED:
      return '/bookings';
    case NotificationType.LISTING_VERIFIED:
    case NotificationType.SAVED_SEARCH_MATCH:
      // The house is viewed through its listing; fall back to the dashboard.
      return listingId ? `/listings/${listingId}` : '/dashboard';
    default:
      return '/dashboard';
  }
}

/** Compact relative time, e.g. "just now", "5m", "3h", "2d". */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  return `${days}d`;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: count } = useUnreadCount();
  const { data: list, isLoading } = useNotifications(open);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unread = count?.unread ?? 0;
  const items = list?.items ?? [];

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onItemClick = (n: NotificationResponse) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    navigate(routeFor(n));
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative grid h-10 w-10 place-items-center rounded-lg text-stone-700 transition hover:bg-stone-100"
        aria-label={t('notifications.title')}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-brand px-1 text-[0.65rem] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[1100] mt-2 w-80 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <span className="text-sm font-semibold text-pine-dark">
              {t('notifications.title')}
            </span>
            {unread > 0 && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-brand hover:underline disabled:opacity-50"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-stone-400">
                {t('notifications.loading')}
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-400">
                {t('notifications.empty')}
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-stone-50 ${
                        n.readAt ? '' : 'bg-brand-50/50'
                      }`}
                      onClick={() => onItemClick(n)}
                    >
                      {!n.readAt && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                      )}
                      <span className={n.readAt ? 'pl-5' : ''}>
                        <span className="block text-sm font-medium text-pine-dark">
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-500">{n.body}</span>
                        <span className="mt-1 block text-[0.65rem] uppercase tracking-wide text-stone-400">
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
