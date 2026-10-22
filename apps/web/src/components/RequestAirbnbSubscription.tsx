import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { subscriptionsApi } from '@/api/subscriptions';
import { apiErrorMessage } from '@/lib/apiClient';

/**
 * Lets any signed-in user ask to subscribe as an AirBnB agent. The request lands
 * in the admin queue; on approval the admin records the cash payment and grants
 * the role. Shows the current request's status instead of the form once sent.
 */
export function RequestAirbnbSubscription() {
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState('airbnb_monthly');
  const [message, setMessage] = useState('');

  const { data: request, isLoading } = useQuery({
    queryKey: ['subscriptions', 'my-request'],
    queryFn: () => subscriptionsApi.myRequest(),
  });

  const submit = useMutation({
    mutationFn: () =>
      subscriptionsApi.request({ plan, message: message.trim() === '' ? undefined : message }),
    onSuccess: () => {
      toast.success('Request sent — an admin will review it');
      setMessage('');
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', 'my-request'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading) return null;
  // Already handled → nothing to do here (approved users get the role elsewhere).
  if (request?.status === 'approved') return null;

  if (request?.status === 'pending') {
    return (
      <div className="card border-amber-200 bg-amber-50/60 p-5">
        <h2 className="font-semibold text-amber-900">AirBnB agent subscription — pending</h2>
        <p className="mt-1 text-sm text-amber-800">
          Your request for the <span className="font-medium">{request.plan}</span> plan is
          awaiting admin review. You’ll pay in cash and an admin confirms it to activate your
          access.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-stone-800">Become an AirBnB agent</h2>
        <p className="mt-1 text-sm text-stone-500">
          Request a short-let agent subscription. An admin reviews it; you pay in cash and they
          activate your access to the short-let dashboard.
          {request?.status === 'declined' && (
            <span className="mt-1 block text-red-600">
              Your previous request was declined — you can send a new one.
            </span>
          )}
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <div>
          <label className="label" htmlFor="req-plan">
            Plan
          </label>
          <select
            id="req-plan"
            className="input"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="airbnb_monthly">Monthly</option>
            <option value="airbnb_yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="req-message">
            Message <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="req-message"
            className="input"
            placeholder="e.g. I manage 3 short-lets in Kampala"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary" type="submit" disabled={submit.isPending}>
            {submit.isPending ? 'Sending…' : 'Request subscription'}
          </button>
        </div>
      </form>
    </div>
  );
}
