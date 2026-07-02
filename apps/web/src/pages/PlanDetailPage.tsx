import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PaymentProvider, enumValues, type PayViaInput } from '@genuine-homes/shared';
import { installmentsApi } from '@/api/installments';
import { ProgressDonut } from '@/components/charts';
import { Badge, ErrorState, Spinner, statusTone } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { goToCheckout } from '@/lib/checkout';
import { formatMoney, titleCase } from '@/lib/format';

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<string>('mtn_momo');

  const {
    data: plan,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => installmentsApi.get(id as string),
    enabled: Boolean(id),
    refetchInterval: 15_000, // reflect settlements without a manual refresh
  });

  const deposit = useMutation({
    mutationFn: () => installmentsApi.payDeposit(id as string, { provider } as PayViaInput),
    onSuccess: (res) => {
      toast.success('Opening checkout…');
      goToCheckout(res.redirectUrl, navigate);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const payItem = useMutation({
    mutationFn: (installmentId: string) =>
      installmentsApi.payInstallment(id as string, installmentId, { provider } as PayViaInput),
    onSuccess: (res) => {
      toast.success('Opening checkout…');
      goToCheckout(res.redirectUrl, navigate);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading) return <Spinner label="Loading plan…" />;
  if (isError || !plan) {
    return <ErrorState message={apiErrorMessage(error) || 'Plan not found'} />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/dashboard" className="text-sm font-medium text-brand-dark">
        ← Back to dashboard
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Schedule */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-stone-800">Installment plan</h1>
            <Badge label={titleCase(plan.status)} tone={statusTone(plan.status)} />
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {plan.schedule.map((item) => (
                  <tr key={item.id} className="border-t border-stone-100">
                    <td className="px-4 py-2 text-stone-400">{item.sequence}</td>
                    <td className="px-4 py-2">{item.dueDate}</td>
                    <td className="px-4 py-2 font-medium">
                      {formatMoney(item.amount, plan.currency)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge label={titleCase(item.status)} tone={statusTone(item.status)} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {plan.status === 'active' && item.status !== 'paid' && (
                        <button
                          className="btn-outline px-3 py-1 text-xs"
                          type="button"
                          disabled={payItem.isPending}
                          onClick={() => payItem.mutate(item.id)}
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Progress + actions */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <h3 className="mb-1 text-sm font-semibold text-stone-700">Progress</h3>
            <ProgressDonut paid={plan.paidAmount} remaining={plan.remainingAmount} />
            <div className="mt-2 text-center">
              <p className="text-2xl font-bold text-brand-dark">
                {plan.paidCount}/{plan.months}
              </p>
              <p className="text-xs text-stone-500">installments paid</p>
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Total</span>
              <span className="font-semibold">
                {formatMoney(plan.totalPrice, plan.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Deposit</span>
              <span className="font-semibold">
                {formatMoney(plan.depositAmount, plan.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Monthly</span>
              <span className="font-semibold">
                {formatMoney(plan.monthlyAmount, plan.currency)}
              </span>
            </div>

            <div>
              <label className="label" htmlFor="provider">
                Pay with
              </label>
              <select
                id="provider"
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                {enumValues(PaymentProvider).map((p) => (
                  <option key={p} value={p}>
                    {titleCase(p)}
                  </option>
                ))}
              </select>
            </div>

            {plan.status === 'pending_deposit' && (
              <button
                className="btn-primary w-full"
                type="button"
                disabled={deposit.isPending}
                onClick={() => deposit.mutate()}
              >
                Pay deposit {formatMoney(plan.depositAmount, plan.currency)}
              </button>
            )}
            {plan.status === 'completed' && (
              <p className="rounded-lg bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700">
                🎉 Fully paid — ownership complete!
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
