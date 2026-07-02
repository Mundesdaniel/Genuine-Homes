import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentsApi } from '@/api/payments';
import { ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney } from '@/lib/format';

const POLL_MS = 3_000;

/**
 * Where the hosted checkout (Flutterwave — or the dev mock) sends the payer
 * back. Flutterwave appends `tx_ref` (our payment id) to the redirect URL; we
 * poll the ledger until the webhook settles the payment, then confirm the
 * outcome and point the user at the right next step — no more dead-ending on
 * the gateway page or guessing from the dashboard.
 */
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const paymentId = params.get('tx_ref') ?? params.get('paymentId');
  const queryClient = useQueryClient();

  const {
    data: payment,
    isError,
    error,
  } = useQuery({
    queryKey: ['payments', 'detail', paymentId],
    queryFn: () => paymentsApi.get(paymentId as string),
    enabled: Boolean(paymentId),
    // Poll while the webhook is still in flight; stop once settled.
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' || !query.state.data ? POLL_MS : false,
  });

  // A settlement changes plans, schedules and the ledger — refresh them all.
  const settled = payment && payment.status !== 'pending';
  useEffect(() => {
    if (!settled) return;
    void queryClient.invalidateQueries({ queryKey: ['plans'] });
    void queryClient.invalidateQueries({ queryKey: ['plan'] });
    void queryClient.invalidateQueries({ queryKey: ['payments'] });
  }, [settled, queryClient]);

  if (!paymentId) {
    return <ErrorState message="Missing payment reference — check your payments page." />;
  }
  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} />;
  }

  const planLink =
    payment?.purpose === 'deposit' && payment.referenceId
      ? `/plans/${payment.referenceId}`
      : null;

  return (
    <div className="mx-auto max-w-md animate-slide-up">
      <div className="card p-8 text-center">
        {!payment || payment.status === 'pending' ? (
          <>
            <Spinner label="Confirming your payment…" />
            <p className="text-sm text-stone-500">
              We're waiting for the payment provider to confirm. This usually takes a few
              seconds — you can safely leave this page; the payment will still complete.
            </p>
          </>
        ) : payment.status === 'successful' ? (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="mt-2 text-xl font-bold text-stone-800">Payment received</h1>
            <p className="mt-2 text-sm text-stone-500">
              {formatMoney(payment.amount, payment.currency)} confirmed. A receipt is available
              on your payments page.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {planLink && (
                <Link to={planLink} className="btn-primary w-full">
                  View your plan
                </Link>
              )}
              <Link
                to="/payments"
                className={planLink ? 'btn-outline w-full' : 'btn-primary w-full'}
              >
                View payments & receipt
              </Link>
              <Link to="/dashboard" className="btn-ghost w-full">
                Back to dashboard
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-4xl">❌</p>
            <h1 className="mt-2 text-xl font-bold text-stone-800">Payment not completed</h1>
            <p className="mt-2 text-sm text-stone-500">
              The payment of {formatMoney(payment.amount, payment.currency)} was{' '}
              {payment.status === 'failed' ? 'declined' : payment.status}. No money moved — you
              can try again from your plan.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {planLink && (
                <Link to={planLink} className="btn-primary w-full">
                  Try again
                </Link>
              )}
              <Link to="/dashboard" className="btn-outline w-full">
                Back to dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
