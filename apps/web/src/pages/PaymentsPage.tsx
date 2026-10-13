import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import type { PaymentResponse } from '@genuine-homes/shared';
import { paymentsApi } from '@/api/payments';
import { Badge, EmptyState, ErrorState, Spinner, statusTone } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney, titleCase } from '@/lib/format';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

function Receipt({ payment, onClose }: { payment: PaymentResponse; onClose: () => void }) {
  return (
    <div className="card mb-4 p-5 print:border-0 print:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Receipt</p>
          <h2 className="text-lg font-bold text-stone-800">Genuine Homes</h2>
        </div>
        <Badge label={titleCase(payment.status)} tone={statusTone(payment.status)} />
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

function CashToConfirm() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['payments', 'incoming-cash'],
    queryFn: () => paymentsApi.incomingCash(),
  });
  const confirm = useMutation({
    mutationFn: (id: string) => paymentsApi.confirmCash(id),
    onSuccess: () => {
      toast.success('Cash payment confirmed');
      void queryClient.invalidateQueries({ queryKey: ['payments', 'incoming-cash'] });
      void queryClient.invalidateQueries({ queryKey: ['payments', 'mine'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <div className="card border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-amber-700" />
        <h2 className="font-semibold text-amber-900">Cash payments to confirm</h2>
      </div>
      <p className="mt-1 text-sm text-amber-800">
        A buyer chose to pay in cash. Confirm once you’ve received the money — this completes
        the sale/rental and marks the property accordingly.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-800">{c.propertyTitle}</p>
              <p className="text-xs text-stone-500">
                {titleCase(c.purpose)} · from {c.payerName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-stone-800">
                {formatMoney(c.amount, c.currency)}
              </span>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-sm"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate(c.id)}
              >
                {confirm.isPending ? 'Confirming…' : 'Confirm received'}
              </button>
            </div>
          </li>
        ))}
      </ul>
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
  if (isError)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;

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

      <CashToConfirm />

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
                    <Badge label={titleCase(p.status)} tone={statusTone(p.status)} />
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
