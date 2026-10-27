import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AdminPropertyRow } from '@genuine-homes/shared';
import { adminApi } from '@/api/admin';
import { Badge, EmptyState, ErrorState, Spinner, statusTone } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

const PAGE_SIZE = 50;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

/**
 * Internal "all properties" table — every property with the agent who added it
 * (the record owner), so admins can see who listed what.
 */
export function AdminProperties() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'properties', page],
    queryFn: () => adminApi.properties(page, PAGE_SIZE),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">Properties</h1>
        <p className="mt-1 text-sm text-stone-500">
          Every property and the agent who added it.
        </p>
      </div>

      {isLoading ? (
        <Spinner label="Loading properties…" />
      ) : isError || !data ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No properties yet" hint="Added properties will appear here." />
      ) : (
        <>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Landlord</th>
                  <th className="px-4 py-3">Added by (agent)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p: AdminPropertyRow) => (
                  <tr key={p.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{p.title}</p>
                      <p className="text-xs text-stone-500">{titleCase(p.type)}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {p.city}
                      {p.district && p.district !== p.city ? `, ${p.district}` : ''}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{p.landlordName}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{p.agent.fullName}</p>
                      <p className="text-xs text-stone-500">
                        {p.agent.phone}
                        {p.agent.role ? ` · ${titleCase(p.agent.role)}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={titleCase(p.status)} tone={statusTone(p.status)} />
                    </td>
                    <td className="px-4 py-3 text-stone-500">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager
            page={page}
            totalPages={totalPages}
            total={data.total}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-stone-500">
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-outline py-1"
          disabled={page <= 1}
          onClick={onPrev}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-outline py-1"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}
