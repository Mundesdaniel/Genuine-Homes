import { useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { paymentsApi } from '@/api/payments';
import { apiErrorMessage } from '@/lib/apiClient';

/**
 * Dev-only stand-in for the Mobile Money / card checkout. The real gateway
 * would prompt on the payer's phone and call our webhook; here we let the user
 * approve or decline, which posts the (mock-signed) webhook directly.
 */
export function MockCheckoutPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();

  const settle = useMutation({
    mutationFn: (status: 'successful' | 'failed') =>
      paymentsApi.simulateSettlement(paymentId as string, status),
    onSuccess: (_data, status) => {
      if (status === 'successful') toast.success('Payment approved');
      else toast.error('Payment declined');
      navigate('/dashboard');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-md animate-slide-up">
      <div className="card p-8 text-center">
        <span className="chip bg-amber-100 text-amber-800">Simulated checkout · dev</span>
        <h1 className="mt-4 text-xl font-bold text-stone-800">
          Approve this Mobile Money payment?
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          This stands in for the real MTN&nbsp;MoMo / Airtel prompt you'd approve
          on your phone. Approving posts the gateway webhook and settles the
          payment.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            className="btn-primary flex-1"
            type="button"
            disabled={settle.isPending}
            onClick={() => settle.mutate('successful')}
          >
            {settle.isPending ? 'Processing…' : 'Approve'}
          </button>
          <button
            className="btn-outline flex-1"
            type="button"
            disabled={settle.isPending}
            onClick={() => settle.mutate('failed')}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
