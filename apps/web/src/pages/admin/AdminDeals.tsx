import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AdminDealKind, AdminDealRow } from '@genuine-homes/shared';
import { adminApi } from '@/api/admin';
import { Badge, EmptyState, ErrorState, Spinner, statusTone } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney, titleCase } from '@/lib/format';
import { Pager } from './AdminProperties';

const PAGE_SIZE = 50;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

const KIND_LABEL: Record<AdminDealKind, string> = {
  rental: 'Rental',
  installment: 'Installment',
  purchase: 'Purchase',
};
const kindTone = (kind: AdminDealKind) => (kind === 'rental' ? 'info' : 'success');

/**
 * Internal "deals" table — every successful deal (rental, installment, or
 * outright purchase) with the agent who closed it and the tenant/buyer involved.
 */
export function AdminDeals() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'deals', page],
    queryFn: () => adminApi.deals(page, PAGE_SIZE),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">Deals</h1>
        <p className="mt-1 text-sm text-stone-500">
          Successful rentals and sales — the agent who closed each and the tenant or buyer.
        </p>
      </div>

      {isLoading ? (
        <Spinner label="Loading deals…" />
      ) : isError || !data ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No deals yet"
          hint="Successful rentals and sales will appear here."
        />
      ) : (
        <>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Tenant / buyer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((d: AdminDealRow) => (
                  <tr
                    key={`${d.kind}-${d.id}`}
                    className="border-b border-stone-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Badge label={KIND_LABEL[d.kind]} tone={kindTone(d.kind)} />
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">{d.propertyTitle}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{d.agent.fullName}</p>
                      <p className="text-xs text-stone-500">
                        {d.agent.phone}
                        {d.agent.role ? ` · ${titleCase(d.agent.role)}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{d.client.fullName}</p>
                      <p className="text-xs text-stone-500">
                        {d.client.phone} · {titleCase(d.clientKind)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={titleCase(d.status)} tone={statusTone(d.status)} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                      {formatMoney(d.amount, d.currency)}
                    </td>
                    <td className="px-4 py-3 text-stone-500">{fmtDate(d.date)}</td>
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
