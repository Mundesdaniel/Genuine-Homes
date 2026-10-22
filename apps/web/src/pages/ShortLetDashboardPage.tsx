import { useQuery } from '@tanstack/react-query';
import { subscriptionsApi } from '@/api/subscriptions';
import { EmptyState, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/**
 * Short-let ("AirBnB") dashboard. Rendered only behind SubscriptionGate (client)
 * and gated again by the server (airbnb_agent role + active subscription). The
 * listings area is a placeholder for the full feature.
 */
export function ShortLetDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['short-let', 'dashboard'],
    queryFn: () => subscriptionsApi.shortLetDashboard(),
  });

  if (isLoading) return <Spinner label="Loading short-let dashboard…" />;
  if (isError || !data)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">
          Short-let dashboard
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Your <span className="font-medium">{data.subscription.plan}</span> subscription is
          active until {formatDate(data.subscription.expiresAt)}.
        </p>
      </div>

      <EmptyState
        title="No short-let listings yet"
        hint="Your short-let listings will appear here."
      />
    </div>
  );
}
