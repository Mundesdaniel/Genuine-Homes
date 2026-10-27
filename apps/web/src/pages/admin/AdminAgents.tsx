import { useQuery } from '@tanstack/react-query';
import type { AdminAgentPerformanceRow } from '@genuine-homes/shared';
import { adminApi } from '@/api/admin';
import { Badge, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

/**
 * Internal agent performance rollup — for each agent, how many properties they
 * added and how many deals (rentals + sales) they successfully closed.
 */
export function AdminAgents() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'agents'],
    queryFn: () => adminApi.agents(),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">Agents</h1>
        <p className="mt-1 text-sm text-stone-500">
          Properties added and successful deals (rentals + sales) per agent.
        </p>
      </div>

      {isLoading ? (
        <Spinner label="Loading agents…" />
      ) : isError || !data ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title="No agents yet"
          hint="Agents appear here once they add properties or close deals."
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Properties added</th>
                <th className="px-4 py-3 text-right">Rentals</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Successful deals</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: AdminAgentPerformanceRow) => (
                <tr key={row.agent.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{row.agent.fullName}</p>
                    <p className="text-xs text-stone-500">{row.agent.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    {row.agent.role ? (
                      <Badge label={titleCase(row.agent.role)} tone="info" />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.propertiesAdded}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.rentals}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.sales}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-stone-800">
                    {row.successfulDeals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
