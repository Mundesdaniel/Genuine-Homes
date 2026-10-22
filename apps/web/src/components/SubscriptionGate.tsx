import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { SubscriptionStatus, type SubscriptionResponse } from '@genuine-homes/shared';
import { subscriptionsApi } from '@/api/subscriptions';
import { ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';

/** Mirrors the server-side SubscriptionGuard: active AND not yet expired. */
function hasAccess(sub: SubscriptionResponse | null): boolean {
  return (
    sub !== null &&
    sub.status === SubscriptionStatus.ACTIVE &&
    new Date(sub.expiresAt) > new Date()
  );
}

/** Shown when the subscription is missing, expired, or cancelled. */
function RenewToAccess({ sub }: { sub: SubscriptionResponse | null }) {
  const expired =
    sub !== null &&
    (sub.status !== SubscriptionStatus.ACTIVE || new Date(sub.expiresAt) <= new Date());

  return (
    <div className="mx-auto max-w-lg">
      <div className="card space-y-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-stone-800">
          {expired ? 'Your subscription has lapsed' : 'Subscription required'}
        </h1>
        <p className="text-sm text-stone-600">
          The short-let dashboard is for AirBnB agents with an active subscription.
          {expired && sub
            ? ` Your ${sub.plan} plan ended on ${new Date(sub.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`
            : ''}
        </p>
        <div className="space-y-2 rounded-lg bg-stone-50 p-4 text-left text-sm text-stone-600">
          <p className="font-medium text-stone-800">How to renew</p>
          <p>
            Subscriptions are paid in cash. Pay your subscription at the Genuine Homes office;
            an administrator will record your payment and activate your access. It takes effect
            as soon as they confirm it.
          </p>
        </div>
        <Link to="/dashboard" className="btn-outline inline-block">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

/**
 * Client-side gate for the short-let dashboard. Checks the caller's subscription
 * and renders the "Renew to access" screen unless it is active and unexpired.
 * The server enforces the same rule — this is the matching UX.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['subscriptions', 'mine'],
    queryFn: () => subscriptionsApi.mine(),
  });

  if (isLoading) return <Spinner label="Checking your subscription…" />;
  if (isError)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;

  const sub = data ?? null;
  if (!hasAccess(sub)) return <RenewToAccess sub={sub} />;

  return <>{children}</>;
}
