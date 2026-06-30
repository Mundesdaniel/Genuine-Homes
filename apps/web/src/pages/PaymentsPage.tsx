import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PaymentResponse } from '@genuine-homes/shared';
import { paymentsApi } from '@/api/payments';
import { Badge, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney, titleCase } from '@/lib/format';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

function Receipt({
  payment,
  onClose,
}: {
  payment: PaymentResponse;
  onClose: () => void;
}) {
  return (
    <div className="card mb-4 p-5 print:border-0 print:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Receipt</p>
          <h2 className="text-lg font-bold text-stone-800">Genuine Homes</h2>
        </div>
        <Badge label={titleCase(payment.status)} tone={payment.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-stone-500">Amount</dt>
        <dd className="text-right font-semibold text-stone-800">
          {formatMoney(payment.amount, payment.currency)}
        </dd>
        <dt className="text-stone-500">Purpose</dt>
        <dd className="text-right">{titleCase(payment.purpose)}</dd>
        <dt className="text-stone-500">Method</dt>
        <dd className="text-right">{titleCase(payment.provider)}</dd>
        <dt className="text-stone-500">Date</dt>
        <dd className="text-right">{formatDate(payment.createdAt)}</dd>
        <dt className="text-stone-500">Payment ID</dt>
        <dd className="break-all text-right font-mono text-xs">{payment.id}</dd>
        {payment.providerRef && (
          <>
            <dt className="text-stone-500">Gateway ref</dt>
            <dd className="break-all text-right font-mono text-xs">{payment.providerRef}</dd>
          </>
        )}
      </dl>
      <div className="mt-4 flex justify-end gap-2 print:hidden">
        <button className="btn-outline" type="button" onClick={onClose}>
          Close
        </button>
        <button className="btn-primary" type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  );
}

export function PaymentsPage() {
  const [receipt, setReceipt] = useState<PaymentResponse | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payments', 'mine'],
    queryFn: () => paymentsApi.mine(),
  });

  if (isLoading) return <Spinner label="Loading payments…" />;
  if (isError) return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;

  const payments = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">Payments</h1>
        <p className="mt-1 text-sm text-stone-500">
          Your deposits, installments, and rent payments.
        </p>
      </div>

      {receipt && <Receipt payment={receipt} onClose={() => setReceipt(null)} />}

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          hint="Payments you make for deposits, installments, or rent will appear here."
        />
      ) : (
        <div className="overflow-x-auto print:hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Purpose</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-stone-100">
                  <td className="py-2 pr-4 text-stone-500">{formatDate(p.createdAt)}</td>
                  <td className="py-2 pr-4">{titleCase(p.purpose)}</td>
                  <td className="py-2 pr-4">{titleCase(p.provider)}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-stone-800">
                    {formatMoney(p.amount, p.currency)}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={titleCase(p.status)} tone={p.status} />
                  </td>
                  <td className="py-2 text-right">
                    {p.status === 'successful' && (
                      <button
                        type="button"
                        className="text-sm font-medium text-brand hover:underline"
                        onClick={() => setReceipt(p)}
                      >
                        Receipt
                      </button>
                    )}
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
