import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney } from '@/lib/format';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-stone-800">
        {value}
      </p>
    </div>
  );
}

/** Admin landing page — headline platform metrics. */
export function AdminOverview() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => adminApi.overview(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-stone-800">Overview</h1>

      {isLoading ? (
        <Spinner label="Loading overview…" />
      ) : isError || !data ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Users" value={data.users} />
          <Stat label="Properties" value={data.properties} />
          <Stat label="Active listings" value={data.activeListings} />
          <Stat label="Active plans" value={data.activePlans} />
          <Stat label="Pending verifications" value={data.pendingVerifications} />
          <Stat
            label="Revenue (settled)"
            value={formatMoney(data.revenue.total, data.revenue.currency)}
          />
        </div>
      )}
    </div>
  );
}
